import { makeStyles } from '@fluentui/react-components';
import {
  ClipboardTaskListLtr24Regular,
  Hourglass24Regular,
  CheckmarkCircle24Regular,
  DocumentCheckmark24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '30px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1.15,
  },
  subtitle: {
    color: 'var(--app-text-muted)',
    fontSize: '15px',
    marginTop: '6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  },
  tile: {
    backgroundColor: 'var(--app-surface)',
    borderRadius: 'var(--app-radius-lg)',
    border: '1px solid var(--app-border)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    boxShadow: 'var(--app-shadow-card)',
    transition: 'all 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: 'var(--app-shadow-lift)',
    },
  },
  iconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  metric: {
    fontSize: '36px',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: 'var(--app-text)',
    lineHeight: 1,
  },
  delta: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#10b981',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--app-text-muted)',
  },
  emptyBanner: {
    marginTop: '32px',
    padding: '20px 24px',
    borderRadius: 'var(--app-radius-md)',
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.04) 100%)',
    border: '1px solid rgba(99,102,241,0.18)',
    color: 'var(--app-text-muted)',
    fontSize: '13px',
  },
});

const TILES = [
  {
    label: 'In Progress',
    value: '—',
    icon: <ClipboardTaskListLtr24Regular />,
    bg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    soft: '#eef2ff',
    color: '#4f46e5',
  },
  {
    label: 'Pending Evidence',
    value: '—',
    icon: <Hourglass24Regular />,
    bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    soft: '#fffbeb',
    color: '#b45309',
  },
  {
    label: 'Ready for Sign-off',
    value: '—',
    icon: <DocumentCheckmark24Regular />,
    bg: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    soft: '#ecfeff',
    color: '#0e7490',
  },
  {
    label: 'Completed',
    value: '—',
    icon: <CheckmarkCircle24Regular />,
    bg: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    soft: '#ecfdf5',
    color: '#047857',
  },
];

export function DashboardPage() {
  const styles = useStyles();
  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.subtitle}>
          Live assessor workload across statuses. Wired to Dataverse aggregates in Milestone 8.
        </div>
      </div>

      <div className={styles.grid}>
        {TILES.map((t) => (
          <div key={t.label} className={styles.tile}>
            <div className={styles.iconWrap} style={{ background: t.soft, color: t.color }}>
              {t.icon}
            </div>
            <div>
              <div className={styles.metricRow}>
                <span className={styles.metric}>{t.value}</span>
              </div>
              <div className={styles.label}>{t.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.emptyBanner}>
        Metrics will populate once assessment instances are created. Head to <b>Projects</b> to
        spin up your first workspace.
      </div>
    </div>
  );
}
