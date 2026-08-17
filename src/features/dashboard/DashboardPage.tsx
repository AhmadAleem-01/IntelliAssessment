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
import { Sparkle20Filled } from '@fluentui/react-icons';
import { useAssessmentInstances } from '../assessments/api';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName } from '../../lib/dataverse';
import { useCurrentUser } from '../../lib/currentUser';
import { SegmentedControl } from '../../components/SegmentedControl';

/*
 * Dashboard — "Today" operational view (Design System v1.0, "Calm Efficiency").
 *
 * Every number here is computed from the assessment instances already loaded —
 * no extra queries, and nothing fabricated: metrics the data model can't back
 * (median days-in-stage, assessor capacity, first-pass approval %) are omitted
 * rather than faked. "Mine" = assessments owned by the signed-in user, matched
 * by owner display name (same basis as the workload rollup).
 */
const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },

  /* Header + scope toggle */
  headerRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  header: { display: 'flex', flexDirection: 'column', gap: '2px' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subtitle: { color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },
  headerControls: { display: 'flex', alignItems: 'center', gap: '10px' },
  // Date-range dropdown styled to sit beside the segmented control as a peer
  // pill (matches the mockup's "Last 30 days ▾"). Border lives on the root only
  // — the inner button is transparent — so Fluent's own border + ours don't
  // stack into a double edge. `::after` (focus underline) is killed too.
  rangeDropdown: {
    minWidth: '150px',
    borderRadius: '12px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& button': {
      border: 'none',
      backgroundColor: 'transparent',
      padding: '9px 14px',
      fontSize: 'var(--ds-fs-body)',
      fontWeight: 500,
      color: 'var(--ds-text-strong)',
    },
  },

  /* Generic card */
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '8px',
  },
  cardTitle: {
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-heading)',
  },
  cardHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  /* Top row: needs-attention + AI hero */
  topRow: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '16px',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },

  /* Needs attention rows */
  attnRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 0',
    borderTop: '1px solid var(--ds-border)',
    ':first-of-type': { borderTop: 'none', paddingTop: 0 },
  },
  attnBar: { width: '3px', alignSelf: 'stretch', borderRadius: '2px', flexShrink: 0 },
  attnNum: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--ds-text-strong)',
    minWidth: '28px',
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
  attnBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  attnLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  attnSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  attnAction: {
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-brand-accent)',
    textDecoration: 'none',
    padding: '5px 12px',
    borderRadius: 'var(--ds-radius-pill)',
    border: '1px solid var(--ds-brand-accent-soft)',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    flexShrink: 0,
    ':hover': { backgroundColor: 'var(--ds-surface-card)' },
  },
  attnEmpty: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    padding: '18px 0',
    textAlign: 'center',
  },

  /* AI pre-assessment hero (dark) */
  aiHero: {
    backgroundColor: 'var(--ds-brand-primary)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '22px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 0 0 1px rgba(139,92,246,0.35), 0 8px 30px -12px rgba(139,92,246,0.5)',
  },
  aiHeroTop: { display: 'inline-flex', alignItems: 'center', gap: '10px' },
  aiHeroIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-ai-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aiHeroTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: '#fff' },
  aiHeroBig: {
    fontSize: '40px',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    color: '#fff',
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
  },
  aiHeroBigSub: { fontSize: 'var(--ds-fs-body)', fontWeight: 400, color: 'rgba(255,255,255,0.7)' },
  aiTrack: {
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  aiFill: { height: '100%', borderRadius: '999px', backgroundColor: 'var(--ds-ai-primary)' },
  aiHeroNote: { fontSize: 'var(--ds-fs-caption)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 },
  aiHeroActions: { display: 'flex', gap: '10px', marginTop: '2px' },
  aiBtnPrimary: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 'var(--border-radius-md)',
    border: 'none',
    backgroundColor: 'var(--ds-ai-primary)',
    color: '#fff',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center',
    ':hover': { backgroundColor: '#7c46f0' },
  },
  aiBtnGhost: {
    padding: '10px 16px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid rgba(255,255,255,0.25)',
    backgroundColor: 'transparent',
    color: '#fff',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none',
    ':hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
  },

  /* Mid row: pipeline + outcomes */
  midRow: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '16px',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  pipeGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
  pipeCell: {
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pipeLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-muted)',
  },
  pipeNum: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--ds-text-strong)',
    lineHeight: 1,
    letterSpacing: '-0.01em',
  },
  pipeBar: {
    display: 'block',
    height: '4px',
    borderRadius: '2px',
    backgroundColor: 'var(--ds-surface-base)',
    overflow: 'hidden',
  },
  pipeBarFill: { display: 'block', height: '100%', borderRadius: '2px', minWidth: '3px' },

  /* Outcomes */
  stackBar: {
    display: 'flex',
    height: '10px',
    borderRadius: '999px',
    overflow: 'hidden',
    backgroundColor: 'var(--ds-surface-base)',
  },
  stackSeg: { height: '100%' },
  outcomeLegend: { display: 'flex', flexDirection: 'column', gap: '8px' },
  outcomeRow: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--ds-fs-body)' },
  outcomeDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  outcomeName: { flex: 1, color: 'var(--ds-text-body)' },
  outcomeVal: { fontWeight: 600, color: 'var(--ds-text-strong)', fontVariantNumeric: 'tabular-nums' },
  outcomePct: { color: 'var(--ds-text-muted)', minWidth: '40px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  loadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: 'var(--ds-fs-caption)',
    paddingTop: '10px',
    borderTop: '1px solid var(--ds-border)',
  },
  loadName: { flex: 1, color: 'var(--ds-text-body)' },
  loadCount: { color: 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums' },

  /* Stat trio (folded inside the Pipeline card) */
  statLabel: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', fontWeight: 500 },
  statValue: {
    fontSize: '26px',
    fontWeight: 700,
    color: 'var(--ds-text-strong)',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
  },
  statSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  statValueRow: { display: 'flex', alignItems: 'baseline', gap: '8px' },
  statDelta: { fontSize: 'var(--ds-fs-caption)', fontWeight: 600 },
  statDeltaUp: { color: 'var(--ds-suitable)' },
  statDeltaDown: { color: 'var(--ds-not-suitable)' },
  statDeltaFlat: { color: 'var(--ds-text-muted)' },
  // Stat trio folded inside the Pipeline card, divided from the cells above.
  pipeStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    paddingTop: '18px',
    marginTop: '4px',
    borderTop: '1px solid var(--ds-border)',
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  pipeStat: { display: 'flex', flexDirection: 'column', gap: '4px' },

  /* My queue */
  queueControls: { display: 'flex', alignItems: 'center', gap: '10px' },
  // Boxy, open controls (matches the mockup): squarer 6px corners, taller,
  // light border, no Fluent underline.
  queueSearch: {
    minWidth: '300px',
    borderRadius: '6px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    height: '40px',
    '::after': { display: 'none' },
    '& input': {
      borderRadius: '6px',
      height: '38px',
      fontSize: 'var(--ds-fs-body)',
      color: 'var(--ds-text-strong)',
    },
  },
  queueSort: {
    minWidth: '150px',
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
  table: { display: 'flex', flexDirection: 'column' },
  thead: {
    display: 'grid',
    gridTemplateColumns: '2.6fr 1.4fr 1fr 1fr 0.6fr',
    gap: '12px',
    padding: '10px 4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-text-muted)',
    borderBottom: '1px solid var(--ds-border)',
  },
  trow: {
    display: 'grid',
    gridTemplateColumns: '2.6fr 1.4fr 1fr 1fr 0.6fr',
    gap: '12px',
    padding: '12px 4px',
    alignItems: 'center',
    borderBottom: '1px solid var(--ds-border)',
    textDecoration: 'none',
    color: 'inherit',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':last-child': { borderBottom: 'none' },
  },
  cellName: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  avatarSm: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  },
  nameCol: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  nameText: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameMeta: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cellMuted: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stagePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 9px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    width: 'fit-content',
  },
  stageDot: { width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 },
  dueOverdue: { color: '#b91c1c', fontWeight: 600, fontSize: 'var(--ds-fs-caption)' },
  dueNormal: { color: 'var(--ds-text-body)', fontSize: 'var(--ds-fs-caption)' },
  ageCell: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  queueEmpty: { padding: '32px 0', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: 'var(--ds-fs-body)' },
});

type Scope = 'all' | 'mine' | 'risk';
type SortKey = 'oldest' | 'due';
type RangeKey = '7' | '30' | '90' | 'all';

const RANGE_DAYS: Record<RangeKey, number | null> = { '7': 7, '30': 30, '90': 90, all: null };
const RANGE_LABEL: Record<RangeKey, string> = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
};

const STATUS_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  Draft: { label: 'draft', bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)' },
  InProgress: { label: 'in progress', bg: 'var(--ds-brand-accent-soft)', color: 'var(--ds-brand-accent)', dot: 'var(--ds-brand-accent)' },
  PendingReview: { label: 'review', bg: 'var(--ds-pending-soft)', color: '#b45309', dot: 'var(--ds-pending)' },
  Complete: { label: 'signed off', bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)' },
};

const MS_PER_DAY = 86_400_000;

function statusName(inst: Dnx_assessment_instances): string {
  return (
    Dnx_assessment_instancesstatuscode[
      inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft'
  );
}

function daysSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / MS_PER_DAY);
}

/** Compact "updated" label: 2h / 5h / 3d / 2w ago. Null when no timestamp. */
function relativeTime(iso: string | undefined, now: number): string | null {
  if (!iso) return null;
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function DashboardPage() {
  const styles = useStyles();
  const { data: instances, isLoading, error } = useAssessmentInstances();
  const { data: user } = useCurrentUser();
  const myName = user?.fullName;

  const [scope, setScope] = useState<Scope>('all');
  const [range, setRange] = useState<RangeKey>('30');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('oldest');

  // Snapshot "now" once at mount — stable across renders (dashboard is a
  // point-in-time view; a lazy useState initializer keeps it out of the render
  // body so it stays pure).
  const [now] = useState(() => Date.now());
  const allInstances = useMemo(() => instances ?? [], [instances]);

  // Date-range base filter (by creation date) — applied before scope so the
  // whole page, including the toggle counts, reflects the chosen window.
  const all = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (days === null) return allInstances;
    const cutoff = now - days * MS_PER_DAY;
    return allInstances.filter((i) => {
      if (!i.createdon) return true;
      return new Date(i.createdon).getTime() >= cutoff;
    });
  }, [allInstances, range, now]);

  // Scope counts (for the toggle labels): all, mine (owner = me), at-risk
  // (open + overdue). Computed on the range-filtered set.
  const scopeCounts = useMemo(() => {
    let mine = 0;
    let risk = 0;
    for (const inst of all) {
      if (myName && lookupName(inst, 'ownerid') === myName) mine += 1;
      const st = statusName(inst);
      const open = st !== 'Complete';
      if (open && inst.dnx_duedate && new Date(inst.dnx_duedate).getTime() < now) risk += 1;
    }
    return { all: all.length, mine, risk };
  }, [all, myName, now]);

  // The working set the whole page reflects, per the active scope.
  const scoped = useMemo(() => {
    if (scope === 'mine') {
      return all.filter((i) => myName && lookupName(i, 'ownerid') === myName);
    }
    if (scope === 'risk') {
      return all.filter((i) => {
        const open = statusName(i) !== 'Complete';
        return open && i.dnx_duedate && new Date(i.dnx_duedate).getTime() < now;
      });
    }
    return all;
  }, [all, scope, myName, now]);

  const summary = useMemo(() => summarise(scoped, now), [scoped, now]);

  // My queue: open (non-complete) items in scope, filtered by search, sorted.
  const queue = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = scoped.filter((i) => statusName(i) !== 'Complete');
    if (q) {
      rows = rows.filter((i) => {
        const name = (i.dnx_assessment_name ?? '').toLowerCase();
        const proj = (lookupName(i, 'dnx_project') ?? '').toLowerCase();
        return name.includes(q) || proj.includes(q);
      });
    }
    rows = [...rows].sort((a, b) => {
      if (sort === 'due') {
        const da = a.dnx_duedate ? new Date(a.dnx_duedate).getTime() : Infinity;
        const db = b.dnx_duedate ? new Date(b.dnx_duedate).getTime() : Infinity;
        return da - db;
      }
      // oldest first by creation
      const ca = a.createdon ? new Date(a.createdon).getTime() : now;
      const cb = b.createdon ? new Date(b.createdon).getTime() : now;
      return ca - cb;
    });
    return rows.slice(0, 12);
  }, [scoped, search, sort, now]);

  if (isLoading) return <Spinner label="Loading dashboard..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const attnTotal = summary.overdue + summary.stalled + summary.unassigned;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div className={styles.header}>
          <h1 className={styles.title}>Today</h1>
          <div className={styles.subtitle}>
            {summary.open} open assessment{summary.open === 1 ? '' : 's'}
            {summary.overdue > 0 ? ` · ${summary.overdue} need action now` : ''}
          </div>
        </div>
        <div className={styles.headerControls}>
          <SegmentedControl<Scope>
            ariaLabel="Scope"
            value={scope}
            onChange={setScope}
            items={[
              { key: 'all', label: 'All', count: scopeCounts.all },
              { key: 'mine', label: 'Mine', count: scopeCounts.mine },
              { key: 'risk', label: 'At risk', count: scopeCounts.risk },
            ]}
          />
          <Dropdown
            className={styles.rangeDropdown}
            value={RANGE_LABEL[range]}
            selectedOptions={[range]}
            onOptionSelect={(_, d) => setRange((d.optionValue as RangeKey) ?? '30')}
            aria-label="Date range"
          >
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <Option key={k} value={k} text={RANGE_LABEL[k]}>
                {RANGE_LABEL[k]}
              </Option>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Top row: needs attention + AI pre-assessment */}
      <div className={styles.topRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Needs attention</span>
            <span className={styles.cardHint}>{attnTotal} item{attnTotal === 1 ? '' : 's'}</span>
          </div>
          {attnTotal === 0 ? (
            <div className={styles.attnEmpty}>Nothing needs attention right now.</div>
          ) : (
            <div>
              {summary.overdue > 0 && (
                <AttnRow
                  styles={styles}
                  color="var(--ds-not-suitable)"
                  count={summary.overdue}
                  label="Overdue"
                  sub={
                    summary.oldestOverdueDays !== null
                      ? `Oldest is ${summary.oldestOverdueDays} days past due`
                      : 'Past their due date'
                  }
                  action="Review"
                />
              )}
              {summary.stalled > 0 && (
                <AttnRow
                  styles={styles}
                  color="var(--ds-pending)"
                  count={summary.stalled}
                  label="Stalled 7+ days"
                  sub="No activity in over a week"
                  action="Nudge"
                />
              )}
              {summary.unassigned > 0 && (
                <AttnRow
                  styles={styles}
                  color="var(--ds-brand-accent)"
                  count={summary.unassigned}
                  label="Unassigned"
                  sub="No owner set"
                  action="Assign"
                />
              )}
            </div>
          )}
        </div>

        {/* AI pre-assessment hero */}
        <div className={styles.aiHero}>
          <div className={styles.aiHeroTop}>
            <span className={styles.aiHeroIcon}>
              <Sparkle20Filled />
            </span>
            <span className={styles.aiHeroTitle}>AI pre-assessment</span>
          </div>
          <div className={styles.aiHeroBig}>
            {summary.aiReady}
            <span className={styles.aiHeroBigSub}>of {summary.total} ready to run</span>
          </div>
          <div className={styles.aiTrack}>
            <div
              className={styles.aiFill}
              style={{
                width: `${summary.total > 0 ? Math.round((summary.aiReady / summary.total) * 100) : 0}%`,
              }}
            />
          </div>
          <div className={styles.aiHeroNote}>
            {summary.aiBlocked > 0
              ? `${summary.aiBlocked} blocked: application data not attached.`
              : 'All in-scope assessments have application data attached.'}
          </div>
          <div className={styles.aiHeroActions}>
            <Link to="/assessments" className={styles.aiBtnPrimary}>
              {summary.aiReady > 0 ? `Run AI on ${summary.aiReady}` : 'Review assessments'}
            </Link>
            {summary.aiBlocked > 0 && (
              <Link to="/assessments" className={styles.aiBtnGhost}>
                See blocked
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mid row: pipeline + outcomes */}
      <div className={styles.midRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Pipeline</span>
            <span className={styles.cardHint}>{summary.total} in scope</span>
          </div>
          <div className={styles.pipeGrid}>
            <PipeCell styles={styles} label="Draft" n={summary.pipe.draft} total={summary.total} color="var(--ds-text-muted)" />
            <PipeCell styles={styles} label="In progress" n={summary.pipe.inProgress} total={summary.total} color="var(--ds-brand-accent)" />
            <PipeCell styles={styles} label="Review" n={summary.pipe.review} total={summary.total} color="var(--ds-pending)" />
            <PipeCell styles={styles} label="Signed off" n={summary.pipe.complete} total={summary.total} color="var(--ds-suitable)" />
          </div>

          {/* Folded stat trio (matches the mockup's bottom row). */}
          <div className={styles.pipeStats}>
            <div className={styles.pipeStat}>
              <span className={styles.statLabel}>Signed off this week</span>
              <span className={styles.statValueRow}>
                <span className={styles.statValue}>{summary.signedOffThisWeek}</span>
                {summary.signedOffDelta !== 0 && (
                  <span
                    className={`${styles.statDelta} ${summary.signedOffDelta > 0 ? styles.statDeltaUp : styles.statDeltaDown}`}
                  >
                    {summary.signedOffDelta > 0 ? '+' : ''}
                    {summary.signedOffDelta}
                  </span>
                )}
              </span>
              <span className={styles.statSub}>vs last week</span>
            </div>
            <div className={styles.pipeStat}>
              <span className={styles.statLabel}>Median turnaround</span>
              <span className={styles.statValue}>
                {summary.medianTurnaround === null
                  ? '—'
                  : `${summary.medianTurnaround.toFixed(1)} days`}
              </span>
              <span className={styles.statSub}>
                {summary.completedCount > 0
                  ? `Created → signed off · ${summary.completedCount} completed`
                  : 'Created → signed off'}
              </span>
            </div>
            <div className={styles.pipeStat}>
              <span className={styles.statLabel}>AI-ready</span>
              <span className={styles.statValue}>
                {summary.total > 0 ? Math.round((summary.aiReady / summary.total) * 100) : 0}%
              </span>
              <span className={styles.statSub}>Have application data</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Outcomes</span>
            <span className={styles.cardHint}>
              {summary.decided} decided · {summary.pipe.complete} signed off
            </span>
          </div>
          {summary.decided === 0 ? (
            <div className={styles.attnEmpty}>No outcomes recorded yet.</div>
          ) : (
            <>
              <div className={styles.stackBar}>
                <div
                  className={styles.stackSeg}
                  style={{ width: `${(summary.suitable / summary.decided) * 100}%`, backgroundColor: 'var(--ds-suitable)' }}
                />
                <div
                  className={styles.stackSeg}
                  style={{ width: `${(summary.notSuitable / summary.decided) * 100}%`, backgroundColor: 'var(--ds-not-suitable)' }}
                />
              </div>
              <div className={styles.outcomeLegend}>
                <div className={styles.outcomeRow}>
                  <span className={styles.outcomeDot} style={{ backgroundColor: 'var(--ds-suitable)' }} />
                  <span className={styles.outcomeName}>Suitable</span>
                  <span className={styles.outcomeVal}>{summary.suitable}</span>
                  <span className={styles.outcomePct}>
                    {Math.round((summary.suitable / summary.decided) * 100)}%
                  </span>
                </div>
                <div className={styles.outcomeRow}>
                  <span className={styles.outcomeDot} style={{ backgroundColor: 'var(--ds-not-suitable)' }} />
                  <span className={styles.outcomeName}>Not suitable</span>
                  <span className={styles.outcomeVal}>{summary.notSuitable}</span>
                  <span className={styles.outcomePct}>
                    {Math.round((summary.notSuitable / summary.decided) * 100)}%
                  </span>
                </div>
              </div>
            </>
          )}
          {summary.load.length > 0 && (
            <div>
              {summary.load.map((l) => (
                <div key={l.name} className={styles.loadRow}>
                  <span className={styles.loadName}>{l.name}</span>
                  <span className={styles.loadCount}>{l.open} open</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My queue */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>
            {scope === 'mine' ? 'My queue' : 'Work queue'}{' '}
            <span className={styles.cardHint}>{queue.length} shown</span>
          </span>
          <div className={styles.queueControls}>
            <Input
              className={styles.queueSearch}
              appearance="outline"
              size="small"
              placeholder="Search name or project"
              value={search}
              onChange={(_, d) => setSearch(d.value)}
            />
            <Dropdown
              className={styles.queueSort}
              appearance="outline"
              size="small"
              value={sort === 'oldest' ? 'Sort: oldest' : 'Sort: due date'}
              selectedOptions={[sort]}
              onOptionSelect={(_, d) => setSort((d.optionValue as SortKey) ?? 'oldest')}
            >
              <Option value="oldest" text="Sort: oldest">Sort: oldest</Option>
              <Option value="due" text="Sort: due date">Sort: due date</Option>
            </Dropdown>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className={styles.queueEmpty}>Nothing open in this view.</div>
        ) : (
          <div className={styles.table}>
            <div className={styles.thead}>
              <span>Assessment</span>
              <span>Project</span>
              <span>Stage</span>
              <span>Due</span>
              <span style={{ textAlign: 'right' }}>Age</span>
            </div>
            {queue.map((inst) => {
              const st = statusName(inst);
              const meta = STATUS_META[st] ?? STATUS_META.Draft;
              const owner = lookupName(inst, 'ownerid');
              const proj = lookupName(inst, 'dnx_project') ?? '—';
              const age = daysSince(inst.createdon, now);
              const dueMs = inst.dnx_duedate ? new Date(inst.dnx_duedate).getTime() : null;
              const overdue = dueMs !== null && dueMs < now && st !== 'Complete';
              const updated = relativeTime(inst.modifiedon, now);
              return (
                <Link
                  key={inst.dnx_assessment_instanceid}
                  to={`/assessments/${inst.dnx_assessment_instanceid}`}
                  className={styles.trow}
                >
                  <span className={styles.cellName}>
                    <span className={styles.avatarSm}>{initials(owner)}</span>
                    <span className={styles.nameCol}>
                      <span className={styles.nameText} title={inst.dnx_assessment_name}>
                        {inst.dnx_assessment_name}
                      </span>
                      <span className={styles.nameMeta}>
                        {owner ?? 'Unassigned'}
                        {updated ? ` · updated ${updated}` : ''}
                      </span>
                    </span>
                  </span>
                  <span className={styles.cellMuted} title={proj}>{proj}</span>
                  <span>
                    <span className={styles.stagePill} style={{ backgroundColor: meta.bg, color: meta.color }}>
                      <span className={styles.stageDot} style={{ backgroundColor: meta.dot }} />
                      {meta.label}
                    </span>
                  </span>
                  <span className={overdue ? styles.dueOverdue : styles.dueNormal}>
                    {dueMs === null
                      ? 'No due date'
                      : overdue
                        ? `Overdue ${daysSince(inst.dnx_duedate, now)}d`
                        : new Date(dueMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={styles.ageCell}>{age === null ? '—' : `${age}d`}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function summarise(instances: Dnx_assessment_instances[], now: number) {
  const startOfToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate());
  // Start of this week (Monday) + start of last week, for the signed-off delta.
  const dow = (startOfToday.getDay() + 6) % 7; // 0 = Monday
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - dow);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  let total = 0;
  let open = 0;
  let overdue = 0;
  let stalled = 0;
  let unassigned = 0;
  let oldestOverdueDays: number | null = null;

  let aiReady = 0;
  const pipe = { draft: 0, inProgress: 0, review: 0, complete: 0 };

  let suitable = 0;
  let notSuitable = 0;
  let signedOffThisWeek = 0;
  let signedOffLastWeek = 0;

  // Turnaround measured over COMPLETED assessments: created → completed
  // (completion time ≈ modifiedon on a Complete row, since it's the edit that
  // finalised it). Median is reported; a fabricated per-stage breakdown is not.
  const turnarounds: number[] = [];
  const openByOwner = new Map<string, number>();

  for (const inst of instances) {
    total += 1;
    const st = statusName(inst);
    const isComplete = st === 'Complete';
    if (!isComplete) open += 1;

    if (st === 'Draft') pipe.draft += 1;
    else if (st === 'InProgress') pipe.inProgress += 1;
    else if (st === 'PendingReview') pipe.review += 1;
    else if (isComplete) pipe.complete += 1;

    // Overdue (open only).
    if (!isComplete && inst.dnx_duedate) {
      const dd = new Date(inst.dnx_duedate).getTime();
      if (dd < startOfToday.getTime()) {
        overdue += 1;
        const d = Math.floor((now - dd) / MS_PER_DAY);
        oldestOverdueDays = oldestOverdueDays === null ? d : Math.max(oldestOverdueDays, d);
      }
    }
    // Stalled: open, no activity in 7+ days.
    if (!isComplete) {
      const idle = daysSince(inst.modifiedon, now);
      if (idle !== null && idle >= 7) stalled += 1;
    }
    // Unassigned (open only — a finished one without an owner isn't actionable).
    const owner = lookupName(inst, 'ownerid');
    if (!isComplete && !owner) unassigned += 1;

    // AI-ready = has an application-details JSON attached.
    if (inst.dnx_application_details_name) aiReady += 1;

    // Outcomes (decided = submitted/complete with a verdict).
    if (st === 'PendingReview' || isComplete) {
      if (inst.dnx_outcome === 0) suitable += 1;
      else if (inst.dnx_outcome === 1) notSuitable += 1;
    }

    if (isComplete && inst.modifiedon) {
      const completedAt = new Date(inst.modifiedon).getTime();
      if (completedAt >= startOfWeek.getTime()) signedOffThisWeek += 1;
      else if (completedAt >= startOfLastWeek.getTime()) signedOffLastWeek += 1;

      // Turnaround for this completed item: created → completed.
      if (inst.createdon) {
        const days = (completedAt - new Date(inst.createdon).getTime()) / MS_PER_DAY;
        if (days >= 0) turnarounds.push(days);
      }
    }

    if (!isComplete && owner) openByOwner.set(owner, (openByOwner.get(owner) ?? 0) + 1);
  }

  turnarounds.sort((a, b) => a - b);
  const medianTurnaround =
    turnarounds.length === 0
      ? null
      : turnarounds.length % 2
        ? turnarounds[(turnarounds.length - 1) / 2]
        : (turnarounds[turnarounds.length / 2 - 1] + turnarounds[turnarounds.length / 2]) / 2;

  const load = Array.from(openByOwner.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, o]) => ({ name, open: o }));

  return {
    total,
    open,
    overdue,
    stalled,
    unassigned,
    oldestOverdueDays,
    aiReady,
    aiBlocked: total - aiReady,
    pipe,
    decided: suitable + notSuitable,
    suitable,
    notSuitable,
    signedOffThisWeek,
    signedOffDelta: signedOffThisWeek - signedOffLastWeek,
    medianTurnaround,
    completedCount: turnarounds.length,
    load,
  };
}

function AttnRow({
  styles,
  color,
  count,
  label,
  sub,
  action,
}: {
  styles: ReturnType<typeof useStyles>;
  color: string;
  count: number;
  label: string;
  sub: string;
  action: string;
}) {
  return (
    <div className={styles.attnRow}>
      <span className={styles.attnBar} style={{ backgroundColor: color }} />
      <span className={styles.attnNum}>{count}</span>
      <span className={styles.attnBody}>
        <span className={styles.attnLabel}>{label}</span>
        <span className={styles.attnSub}>{sub}</span>
      </span>
      <Link to="/assessments" className={styles.attnAction}>
        {action}
      </Link>
    </div>
  );
}

function PipeCell({
  styles,
  label,
  n,
  total,
  color,
}: {
  styles: ReturnType<typeof useStyles>;
  label: string;
  n: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className={styles.pipeCell}>
      <span className={styles.pipeLabel}>{label}</span>
      <span className={styles.pipeNum}>{n}</span>
      <span className={styles.pipeBar}>
        <span className={styles.pipeBarFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
    </div>
  );
}
