import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Input,
  Dropdown,
  Option,
  makeStyles,
} from '@fluentui/react-components';
import { ChevronRight16Regular } from '@fluentui/react-icons';
import { useAssessmentInstances } from './api';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName } from '../../lib/dataverse';
import { useCurrentUser } from '../../lib/currentUser';
import { SegmentedControl } from '../../components/SegmentedControl';

/*
 * Assessments — Design System v1.0. A filterable, searchable table grouped by
 * due-date bucket (Overdue / Due this week / Later / No due date). Every figure
 * is computed from the loaded instances; the mockup's per-row "Answered %" is
 * intentionally omitted (not stored on the instance — honesty rule).
 */
const MS_PER_DAY = 86_400_000;
const GRID = '2.6fr 1.4fr 1.2fr 1.1fr 0.9fr';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },
  header: { display: 'flex', flexDirection: 'column', gap: '2px' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtitle: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },

  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  search: {
    flex: 1,
    minWidth: '240px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    height: '40px',
    '::after': { display: 'none' },
    '& input': { borderRadius: '6px', height: '38px', fontSize: 'var(--ds-fs-body)' },
  },
  sort: {
    minWidth: '160px',
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

  /* Table */
  table: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
  },
  thead: {
    display: 'grid',
    gridTemplateColumns: GRID,
    gap: '14px',
    padding: '12px 20px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
    borderBottom: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-base)',
  },
  groupHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-body)',
    backgroundColor: 'var(--ds-surface-base)',
    borderBottom: '1px solid var(--ds-border)',
  },
  groupDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  groupCount: { color: 'var(--ds-text-muted)', fontWeight: 600 },
  row: {
    display: 'grid',
    gridTemplateColumns: GRID,
    gap: '14px',
    padding: '14px 20px',
    alignItems: 'center',
    borderBottom: '1px solid var(--ds-border)',
    textDecoration: 'none',
    color: 'inherit',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':last-child': { borderBottom: 'none' },
  },
  candidate: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  },
  candCol: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  candName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  candSub: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cellMuted: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-body)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dueCol: { display: 'flex', flexDirection: 'column', gap: '1px' },
  dueMain: { fontSize: 'var(--ds-fs-caption)', fontWeight: 600, color: 'var(--ds-text-body)' },
  dueOverdue: { fontSize: 'var(--ds-fs-caption)', fontWeight: 600, color: '#b91c1c' },
  dueSub: { fontSize: '11px', color: 'var(--ds-text-muted)' },
  stageCell: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  stagePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    width: 'fit-content',
  },
  stageDot: { width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 },
  chevron: { color: 'var(--ds-text-muted)', display: 'flex', flexShrink: 0 },
  foot: {
    padding: '14px 20px',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    borderTop: '1px solid var(--ds-border)',
  },
  empty: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px dashed var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
  },
});

type Filter = 'all' | 'mine' | 'overdue' | 'review' | 'drafts' | 'unassigned';
type SortKey = 'due' | 'created' | 'updated' | 'name';

const SORT_LABEL: Record<SortKey, string> = {
  due: 'Sort: due date',
  created: 'Sort: newest first',
  updated: 'Sort: recently updated',
  name: 'Sort: candidate',
};

const STAGE_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  Draft: { label: 'draft', bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)' },
  InProgress: { label: 'in progress', bg: 'var(--ds-brand-accent-soft)', color: 'var(--ds-brand-accent)', dot: 'var(--ds-brand-accent)' },
  PendingReview: { label: 'review', bg: 'var(--ds-pending-soft)', color: '#b45309', dot: 'var(--ds-pending)' },
  Complete: { label: 'signed off', bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)' },
};

function statusName(inst: Dnx_assessment_instances): string {
  return (
    Dnx_assessment_instancesstatuscode[
      inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft'
  );
}

function relativeTime(iso: string | undefined, now: number): string | null {
  if (!iso) return null;
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
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

type Bucket = 'overdue' | 'week' | 'later' | 'none';
const BUCKET_META: Record<Bucket, { label: string; dot: string }> = {
  overdue: { label: 'Overdue', dot: 'var(--ds-not-suitable)' },
  week: { label: 'Due this week', dot: 'var(--ds-pending)' },
  later: { label: 'Later', dot: 'var(--ds-brand-accent)' },
  none: { label: 'No due date', dot: 'var(--ds-text-muted)' },
};

export function AssessmentsListPage() {
  const styles = useStyles();
  const { data, isLoading, error } = useAssessmentInstances();
  const { data: user } = useCurrentUser();
  const myName = user?.fullName;

  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('due');

  const all = useMemo(() => data ?? [], [data]);
  const startOfToday = useMemo(
    () => new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime(),
    [now],
  );
  const endOfWeek = startOfToday + 7 * MS_PER_DAY;

  const isOverdue = (i: Dnx_assessment_instances) =>
    statusName(i) !== 'Complete' && i.dnx_duedate && new Date(i.dnx_duedate).getTime() < startOfToday;

  // Filter-chip counts (computed on the full set).
  const counts = useMemo(() => {
    const c = { all: all.length, mine: 0, overdue: 0, review: 0, drafts: 0, unassigned: 0 };
    for (const i of all) {
      const st = statusName(i);
      if (myName && lookupName(i, 'ownerid') === myName) c.mine += 1;
      if (isOverdue(i)) c.overdue += 1;
      if (st === 'PendingReview') c.review += 1;
      if (st === 'Draft') c.drafts += 1;
      if (!lookupName(i, 'ownerid')) c.unassigned += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, myName, startOfToday]);

  // Apply filter + search.
  const filtered = useMemo(() => {
    let list = all.filter((i) => {
      const st = statusName(i);
      if (filter === 'mine') return myName && lookupName(i, 'ownerid') === myName;
      if (filter === 'overdue') return isOverdue(i);
      if (filter === 'review') return st === 'PendingReview';
      if (filter === 'drafts') return st === 'Draft';
      if (filter === 'unassigned') return !lookupName(i, 'ownerid');
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const name = (i.dnx_assessment_name ?? '').toLowerCase();
        const proj = (lookupName(i, 'dnx_project') ?? '').toLowerCase();
        const tmpl = (lookupName(i, 'dnx_assessmenttemplate') ?? '').toLowerCase();
        return name.includes(q) || proj.includes(q) || tmpl.includes(q);
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filter, search, myName, startOfToday]);

  // Group into due-date buckets, each internally sorted.
  const groups = useMemo(() => {
    const bucketOf = (i: Dnx_assessment_instances): Bucket => {
      if (!i.dnx_duedate) return 'none';
      const d = new Date(i.dnx_duedate).getTime();
      if (isOverdue(i)) return 'overdue';
      if (d < endOfWeek) return 'week';
      return 'later';
    };
    const map: Record<Bucket, Dnx_assessment_instances[]> = { overdue: [], week: [], later: [], none: [] };
    for (const i of filtered) map[bucketOf(i)].push(i);

    const cmp = (a: Dnx_assessment_instances, b: Dnx_assessment_instances) => {
      if (sort === 'name') return (a.dnx_assessment_name ?? '').localeCompare(b.dnx_assessment_name ?? '');
      if (sort === 'created') {
        return (b.createdon ? new Date(b.createdon).getTime() : 0) - (a.createdon ? new Date(a.createdon).getTime() : 0);
      }
      if (sort === 'updated') {
        return (b.modifiedon ? new Date(b.modifiedon).getTime() : 0) - (a.modifiedon ? new Date(a.modifiedon).getTime() : 0);
      }
      const da = a.dnx_duedate ? new Date(a.dnx_duedate).getTime() : Infinity;
      const db = b.dnx_duedate ? new Date(b.dnx_duedate).getTime() : Infinity;
      return da - db;
    };
    (Object.keys(map) as Bucket[]).forEach((k) => map[k].sort(cmp));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, startOfToday, endOfWeek]);

  const orderedBuckets: Bucket[] = ['overdue', 'week', 'later', 'none'];

  if (isLoading) return <Spinner label="Loading assessments..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Assessments</h1>
        <div className={styles.subtitle}>
          {counts.all} assessment{counts.all === 1 ? '' : 's'}
          {counts.overdue > 0 ? ` · ${counts.overdue} overdue` : ''}
          {counts.unassigned > 0 ? ` · ${counts.unassigned} unassigned` : ''}
        </div>
      </div>

      <SegmentedControl<Filter>
        ariaLabel="Filter assessments"
        value={filter}
        onChange={setFilter}
        items={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'mine', label: 'Mine', count: counts.mine },
          { key: 'overdue', label: 'Overdue', count: counts.overdue },
          { key: 'review', label: 'Pending review', count: counts.review },
          { key: 'drafts', label: 'Drafts', count: counts.drafts },
          { key: 'unassigned', label: 'Unassigned', count: counts.unassigned },
        ]}
      />

      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          appearance="outline"
          placeholder="Search candidate, project or code"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
        />
        <Dropdown
          className={styles.sort}
          appearance="outline"
          value={SORT_LABEL[sort]}
          selectedOptions={[sort]}
          onOptionSelect={(_, d) => setSort((d.optionValue as SortKey) ?? 'due')}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <Option key={k} value={k} text={SORT_LABEL[k]}>
              {SORT_LABEL[k]}
            </Option>
          ))}
        </Dropdown>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          {filter === 'all'
            ? 'No assessments yet. Head to a project to start one.'
            : 'No assessments in this view.'}
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.thead}>
            <span>Candidate</span>
            <span>Project</span>
            <span>Assessor</span>
            <span>Due</span>
            <span>Stage</span>
          </div>

          {orderedBuckets.map((bucket) => {
            const rows = groups[bucket];
            if (rows.length === 0) return null;
            const meta = BUCKET_META[bucket];
            return (
              <div key={bucket}>
                <div className={styles.groupHead}>
                  <span className={styles.groupDot} style={{ backgroundColor: meta.dot }} />
                  {meta.label}
                  <span className={styles.groupCount}>{rows.length}</span>
                </div>
                {rows.map((inst) => {
                  const st = statusName(inst);
                  const stage = STAGE_META[st] ?? STAGE_META.Draft;
                  const owner = lookupName(inst, 'ownerid');
                  const proj = lookupName(inst, 'dnx_project') ?? '—';
                  const tmpl = lookupName(inst, 'dnx_assessmenttemplate');
                  const updated = relativeTime(inst.modifiedon, now);
                  const dueMs = inst.dnx_duedate ? new Date(inst.dnx_duedate).getTime() : null;
                  const overdue = bucket === 'overdue';
                  return (
                    <Link
                      key={inst.dnx_assessment_instanceid}
                      to={`/assessments/${inst.dnx_assessment_instanceid}`}
                      className={styles.row}
                    >
                      <span className={styles.candidate}>
                        <span className={styles.avatar}>{initials(owner)}</span>
                        <span className={styles.candCol}>
                          <span className={styles.candName} title={inst.dnx_assessment_name}>
                            {inst.dnx_assessment_name}
                          </span>
                          {tmpl && <span className={styles.candSub}>{tmpl}</span>}
                        </span>
                      </span>
                      <span className={styles.cellMuted} title={proj}>{proj}</span>
                      <span className={styles.cellMuted}>{owner ?? 'Unassigned'}</span>
                      <span className={styles.dueCol}>
                        <span className={overdue ? styles.dueOverdue : styles.dueMain}>
                          {dueMs === null
                            ? 'No due date'
                            : overdue
                              ? `Overdue ${Math.floor((now - dueMs) / MS_PER_DAY)}d`
                              : `Due ${new Date(dueMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                        </span>
                        {updated && <span className={styles.dueSub}>Updated {updated}</span>}
                      </span>
                      <span className={styles.stageCell}>
                        <span className={styles.stagePill} style={{ backgroundColor: stage.bg, color: stage.color }}>
                          <span className={styles.stageDot} style={{ backgroundColor: stage.dot }} />
                          {stage.label}
                        </span>
                        <span className={styles.chevron}>
                          <ChevronRight16Regular />
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}

          <div className={styles.foot}>
            Showing {filtered.length} of {counts.all} · grouped by due date
          </div>
        </div>
      )}
    </div>
  );
}
