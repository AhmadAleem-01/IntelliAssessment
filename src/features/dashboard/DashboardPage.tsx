import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Spinner, MessageBar, MessageBarBody, makeStyles } from '@fluentui/react-components';
import { useAssessmentInstances } from '../assessments/api';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName } from '../../lib/dataverse';

const useStyles = makeStyles({
  header: { marginBottom: '24px' },
  title: {
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    margin: 0,
    letterSpacing: '-0.005em',
  },
  subtitle: {
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    marginTop: '4px',
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
    '@media (max-width: 900px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
  },
  statCard: {
    backgroundColor: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
  },
  statSub: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
  },
  amber: { color: 'var(--color-amber-text)' },
  green: { color: 'var(--color-green-text)' },
  red: { color: 'var(--color-red-text)' },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderSub: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontWeight: 400,
  },
  cardBody: { padding: '18px' },
  outcomeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
    ':last-child': { marginBottom: 0 },
  },
  outcomeLabel: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    minWidth: '110px',
  },
  progressTrack: {
    flex: 1,
    height: '6px',
    backgroundColor: 'var(--color-background-tertiary)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.25s ease',
  },
  outcomeValue: {
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    minWidth: '54px',
    textAlign: 'right',
  },
  workloadRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    ':last-child': { borderBottom: 'none' },
  },
  workloadName: { color: 'var(--color-text-primary)' },
  workloadCount: { color: 'var(--color-text-secondary)' },
  placeholder: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    padding: '24px',
  },
  recentTable: {
    display: 'flex',
    flexDirection: 'column',
  },
  recentRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 140px 110px 100px',
    gap: '12px',
    padding: '10px 18px',
    alignItems: 'center',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    textDecoration: 'none',
    color: 'inherit',
    ':hover': { backgroundColor: 'var(--color-background-secondary)' },
    ':last-child': { borderBottom: 'none' },
  },
  recentRowHeader: {
    backgroundColor: 'var(--color-background-secondary)',
    padding: '8px 18px',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    display: 'grid',
    gridTemplateColumns: '1fr 140px 110px 100px',
    gap: '12px',
  },
  recentName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    width: 'fit-content',
  },
  statusPillDraft: {
    backgroundColor: 'var(--color-gray-soft)',
    color: 'var(--color-text-secondary)',
  },
  statusPillInProgress: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
  },
  statusPillPending: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  statusPillComplete: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
  },
  outcomePillSuitable: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    border: '0.5px solid var(--color-green)',
  },
  outcomePillNot: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
    border: '0.5px solid var(--color-red)',
  },
  outcomePillPending: { color: 'var(--color-text-tertiary)' },
  recentDate: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  },
});

/**
 * Roll up every instance into the counts the dashboard tiles render.
 * Single pass for efficiency; one map walks once and emits everything.
 */
function summarise(instances: Dnx_assessment_instances[]) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let total = 0;
  let inProgress = 0;
  let pendingReview = 0;
  let completedThisMonth = 0;
  let suitable = 0;
  let notSuitable = 0;
  let pendingOutcome = 0;
  const ownerCounts = new Map<string, number>();

  for (const inst of instances) {
    total += 1;
    const status = Dnx_assessment_instancesstatuscode[
      inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ];
    if (status === 'InProgress' || status === 'Draft') inProgress += 1;
    if (status === 'PendingReview') pendingReview += 1;
    if (status === 'Complete' && inst.modifiedon) {
      const modified = new Date(inst.modifiedon);
      if (modified >= firstOfMonth) completedThisMonth += 1;
    }
    // Outcome breakdown only counts assessments that have left the editing
    // states — otherwise every Draft would inflate the "Pending" bucket.
    if (status === 'PendingReview' || status === 'Complete') {
      const outcome = inst.dnx_outcome;
      if (outcome === 0) suitable += 1;
      else if (outcome === 1) notSuitable += 1;
      else pendingOutcome += 1;
    }
    const ownerName = lookupName(inst, 'ownerid') ?? 'Unassigned';
    ownerCounts.set(ownerName, (ownerCounts.get(ownerName) ?? 0) + 1);
  }

  // Workload list: owners sorted by count desc, top 6.
  const workload = Array.from(ownerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  return {
    total,
    inProgress,
    pendingReview,
    completedThisMonth,
    suitable,
    notSuitable,
    pendingOutcome,
    workload,
  };
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  Draft: { label: 'Draft', className: 'statusPillDraft' },
  InProgress: { label: 'In progress', className: 'statusPillInProgress' },
  PendingReview: { label: 'Pending review', className: 'statusPillPending' },
  Complete: { label: 'Complete', className: 'statusPillComplete' },
};

export function DashboardPage() {
  const styles = useStyles();
  const { data: instances, isLoading, error } = useAssessmentInstances();

  const summary = useMemo(() => summarise(instances ?? []), [instances]);

  // Outcome breakdown denominator excludes "no data" so the bars represent
  // share-of-decided-assessments. Falls back to 1 to avoid div-by-zero on
  // an empty environment.
  const outcomeDenom = Math.max(
    1,
    summary.suitable + summary.notSuitable + summary.pendingOutcome,
  );

  const recent = (instances ?? []).slice(0, 8);

  if (isLoading) return <Spinner label="Loading dashboard..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.subtitle}>
          High-level operational view across all assessments.
        </div>
      </div>

      <div className={styles.statRow}>
        <Tile
          styles={styles}
          label="Total assessments"
          value={summary.total}
          sub={summary.total === 0 ? 'No instances yet' : 'All projects'}
        />
        <Tile
          styles={styles}
          label="In progress"
          value={summary.inProgress}
          sub="Draft + In progress"
        />
        <Tile
          styles={styles}
          label="Pending review"
          value={summary.pendingReview}
          sub="Awaiting sign-off"
          valueClass={summary.pendingReview > 0 ? styles.amber : undefined}
        />
        <Tile
          styles={styles}
          label="Completed this month"
          value={summary.completedThisMonth}
          sub={`Since ${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString()}`}
          valueClass={summary.completedThisMonth > 0 ? styles.green : undefined}
        />
      </div>

      <div className={styles.twoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            Assessor workload
            <span className={styles.cardHeaderSub}>by assessment owner</span>
          </div>
          <div className={styles.cardBody}>
            {summary.workload.length === 0 ? (
              <div className={styles.placeholder}>
                No instances assigned yet — workload will appear once assessments
                are started.
              </div>
            ) : (
              summary.workload.map((w) => (
                <div key={w.name} className={styles.workloadRow}>
                  <span className={styles.workloadName}>{w.name}</span>
                  <span className={styles.workloadCount}>
                    {w.count} assessment{w.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            Outcome breakdown
            <span className={styles.cardHeaderSub}>submitted + complete only</span>
          </div>
          <div className={styles.cardBody}>
            <OutcomeBar
              styles={styles}
              label="Suitable"
              value={summary.suitable}
              denom={outcomeDenom}
              color="var(--color-green)"
            />
            <OutcomeBar
              styles={styles}
              label="Not suitable"
              value={summary.notSuitable}
              denom={outcomeDenom}
              color="var(--color-red)"
            />
            <OutcomeBar
              styles={styles}
              label="Pending"
              value={summary.pendingOutcome}
              denom={outcomeDenom}
              color="var(--color-text-tertiary)"
            />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent assessments</div>
        {recent.length === 0 ? (
          <div className={styles.placeholder}>
            No assessments yet. Create one from a project's detail page.
          </div>
        ) : (
          <>
            <div className={styles.recentRowHeader}>
              <span>Name</span>
              <span>Project</span>
              <span>Status</span>
              <span>Outcome</span>
            </div>
            <div className={styles.recentTable}>
              {recent.map((inst) => {
                const status =
                  Dnx_assessment_instancesstatuscode[
                    inst.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
                  ] ?? 'Draft';
                const statusInfo = STATUS_LABEL[status] ?? STATUS_LABEL.Draft;
                const projectName = lookupName(inst, 'dnx_project') ?? '—';
                const outcome = inst.dnx_outcome;
                return (
                  <Link
                    key={inst.dnx_assessment_instanceid}
                    to={`/assessments/${inst.dnx_assessment_instanceid}`}
                    className={styles.recentRow}
                  >
                    <span className={styles.recentName} title={inst.dnx_assessment_name}>
                      {inst.dnx_assessment_name}
                    </span>
                    <span className={styles.recentDate} title={projectName}>
                      {projectName}
                    </span>
                    <span
                      className={`${styles.pill} ${styles[statusInfo.className as keyof typeof styles] as string}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span>
                      {outcome === 0 ? (
                        <span className={`${styles.pill} ${styles.outcomePillSuitable}`}>
                          Suitable
                        </span>
                      ) : outcome === 1 ? (
                        <span className={`${styles.pill} ${styles.outcomePillNot}`}>
                          Not suitable
                        </span>
                      ) : (
                        <span
                          className={`${styles.pill} ${styles.outcomePillPending}`}
                          title="No verdict recorded yet"
                        >
                          —
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface TileProps {
  styles: ReturnType<typeof useStyles>;
  label: string;
  value: number;
  sub: string;
  valueClass?: string;
}
function Tile({ styles, label, value, sub, valueClass }: TileProps) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} ${valueClass ?? ''}`}>{value}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}

interface BarProps {
  styles: ReturnType<typeof useStyles>;
  label: string;
  value: number;
  denom: number;
  color: string;
}
function OutcomeBar({ styles, label, value, denom, color }: BarProps) {
  const pct = Math.round((value / denom) * 100);
  return (
    <div className={styles.outcomeRow}>
      <span className={styles.outcomeLabel}>{label}</span>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className={styles.outcomeValue}>
        {value} ({pct}%)
      </span>
    </div>
  );
}
