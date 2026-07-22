import { Link } from 'react-router-dom';
import { makeStyles } from '@fluentui/react-components';
import { ClipboardTaskListLtr20Regular } from '@fluentui/react-icons';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName } from '../../lib/dataverse';

const useStyles = makeStyles({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'background-color 0.12s ease, border 0.12s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-secondary)',
    },
  },
  iconChip: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  name: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaDot: {
    display: 'inline-block',
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-text-tertiary)',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
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
  empty: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px dashed var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '32px 20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Draft: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Draft' },
  InProgress: {
    bg: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
    label: 'In progress',
  },
  PendingReview: {
    bg: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    label: 'Pending review',
  },
  Complete: {
    bg: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    label: 'Complete',
  },
  Active: { bg: 'var(--color-blue-soft)', color: 'var(--color-blue-text)', label: 'Active' },
  Inactive: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Inactive',
  },
};

function statusLabel(code: number | undefined): string {
  if (!code) return 'Draft';
  return (
    Dnx_assessment_instancesstatuscode[
      code as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft'
  );
}

interface Props {
  items: Dnx_assessment_instances[];
  /** Whether to include the project name in each row's meta (off on the project detail page). */
  showProject?: boolean;
  emptyMessage?: React.ReactNode;
}

export function AssessmentList({ items, showProject, emptyMessage }: Props) {
  const styles = useStyles();
  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        {emptyMessage ?? 'No assessments yet.'}
      </div>
    );
  }
  return (
    <div className={styles.list}>
      {items.map((a) => {
        const label = statusLabel(a.statuscode);
        const status = STATUS_STYLES[label] ?? STATUS_STYLES.Draft;
        const templateName = lookupName(a, 'dnx_assessmenttemplate');
        const projectName = showProject ? lookupName(a, 'dnx_project') : undefined;
        // Only Complete assessments carry a meaningful persisted outcome —
        // Draft/InProgress/PendingReview haven't been submitted+approved yet.
        const outcome = label === 'Complete' ? a.dnx_outcome : undefined;
        return (
          <Link
            key={a.dnx_assessment_instanceid}
            to={`/assessments/${a.dnx_assessment_instanceid}`}
            className={styles.row}
          >
            <div className={styles.iconChip}>
              <ClipboardTaskListLtr20Regular />
            </div>
            <div className={styles.textCol}>
              <div className={styles.name}>{a.dnx_assessment_name}</div>
              <div className={styles.meta}>
                {templateName && <span>{templateName}</span>}
                {projectName && (
                  <>
                    <span className={styles.metaDot} />
                    <span>{projectName}</span>
                  </>
                )}
                {a.dnx_duedate && (
                  <>
                    <span className={styles.metaDot} />
                    <span>Due {new Date(a.dnx_duedate).toLocaleDateString()}</span>
                  </>
                )}
                {a.modifiedon && (
                  <>
                    <span className={styles.metaDot} />
                    <span>Updated {new Date(a.modifiedon).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
            <span
              className={styles.pill}
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {outcome === 0 && (
              <span className={`${styles.pill} ${styles.outcomePillSuitable}`}>Suitable</span>
            )}
            {outcome === 1 && (
              <span className={`${styles.pill} ${styles.outcomePillNot}`}>Not suitable</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
