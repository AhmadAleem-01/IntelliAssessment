import { useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { useAssessmentInstances } from './api';
import { AssessmentList } from './AssessmentList';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';

type FilterKey = 'all' | 'review' | 'inProgress' | 'complete';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Pending review' },
  { key: 'inProgress', label: 'In progress' },
  { key: 'complete', label: 'Complete' },
];

const useStyles = makeStyles({
  header: {
    marginBottom: '20px',
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
  filters: {
    display: 'flex',
    gap: '6px',
    marginBottom: '14px',
    flexWrap: 'wrap',
  },
  chip: {
    padding: '5px 12px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      color: 'var(--color-text-primary)',
    },
  },
  chipActive: {
    backgroundColor: 'var(--color-purple) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-purple) !important',
  },
  count: {
    marginLeft: '6px',
    opacity: 0.7,
    fontVariantNumeric: 'tabular-nums',
  },
});

export function AssessmentsListPage() {
  const styles = useStyles();
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data, isLoading, error } = useAssessmentInstances();

  // Count by filter so the chip labels show how much work is in each bucket.
  const counts = {
    all: data?.length ?? 0,
    review: 0,
    inProgress: 0,
    complete: 0,
  };
  for (const a of data ?? []) {
    const name =
      Dnx_assessment_instancesstatuscode[
        a.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
      ];
    if (name === 'PendingReview') counts.review += 1;
    else if (name === 'InProgress' || name === 'Draft') counts.inProgress += 1;
    else if (name === 'Complete') counts.complete += 1;
  }

  const filtered = (data ?? []).filter((a) => {
    if (filter === 'all') return true;
    const name =
      Dnx_assessment_instancesstatuscode[
        a.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
      ];
    if (filter === 'review') return name === 'PendingReview';
    if (filter === 'inProgress') return name === 'InProgress' || name === 'Draft';
    if (filter === 'complete') return name === 'Complete';
    return true;
  });

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Assessments</h1>
        <div className={styles.subtitle}>
          Every live assessment instance across all projects.
        </div>
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const c = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
            >
              {f.label}
              <span className={styles.count}>{c}</span>
            </button>
          );
        })}
      </div>

      {isLoading && <Spinner label="Loading assessments..." />}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{(error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {!isLoading && !error && (
        <AssessmentList
          items={filtered}
          showProject
          emptyMessage={
            filter === 'all'
              ? 'No assessments yet. Head to a project to start one.'
              : `No assessments in this status right now.`
          }
        />
      )}
    </div>
  );
}
