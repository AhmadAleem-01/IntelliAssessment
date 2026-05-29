import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { useAssessmentInstances } from './api';
import { AssessmentList } from './AssessmentList';

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
});

export function AssessmentsListPage() {
  const styles = useStyles();
  const { data, isLoading, error } = useAssessmentInstances();
  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Assessments</h1>
        <div className={styles.subtitle}>
          Every live assessment instance across all projects.
        </div>
      </div>

      {isLoading && <Spinner label="Loading assessments..." />}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{(error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {!isLoading && !error && (
        <AssessmentList
          items={data ?? []}
          showProject
          emptyMessage="No assessments yet. Head to a project to start one."
        />
      )}
    </div>
  );
}
