import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  header: {
    marginBottom: '24px',
  },
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
    '@media (max-width: 900px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
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
    fontSize: '14px',
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
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '16px',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr',
    },
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
  },
  cardBody: { padding: '18px' },
  outcomeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  outcomeLabel: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    minWidth: '120px',
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
  },
  outcomeValue: {
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    minWidth: '32px',
    textAlign: 'right',
  },
  placeholder: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    padding: '24px',
  },
});

const STAT_TILES = [
  { label: 'Total assessments', value: '—', sub: 'No data yet' },
  { label: 'In progress', value: '—', sub: 'No data yet' },
  { label: 'Pending review', value: '—', sub: 'Awaiting sign-off' },
  { label: 'Completed this month', value: '—', sub: 'No data yet' },
];

export function DashboardPage() {
  const styles = useStyles();
  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.subtitle}>
          High-level operational view across all assessments.
        </div>
      </div>

      <div className={styles.statRow}>
        {STAT_TILES.map((t) => (
          <div key={t.label} className={styles.statCard}>
            <div className={styles.statLabel}>{t.label}</div>
            <div className={styles.statValue}>{t.value}</div>
            <div className={styles.statSub}>{t.sub}</div>
          </div>
        ))}
      </div>

      <div className={styles.twoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Assessor workload</div>
          <div className={styles.cardBody}>
            <div className={styles.placeholder}>
              Workload distribution will populate once instances are created (Milestone 4).
            </div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardHeader}>Outcome breakdown</div>
          <div className={styles.cardBody}>
            <div className={styles.outcomeRow}>
              <span className={styles.outcomeLabel}>Suitable</span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: '0%', backgroundColor: 'var(--color-green)' }}
                />
              </div>
              <span className={styles.outcomeValue}>—</span>
            </div>
            <div className={styles.outcomeRow}>
              <span className={styles.outcomeLabel}>Not suitable</span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: '0%', backgroundColor: 'var(--color-red)' }}
                />
              </div>
              <span className={styles.outcomeValue}>—</span>
            </div>
            <div className={styles.outcomeRow}>
              <span className={styles.outcomeLabel}>Pending review</span>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: '0%', backgroundColor: 'var(--color-gray)' }}
                />
              </div>
              <span className={styles.outcomeValue}>—</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Recent assessments</div>
        <div className={styles.cardBody}>
          <div className={styles.placeholder}>
            Recent assessment table will appear here once instances exist (Milestone 4).
          </div>
        </div>
      </div>
    </div>
  );
}
