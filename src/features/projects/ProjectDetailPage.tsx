import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  Edit16Regular,
  Delete16Regular,
  Add16Regular,
  ChevronRight16Regular,
} from '@fluentui/react-icons';
import { useProject } from './api';
import { EditProjectDialog } from './EditProjectDialog';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { Dnx_projectsstatuscode } from '../../generated/models/Dnx_projectsModel';
import { lookupName } from '../../lib/dataverse';
import { useCurrentUserRoles } from '../../lib/roles';
import { useAssessmentInstancesByProject } from '../assessments/api';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { NewAssessmentDialog } from '../assessments/NewAssessmentDialog';
import { SegmentedControl } from '../../components/SegmentedControl';

/*
 * Project detail — Design System v1.0. Two-column layout: an Assessments card
 * (filterable rich rows) on the left, and a sidebar of rollup cards (Project
 * progress, Health, About) on the right. All figures are computed from this
 * project's assessment instances — honesty rule: no fabricated per-row progress.
 */
const MS_PER_DAY = 86_400_000;

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },

  /* Breadcrumb */
  crumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
  },
  crumbLink: {
    color: 'var(--ds-text-muted)',
    textDecoration: 'none',
    ':hover': { color: 'var(--ds-brand-accent)' },
  },
  crumbSep: { color: 'var(--ds-border)' },
  crumbCurrent: { color: 'var(--ds-text-body)' },

  /* Header */
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-caption)',
    flexWrap: 'wrap',
  },
  code: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
  metaDot: { width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'var(--ds-border)' },
  headerActions: { display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
    ':hover:active': { backgroundColor: '#26384a', color: '#fff' },
  },
  deleteBtn: {
    color: '#b91c1c !important',
    backgroundColor: 'transparent !important',
    border: '1px solid var(--ds-border) !important',
    ':hover': {
      backgroundColor: 'var(--ds-not-suitable-soft) !important',
      border: '1px solid var(--ds-not-suitable) !important',
    },
  },

  /* Status pill */
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },

  /* Two-column */
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '16px',
    alignItems: 'start',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '16px' },

  /* Card */
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  cardTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-heading)' },
  cardTitleWrap: { display: 'flex', alignItems: 'baseline', gap: '8px' },
  cardHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', fontWeight: 400 },

  /* Assessment rows */
  rows: { display: 'flex', flexDirection: 'column' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 0',
    borderTop: '1px solid var(--ds-border)',
    textDecoration: 'none',
    color: 'inherit',
    ':first-of-type': { borderTop: 'none' },
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
  },
  rowMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  rowName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    flexWrap: 'wrap',
  },
  due: { fontWeight: 500 },
  dueOverdue: { color: '#b91c1c', fontWeight: 600 },
  stagePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  },
  stageDot: { width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 },
  chevron: { color: 'var(--ds-text-muted)', display: 'flex', flexShrink: 0 },
  rowsFoot: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', paddingTop: '4px' },
  emptyRows: { padding: '28px 0', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },

  /* Sidebar: progress */
  progBig: {
    fontSize: '30px',
    fontWeight: 700,
    color: 'var(--ds-text-strong)',
    lineHeight: 1,
    letterSpacing: '-0.02em',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  progBigSub: { fontSize: 'var(--ds-fs-body)', fontWeight: 400, color: 'var(--ds-text-muted)' },
  stackBar: { display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', backgroundColor: 'var(--ds-surface-base)' },
  stackSeg: { height: '100%' },
  breakdown: { display: 'flex', flexDirection: 'column', gap: '8px' },
  bRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--ds-fs-body)' },
  bDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  bName: { flex: 1, color: 'var(--ds-text-body)' },
  bVal: { fontWeight: 600, color: 'var(--ds-text-strong)', fontVariantNumeric: 'tabular-nums' },

  /* Sidebar: health */
  healthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: 'var(--ds-fs-body)',
  },
  healthBar: { width: '3px', alignSelf: 'stretch', minHeight: '20px', borderRadius: '2px', flexShrink: 0 },
  healthName: { flex: 1, color: 'var(--ds-text-body)' },
  healthVal: { fontWeight: 700, color: 'var(--ds-text-strong)', fontVariantNumeric: 'tabular-nums' },

  /* Sidebar: about */
  aboutDesc: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)', lineHeight: 1.55 },
  aboutGrid: { display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--ds-border)' },
  aboutRow: { display: 'flex', gap: '12px', fontSize: 'var(--ds-fs-caption)' },
  aboutKey: { color: 'var(--ds-text-muted)', minWidth: '84px', flexShrink: 0 },
  aboutVal: { color: 'var(--ds-text-body)', minWidth: 0, wordBreak: 'break-word' },
});

const PROJECT_STATUS: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Active: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'Active' },
  OnHold: { bg: 'var(--ds-pending-soft)', color: '#b45309', dot: 'var(--ds-pending)', label: 'On hold' },
  Archived: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'Archived' },
  Inactive: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'Inactive' },
  Unknown: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', dot: 'var(--ds-text-muted)', label: 'Draft' },
};

const STAGE_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  Draft: { label: 'draft', bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)' },
  InProgress: { label: 'in progress', bg: 'var(--ds-brand-accent-soft)', color: 'var(--ds-brand-accent)', dot: 'var(--ds-brand-accent)' },
  PendingReview: { label: 'review', bg: 'var(--ds-pending-soft)', color: '#b45309', dot: 'var(--ds-pending)' },
  Complete: { label: 'signed off', bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)' },
};

type Filter = 'open' | 'review' | 'signed' | 'all';

function instStatus(inst: Dnx_assessment_instances): string {
  return (
    Dnx_assessment_instancesstatuscode[
      inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft'
  );
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

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function ProjectDetailPage() {
  const styles = useStyles();
  const roles = useCurrentUserRoles();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading, error } = useProject(projectId);
  const { data: assessments } = useAssessmentInstancesByProject(projectId);

  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('open');

  const all = useMemo(() => assessments ?? [], [assessments]);

  const summary = useMemo(() => {
    const startOfToday = new Date(
      new Date(now).getFullYear(),
      new Date(now).getMonth(),
      new Date(now).getDate(),
    ).getTime();
    let signedOff = 0;
    let inProgress = 0;
    let draft = 0;
    let review = 0;
    let overdue = 0;
    let withData = 0;
    let lastActivity: number | null = null;
    let lastActivityBy: string | undefined;
    let templateName: string | undefined;
    const turnarounds: number[] = [];

    for (const inst of all) {
      const st = instStatus(inst);
      if (st === 'Complete') signedOff += 1;
      else if (st === 'InProgress') inProgress += 1;
      else if (st === 'PendingReview') review += 1;
      else if (st === 'Draft') draft += 1;

      if (st !== 'Complete' && inst.dnx_duedate && new Date(inst.dnx_duedate).getTime() < startOfToday) {
        overdue += 1;
      }
      if (inst.dnx_application_details_name) withData += 1;
      if (!templateName) templateName = lookupName(inst, 'dnx_assessmenttemplate');

      if (inst.modifiedon) {
        const m = new Date(inst.modifiedon).getTime();
        if (lastActivity === null || m > lastActivity) {
          lastActivity = m;
          lastActivityBy = lookupName(inst, 'ownerid');
        }
      }
      if (st === 'Complete' && inst.modifiedon && inst.createdon) {
        const days = (new Date(inst.modifiedon).getTime() - new Date(inst.createdon).getTime()) / MS_PER_DAY;
        if (days >= 0) turnarounds.push(days);
      }
    }

    turnarounds.sort((a, b) => a - b);
    const median =
      turnarounds.length === 0
        ? null
        : turnarounds.length % 2
          ? turnarounds[(turnarounds.length - 1) / 2]
          : (turnarounds[turnarounds.length / 2 - 1] + turnarounds[turnarounds.length / 2]) / 2;

    return {
      total: all.length,
      signedOff,
      inProgress,
      draft,
      review,
      overdue,
      withData,
      medianTurnaround: median,
      lastActivity,
      lastActivityBy,
      templateName,
    };
  }, [all, now]);

  const counts = {
    open: summary.inProgress + summary.draft,
    review: summary.review,
    signed: summary.signedOff,
    all: summary.total,
  };

  const filtered = useMemo(() => {
    const rows = all.filter((i) => {
      const st = instStatus(i);
      if (filter === 'open') return st === 'InProgress' || st === 'Draft';
      if (filter === 'review') return st === 'PendingReview';
      if (filter === 'signed') return st === 'Complete';
      return true;
    });
    // Overdue first, then by due date, then most-recently updated.
    return [...rows].sort((a, b) => {
      const am = a.modifiedon ? new Date(a.modifiedon).getTime() : 0;
      const bm = b.modifiedon ? new Date(b.modifiedon).getTime() : 0;
      return bm - am;
    });
  }, [all, filter]);

  if (isLoading) return <Spinner label="Loading project..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!project) return null;

  const status =
    PROJECT_STATUS[
      Dnx_projectsstatuscode[project.statuscode as keyof typeof Dnx_projectsstatuscode] ?? 'Unknown'
    ] ?? PROJECT_STATUS.Unknown;
  const owner = lookupName(project, 'ownerid');
  const updated = relativeTime(summary.lastActivity, now);

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}>
        <Link to="/projects" className={styles.crumbLink}>Projects</Link>
        <span className={styles.crumbSep}>/</span>
        <span className={styles.crumbCurrent}>{project.dnx_project_name}</span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{project.dnx_project_name}</h1>
            <span className={styles.statusPill} style={{ backgroundColor: status.bg, color: status.color }}>
              <span className={styles.statusDot} style={{ backgroundColor: status.dot }} />
              {status.label}
            </span>
          </div>
          <div className={styles.metaRow}>
            {project.dnx_project_code && <span className={styles.code}>{project.dnx_project_code}</span>}
            {project.dnx_project_code && <span className={styles.metaDot} />}
            <span>Owner {owner ?? 'Unassigned'}</span>
            {updated && <span className={styles.metaDot} />}
            {updated && <span>Updated {updated}</span>}
          </div>
        </div>
        <div className={styles.headerActions}>
          <EditProjectDialog
            project={project}
            assessmentCount={summary.total}
            trigger={<Button appearance="secondary" icon={<Edit16Regular />}>Edit</Button>}
          />
          {roles.canAdmin && (
            <DeleteProjectDialog
              projectId={project.dnx_projectid}
              projectName={project.dnx_project_name}
              trigger={
                <Button
                  appearance="secondary"
                  icon={<Delete16Regular />}
                  className={styles.deleteBtn}
                >
                  Delete
                </Button>
              }
            />
          )}
          <NewAssessmentDialog
            projectId={project.dnx_projectid}
            projectName={project.dnx_project_name}
            trigger={
              <Button appearance="primary" icon={<Add16Regular />} className={styles.primaryBtn}>
                Start assessment
              </Button>
            }
          />
        </div>
      </div>

      {/* Two columns */}
      <div className={styles.body}>
        {/* Main: assessments */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitleWrap}>
              <span className={styles.cardTitle}>Assessments</span>
              <span className={styles.cardHint}>{filtered.length} shown</span>
            </span>
            <SegmentedControl<Filter>
              ariaLabel="Filter assessments"
              value={filter}
              onChange={setFilter}
              items={[
                { key: 'open', label: 'Open', count: counts.open },
                { key: 'review', label: 'Review', count: counts.review },
                { key: 'signed', label: 'Signed off', count: counts.signed },
                { key: 'all', label: 'All', count: counts.all },
              ]}
            />
          </div>

          {filtered.length === 0 ? (
            <div className={styles.emptyRows}>
              {summary.total === 0
                ? 'No assessments started yet. Pick a published template to begin.'
                : 'Nothing in this view.'}
            </div>
          ) : (
            <>
              <div className={styles.rows}>
                {filtered.map((inst) => {
                  const st = instStatus(inst);
                  const meta = STAGE_META[st] ?? STAGE_META.Draft;
                  const rowOwner = lookupName(inst, 'ownerid');
                  const rowUpdated = relativeTime(
                    inst.modifiedon ? new Date(inst.modifiedon).getTime() : null,
                    now,
                  );
                  const dueMs = inst.dnx_duedate ? new Date(inst.dnx_duedate).getTime() : null;
                  const overdue = dueMs !== null && dueMs < now && st !== 'Complete';
                  return (
                    <Link
                      key={inst.dnx_assessment_instanceid}
                      to={`/assessments/${inst.dnx_assessment_instanceid}`}
                      className={styles.row}
                    >
                      <span className={styles.avatar}>{initials(rowOwner)}</span>
                      <span className={styles.rowMain}>
                        <span className={styles.rowName} title={inst.dnx_assessment_name}>
                          {inst.dnx_assessment_name}
                        </span>
                        <span className={styles.rowMeta}>
                          <span className={overdue ? styles.dueOverdue : styles.due}>
                            {dueMs === null
                              ? 'No due date'
                              : overdue
                                ? `Overdue ${Math.floor((now - dueMs) / MS_PER_DAY)}d`
                                : `Due ${new Date(dueMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                          </span>
                          {rowUpdated && <span className={styles.metaDot} />}
                          {rowUpdated && <span>Updated {rowUpdated}</span>}
                          <span className={styles.metaDot} />
                          <span>{rowOwner ?? 'Unassigned'}</span>
                        </span>
                      </span>
                      <span className={styles.stagePill} style={{ backgroundColor: meta.bg, color: meta.color }}>
                        <span className={styles.stageDot} style={{ backgroundColor: meta.dot }} />
                        {meta.label}
                      </span>
                      <span className={styles.chevron}>
                        <ChevronRight16Regular />
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className={styles.rowsFoot}>
                Assessments inherit this project's template and evidence schema.
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Project progress */}
          <div className={styles.card}>
            <span className={styles.cardTitle}>Project progress</span>
            <span className={styles.progBig}>
              {summary.signedOff}
              <span className={styles.progBigSub}>of {summary.total} signed off</span>
            </span>
            {summary.total > 0 && (
              <div className={styles.stackBar}>
                <div className={styles.stackSeg} style={{ width: `${(summary.signedOff / summary.total) * 100}%`, backgroundColor: 'var(--ds-suitable)' }} />
                <div className={styles.stackSeg} style={{ width: `${((summary.inProgress + summary.review) / summary.total) * 100}%`, backgroundColor: 'var(--ds-brand-accent)' }} />
                <div className={styles.stackSeg} style={{ width: `${(summary.draft / summary.total) * 100}%`, backgroundColor: 'var(--ds-text-muted)' }} />
              </div>
            )}
            <div className={styles.breakdown}>
              <div className={styles.bRow}>
                <span className={styles.bDot} style={{ backgroundColor: 'var(--ds-suitable)' }} />
                <span className={styles.bName}>Signed off</span>
                <span className={styles.bVal}>{summary.signedOff}</span>
              </div>
              <div className={styles.bRow}>
                <span className={styles.bDot} style={{ backgroundColor: 'var(--ds-brand-accent)' }} />
                <span className={styles.bName}>In progress</span>
                <span className={styles.bVal}>{summary.inProgress + summary.review}</span>
              </div>
              <div className={styles.bRow}>
                <span className={styles.bDot} style={{ backgroundColor: 'var(--ds-text-muted)' }} />
                <span className={styles.bName}>Draft</span>
                <span className={styles.bVal}>{summary.draft}</span>
              </div>
            </div>
          </div>

          {/* Health */}
          <div className={styles.card}>
            <span className={styles.cardTitle}>Health</span>
            <div className={styles.healthRow}>
              <span className={styles.healthBar} style={{ backgroundColor: summary.overdue > 0 ? 'var(--ds-not-suitable)' : 'var(--ds-suitable)' }} />
              <span className={styles.healthName}>Overdue</span>
              <span className={styles.healthVal}>{summary.overdue}</span>
            </div>
            <div className={styles.healthRow}>
              <span className={styles.healthBar} style={{ backgroundColor: 'var(--ds-brand-accent)' }} />
              <span className={styles.healthName}>Median turnaround</span>
              <span className={styles.healthVal}>
                {summary.medianTurnaround === null ? '—' : `${summary.medianTurnaround.toFixed(1)}d`}
              </span>
            </div>
            <div className={styles.healthRow}>
              <span className={styles.healthBar} style={{ backgroundColor: 'var(--ds-pending)' }} />
              <span className={styles.healthName}>Application data attached</span>
              <span className={styles.healthVal}>
                {summary.withData} / {summary.total}
              </span>
            </div>
          </div>

          {/* About */}
          <div className={styles.card}>
            <span className={styles.cardTitle}>About</span>
            {project.dnx_description ? (
              <div className={styles.aboutDesc}>{project.dnx_description}</div>
            ) : (
              <div className={styles.aboutDesc} style={{ color: 'var(--ds-text-muted)', fontStyle: 'italic' }}>
                No description yet.
              </div>
            )}
            <div className={styles.aboutGrid}>
              {summary.templateName && (
                <div className={styles.aboutRow}>
                  <span className={styles.aboutKey}>Template</span>
                  <span className={styles.aboutVal}>{summary.templateName}</span>
                </div>
              )}
              <div className={styles.aboutRow}>
                <span className={styles.aboutKey}>Created</span>
                <span className={styles.aboutVal}>
                  {project.createdon ? new Date(project.createdon).toLocaleDateString() : '—'}
                  {lookupName(project, 'createdby') ? ` by ${lookupName(project, 'createdby')}` : ''}
                </span>
              </div>
              <div className={styles.aboutRow}>
                <span className={styles.aboutKey}>Last activity</span>
                <span className={styles.aboutVal}>
                  {updated ? updated : '—'}
                  {summary.lastActivityBy ? ` · ${summary.lastActivityBy}` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
