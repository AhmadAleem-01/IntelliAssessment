import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronLeft16Regular,
  ClipboardTaskListLtr20Regular,
} from '@fluentui/react-icons';
import { useAssessmentInstance } from './api';
import { ChecklistRenderer } from './ChecklistRenderer';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName, lookupId } from '../../lib/dataverse';

const useStyles = makeStyles({
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    marginBottom: '14px',
    ':hover': { color: 'var(--color-text-primary)' },
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '24px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
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
  titleBlock: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  title: {
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    margin: 0,
    letterSpacing: '-0.005em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--color-text-secondary)',
    fontSize: '12px',
    flexWrap: 'wrap',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
  },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  cardHeader: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  cardBody: { padding: '18px' },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px 28px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  fieldValue: {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
  },
  templateLink: {
    color: 'var(--color-purple-text)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  projectLink: {
    color: 'var(--color-purple-text)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  placeholder: {
    padding: '24px',
    borderRadius: 'var(--border-radius-lg)',
    border: '0.5px dashed var(--color-border-secondary)',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    backgroundColor: 'var(--color-background-primary)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  placeholderTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
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

export function AssessmentPage() {
  const styles = useStyles();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { data: assessment, isLoading, error } = useAssessmentInstance(assessmentId);

  if (isLoading) return <Spinner label="Loading assessment..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!assessment) return null;

  const label =
    Dnx_assessment_instancesstatuscode[
      assessment.statuscode as keyof typeof Dnx_assessment_instancesstatuscode
    ] ?? 'Draft';
  const status = STATUS_STYLES[label] ?? STATUS_STYLES.Draft;
  const templateId = lookupId(assessment, 'dnx_assessmenttemplate');
  const projectId = lookupId(assessment, 'dnx_project');
  const templateName = lookupName(assessment, 'dnx_assessmenttemplate');
  const projectName = lookupName(assessment, 'dnx_project');
  const assessor = lookupName(assessment, 'ownerid');

  return (
    <div>
      <Link to="/assessments" className={styles.backLink}>
        <ChevronLeft16Regular /> Back to assessments
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconChip}>
            <ClipboardTaskListLtr20Regular />
          </div>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{assessment.dnx_assessment_name}</h1>
            <div className={styles.metaRow}>
              <span
                className={styles.statusPill}
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
              {assessment.dnx_duedate && (
                <span>Due {new Date(assessment.dnx_duedate).toLocaleDateString()}</span>
              )}
              {assessment.dnx_version !== undefined && assessment.dnx_version !== null && (
                <span>v{assessment.dnx_version}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Overview</div>
        <div className={styles.cardBody}>
          <div className={styles.fieldsGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Project</span>
              <span className={styles.fieldValue}>
                {projectId && projectName ? (
                  <Link to={`/projects/${projectId}`} className={styles.projectLink}>
                    {projectName}
                  </Link>
                ) : (
                  projectName ?? '—'
                )}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Template</span>
              <span className={styles.fieldValue}>
                {templateId && templateName ? (
                  <Link
                    to={`/templates/${templateId}/edit`}
                    className={styles.templateLink}
                  >
                    {templateName}
                  </Link>
                ) : (
                  templateName ?? '—'
                )}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Assessor</span>
              <span className={styles.fieldValue}>{assessor ?? '—'}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Created</span>
              <span className={styles.fieldValue}>
                {assessment.createdon
                  ? new Date(assessment.createdon).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Last modified</span>
              <span className={styles.fieldValue}>
                {assessment.modifiedon
                  ? new Date(assessment.modifiedon).toLocaleString()
                  : '—'}
              </span>
            </div>
            {assessment.dnx_submittedon && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Submitted</span>
                <span className={styles.fieldValue}>
                  {new Date(assessment.dnx_submittedon).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {templateId ? (
        <ChecklistRenderer instanceId={assessment.dnx_assessment_instanceid} templateId={templateId} />
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.placeholderTitle}>Template missing</div>
          This assessment has no template linked. Open the instance in Dataverse to
          set one before answering.
        </div>
      )}
    </div>
  );
}
