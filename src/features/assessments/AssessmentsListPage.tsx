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
  empty: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '64px 24px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: '6px',
  },
});

export function AssessmentsListPage() {
  const styles = useStyles();
  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Assessments</h1>
        <div className={styles.subtitle}>
          Live assessment instances across all projects. Milestone 4 enables creation and filtering here.
        </div>
      </div>
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No instances yet</div>
        Open a project to start an assessment, or wait for Milestone 4 to land the
        instance picker.
      </div>
    </div>
  );
}
