import { Link } from 'react-router-dom';
import { makeStyles } from '@fluentui/react-components';
import { ClipboardTaskListLtr20Regular } from '@fluentui/react-icons';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName } from '../../lib/dataverse';

/*
 * Assessment list rows — Design System v1.0 ("Calm Efficiency"). Shared by the
 * Assessments list page and the project detail page.
 */
const useStyles = makeStyles({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 18px',
    borderRadius: 'var(--ds-radius-card)',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease',
    ':hover': {
      borderColor: 'var(--ds-text-muted)',
      boxShadow: '0 2px 10px -4px rgba(17, 24, 39, 0.12)',
      transform: 'translateY(-1px)',
    },
  },
  iconChip: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  name: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
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
    backgroundColor: 'var(--ds-border)',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
    flexShrink: 0,
  },
  pillDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  empty: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px dashed var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '40px 24px',
    textAlign: 'center',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
  },
});

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; dot: string; label: string }
> = {
  Draft: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'draft' },
  InProgress: {
    bg: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    dot: 'var(--ds-brand-accent)',
    label: 'in progress',
  },
  PendingReview: {
    bg: 'var(--ds-pending-soft)',
    color: '#b45309',
    dot: 'var(--ds-pending)',
    label: 'pending review',
  },
  Complete: {
    bg: 'var(--ds-suitable-soft)',
    color: '#047857',
    dot: 'var(--ds-suitable)',
    label: 'complete',
  },
  Active: { bg: 'var(--ds-brand-accent-soft)', color: 'var(--ds-brand-accent)', dot: 'var(--ds-brand-accent)', label: 'active' },
  Inactive: {
    bg: 'var(--ds-surface-base)',
    color: 'var(--ds-text-body)',
    dot: 'var(--ds-text-muted)',
    label: 'inactive',
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
              <span className={styles.pillDot} style={{ backgroundColor: status.dot }} />
              {status.label}
            </span>
            {outcome === 0 && (
              <span
                className={styles.pill}
                style={{ backgroundColor: 'var(--ds-suitable-soft)', color: '#047857' }}
              >
                <span className={styles.pillDot} style={{ backgroundColor: 'var(--ds-suitable)' }} />
                suitable
              </span>
            )}
            {outcome === 1 && (
              <span
                className={styles.pill}
                style={{ backgroundColor: 'var(--ds-not-suitable-soft)', color: '#b91c1c' }}
              >
                <span className={styles.pillDot} style={{ backgroundColor: 'var(--ds-not-suitable)' }} />
                not suitable
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
