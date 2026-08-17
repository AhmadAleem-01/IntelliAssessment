import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  Input,
  Dropdown,
  Option,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular } from '@fluentui/react-icons';
import { useProjects } from './api';
import { NewProjectDialog } from './NewProjectDialog';
import { Dnx_projectsstatuscode } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_projects } from '../../generated/models/Dnx_projectsModel';
import { useAssessmentInstances } from '../assessments/api';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName, lookupId } from '../../lib/dataverse';
import { SegmentedControl } from '../../components/SegmentedControl';

/*
 * Projects list — Design System v1.0 ("Calm Efficiency"). Per-project rollups
 * (assessment count, signed-off progress, overdue/stalled signals, updated-ago)
 * are computed by grouping ALL assessment instances by project client-side — no
 * per-project queries, all figures real (honesty rule). Instances are already
 * cached by the dashboard / assessments views.
 */
const MS_PER_DAY = 86_400_000;

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
  headerText: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtitle: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    border: '1px solid transparent',
    flexShrink: 0,
    ':hover': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
    ':hover:active': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
  },

  /* Toolbar: segmented filter + search + sort */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  search: {
    flex: 1,
    minWidth: '220px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    height: '40px',
    '::after': { display: 'none' },
    '& input': { borderRadius: '6px', height: '38px', fontSize: 'var(--ds-fs-body)' },
  },
  countHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', whiteSpace: 'nowrap' },
  sort: {
    minWidth: '170px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& button': {
      border: 'none',
      backgroundColor: 'transparent',
      height: '38px',
      fontSize: 'var(--ds-fs-body)',
      fontWeight: 500,
      color: 'var(--ds-text-strong)',
    },
  },

  /* Cards */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px',
  },
  cardLink: { textDecoration: 'none', color: 'inherit', outline: 'none' },
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '20px',
    transition: 'border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    height: '100%',
    ':hover': {
      borderColor: 'var(--ds-text-muted)',
      boxShadow: '0 2px 10px -4px rgba(17, 24, 39, 0.12)',
      transform: 'translateY(-1px)',
    },
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  cardName: {
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    flexWrap: 'wrap',
  },
  cardCode: {
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    letterSpacing: '0.04em',
  },
  metaDot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'var(--ds-border)' },
  cardDesc: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-body)',
    lineHeight: 1.55,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    flex: 1,
  },
  cardDescEmpty: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    fontStyle: 'italic',
    flex: 1,
  },
  progressBlock: { display: 'flex', flexDirection: 'column', gap: '6px' },
  progressLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 'var(--ds-fs-caption)',
  },
  progressLabel: { color: 'var(--ds-text-body)' },
  progressLabelStrong: { fontWeight: 700, color: 'var(--ds-text-strong)' },
  progressPct: { color: 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums' },
  progressTrack: {
    display: 'block',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'var(--ds-surface-base)',
    overflow: 'hidden',
  },
  progressFill: { display: 'block', height: '100%', borderRadius: '999px', minWidth: '2px' },
  cardFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid var(--ds-border)',
  },
  statusLine: { display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: 'var(--ds-fs-caption)', fontWeight: 600 },
  statusLineDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  footMeta: { fontSize: '11px', color: 'var(--ds-text-muted)' },

  /* Status pill (project lifecycle) */
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
    flexShrink: 0,
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },

  archiveNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '2px' },

  empty: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px dashed var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '64px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  emptyTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  emptySub: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)', maxWidth: '400px' },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Active: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'active' },
  OnHold: { bg: 'var(--ds-pending-soft)', color: '#b45309', dot: 'var(--ds-pending)', label: 'on hold' },
  Archived: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'archived' },
  Inactive: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'inactive' },
  Unknown: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'draft' },
};

function projectStatusLabel(code: number | undefined): string {
  if (!code) return 'Unknown';
  return Dnx_projectsstatuscode[code as keyof typeof Dnx_projectsstatuscode] ?? 'Unknown';
}

function instStatus(inst: Dnx_assessment_instances): string {
  return (
    Dnx_assessment_instancesstatuscode[
      inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft'
  );
}

/** Per-project rollup computed from that project's assessment instances. */
interface Rollup {
  total: number;
  signedOff: number;
  overdue: number;
  stalledDrafts: number;
  lastUpdated: number | null; // ms
}

function relativeTime(ms: number | null, now: number): string | null {
  if (ms === null) return null;
  const mins = Math.floor((now - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

type Filter = 'all' | 'attention' | 'active' | 'empty';
type SortKey = 'attention' | 'name' | 'updated';

const SORT_LABEL: Record<SortKey, string> = {
  attention: 'Sort: needs attention',
  name: 'Sort: name',
  updated: 'Sort: recently updated',
};

export function ProjectsPage() {
  const styles = useStyles();
  const { data: projects, isLoading, error } = useProjects();
  const { data: instances } = useAssessmentInstances();

  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('attention');

  // Group all instances by project id → per-project rollup.
  const rollups = useMemo(() => {
    const startOfToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
    const map = new Map<string, Rollup>();
    for (const inst of instances ?? []) {
      const pid = lookupId(inst, 'dnx_project');
      if (!pid) continue;
      const r = map.get(pid) ?? { total: 0, signedOff: 0, overdue: 0, stalledDrafts: 0, lastUpdated: null };
      r.total += 1;
      const st = instStatus(inst);
      const isComplete = st === 'Complete';
      if (isComplete) r.signedOff += 1;
      if (!isComplete && inst.dnx_duedate && new Date(inst.dnx_duedate).getTime() < startOfToday) {
        r.overdue += 1;
      }
      if (st === 'Draft' && inst.modifiedon) {
        const idle = Math.floor((now - new Date(inst.modifiedon).getTime()) / MS_PER_DAY);
        if (idle >= 7) r.stalledDrafts += 1;
      }
      if (inst.modifiedon) {
        const m = new Date(inst.modifiedon).getTime();
        r.lastUpdated = r.lastUpdated === null ? m : Math.max(r.lastUpdated, m);
      }
      map.set(pid, r);
    }
    return map;
  }, [instances, now]);

  const emptyRollup: Rollup = { total: 0, signedOff: 0, overdue: 0, stalledDrafts: 0, lastUpdated: null };
  const rollupFor = (p: Dnx_projects) => rollups.get(p.dnx_projectid) ?? emptyRollup;

  // Header + filter counts.
  const stats = useMemo(() => {
    const list = projects ?? [];
    let assessments = 0;
    let overdue = 0;
    let overdueProjects = 0;
    let attention = 0;
    let active = 0;
    let empty = 0;
    for (const p of list) {
      const r = rollupFor(p);
      assessments += r.total;
      overdue += r.overdue;
      if (r.overdue > 0) overdueProjects += 1;
      if (r.overdue > 0 || r.stalledDrafts > 0) attention += 1;
      if (projectStatusLabel(p.statuscode) === 'Active') active += 1;
      if (r.total === 0) empty += 1;
    }
    return { projects: list.length, assessments, overdue, overdueProjects, attention, active, empty };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, rollups]);

  // Filter → search → sort.
  const shown = useMemo(() => {
    let list = projects ?? [];
    if (filter === 'attention') {
      list = list.filter((p) => {
        const r = rollupFor(p);
        return r.overdue > 0 || r.stalledDrafts > 0;
      });
    } else if (filter === 'active') {
      list = list.filter((p) => projectStatusLabel(p.statuscode) === 'Active');
    } else if (filter === 'empty') {
      list = list.filter((p) => rollupFor(p).total === 0);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.dnx_project_name ?? '').toLowerCase().includes(q) ||
          (p.dnx_project_code ?? '').toLowerCase().includes(q),
      );
    }
    const scored = (p: Dnx_projects) => {
      const r = rollupFor(p);
      return r.overdue * 100 + r.stalledDrafts * 10;
    };
    return [...list].sort((a, b) => {
      if (sort === 'name') return (a.dnx_project_name ?? '').localeCompare(b.dnx_project_name ?? '');
      if (sort === 'updated') return (rollupFor(b).lastUpdated ?? 0) - (rollupFor(a).lastUpdated ?? 0);
      return scored(b) - scored(a); // needs attention first
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, rollups, filter, search, sort]);

  if (isLoading) return <Spinner label="Loading projects..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const hasProjects = (projects ?? []).length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Projects</h1>
          <div className={styles.subtitle}>
            {stats.projects} project{stats.projects === 1 ? '' : 's'} · {stats.assessments}{' '}
            assessment{stats.assessments === 1 ? '' : 's'}
            {stats.overdue > 0
              ? ` · ${stats.overdue} overdue across ${stats.overdueProjects} project${stats.overdueProjects === 1 ? '' : 's'}`
              : ''}
          </div>
        </div>
        <NewProjectDialog
          trigger={
            <Button appearance="primary" icon={<Add16Regular />} className={styles.primaryBtn}>
              New project
            </Button>
          }
        />
      </div>

      {hasProjects && (
        <div className={styles.toolbar}>
          <SegmentedControl<Filter>
            ariaLabel="Filter projects"
            value={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All', count: stats.projects },
              { key: 'attention', label: 'Needs attention', count: stats.attention },
              { key: 'active', label: 'Active', count: stats.active },
              { key: 'empty', label: 'Empty', count: stats.empty },
            ]}
          />
          <Input
            className={styles.search}
            appearance="outline"
            placeholder="Search projects or codes"
            value={search}
            onChange={(_, d) => setSearch(d.value)}
          />
          <span className={styles.countHint}>{shown.length} shown</span>
          <Dropdown
            className={styles.sort}
            appearance="outline"
            value={SORT_LABEL[sort]}
            selectedOptions={[sort]}
            onOptionSelect={(_, d) => setSort((d.optionValue as SortKey) ?? 'attention')}
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <Option key={k} value={k} text={SORT_LABEL[k]}>
                {SORT_LABEL[k]}
              </Option>
            ))}
          </Dropdown>
        </div>
      )}

      {!hasProjects && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No projects yet</div>
          <div className={styles.emptySub}>
            Projects are the top-level workspace for assessments. Create your first one
            to start authoring templates and capturing responses.
          </div>
          <NewProjectDialog
            trigger={
              <Button appearance="primary" icon={<Add16Regular />} className={styles.primaryBtn}>
                Create your first project
              </Button>
            }
          />
        </div>
      )}

      {hasProjects && (
        <>
          <div className={styles.grid}>
            {shown.map((p) => (
              <ProjectCard key={p.dnx_projectid} styles={styles} project={p} rollup={rollupFor(p)} now={now} />
            ))}
          </div>
          <div className={styles.archiveNote}>
            Projects with no assessments after 14 days are suggested for archive.
          </div>
        </>
      )}
    </div>
  );
}

function ProjectCard({
  styles,
  project,
  rollup,
  now,
}: {
  styles: ReturnType<typeof useStyles>;
  project: Dnx_projects;
  rollup: Rollup;
  now: number;
}) {
  const status = STATUS_STYLES[projectStatusLabel(project.statuscode)] ?? STATUS_STYLES.Unknown;
  const owner = lookupName(project, 'ownerid');
  const pct = rollup.total > 0 ? Math.round((rollup.signedOff / rollup.total) * 100) : 0;

  // Status-line priority: overdue → stalled → empty → on track.
  let lineColor = 'var(--ds-suitable)';
  let lineText = 'On track';
  if (rollup.overdue > 0) {
    lineColor = 'var(--ds-not-suitable)';
    lineText = `${rollup.overdue} overdue`;
  } else if (rollup.stalledDrafts > 0) {
    lineColor = 'var(--ds-pending)';
    lineText = `${rollup.stalledDrafts} stalled draft${rollup.stalledDrafts === 1 ? '' : 's'}`;
  } else if (rollup.total === 0) {
    lineColor = 'var(--ds-text-muted)';
    lineText = 'No assessments yet';
  }

  const updated = relativeTime(rollup.lastUpdated, now);
  const footMeta = updated
    ? `Updated ${updated}`
    : project.createdon
      ? `Created ${relativeTime(new Date(project.createdon).getTime(), now)}`
      : '';

  return (
    <Link to={`/projects/${project.dnx_projectid}`} className={styles.cardLink}>
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardName} title={project.dnx_project_name}>
            {project.dnx_project_name}
          </span>
          <span className={styles.statusPill} style={{ backgroundColor: status.bg, color: status.color }}>
            <span className={styles.statusDot} style={{ backgroundColor: status.dot }} />
            {status.label}
          </span>
        </div>

        <div className={styles.cardMeta}>
          {project.dnx_project_code && <span className={styles.cardCode}>{project.dnx_project_code}</span>}
          {project.dnx_project_code && <span className={styles.metaDot} />}
          <span>{owner ?? 'Unassigned'}</span>
        </div>

        {project.dnx_description ? (
          <div className={styles.cardDesc}>{project.dnx_description}</div>
        ) : (
          <div className={styles.cardDescEmpty}>No description yet.</div>
        )}

        <div className={styles.progressBlock}>
          <div className={styles.progressLabelRow}>
            <span className={styles.progressLabel}>
              <span className={styles.progressLabelStrong}>{rollup.signedOff}</span> of {rollup.total}{' '}
              signed off
            </span>
            <span className={styles.progressPct}>{pct}%</span>
          </div>
          <span className={styles.progressTrack}>
            <span
              className={styles.progressFill}
              style={{ width: `${pct}%`, backgroundColor: 'var(--ds-brand-accent)' }}
            />
          </span>
        </div>

        <div className={styles.cardFoot}>
          <span className={styles.statusLine} style={{ color: lineColor }}>
            <span className={styles.statusLineDot} style={{ backgroundColor: lineColor }} />
            {lineText}
          </span>
          {footMeta && <span className={styles.footMeta}>{footMeta}</span>}
        </div>
      </div>
    </Link>
  );
}
