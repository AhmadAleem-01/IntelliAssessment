import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronLeft16Regular,
  Edit16Regular,
  Delete16Regular,
  Folder20Regular,
} from '@fluentui/react-icons';
import { useProject } from './api';
import { EditProjectDialog } from './EditProjectDialog';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { Dnx_projectsstatuscode } from '../../generated/models/Dnx_projectsModel';
import { lookupName } from '../../lib/dataverse';

const useStyles = makeStyles({
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: 400,
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
  code: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    letterSpacing: '0.04em',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  deleteBtn: {
    color: 'var(--color-red-text) !important',
    backgroundColor: 'transparent !important',
    border: '0.5px solid var(--color-border-tertiary) !important',
    ':hover': {
      backgroundColor: 'var(--color-red-soft) !important',
      border: '0.5px solid var(--color-red) !important',
    },
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
    fontWeight: 400,
    color: 'var(--color-text-primary)',
  },
  description: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  descText: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
  },
  placeholder: {
    padding: '18px',
    borderRadius: 'var(--border-radius-lg)',
    border: '0.5px dashed var(--color-border-secondary)',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    backgroundColor: 'var(--color-background-primary)',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Active: { bg: 'var(--color-green-soft)', color: 'var(--color-green-text)', label: 'Active' },
  OnHold: { bg: 'var(--color-amber-soft)', color: 'var(--color-amber-text)', label: 'On hold' },
  Archived: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Archived' },
  Inactive: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Inactive' },
  Unknown: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Unknown' },
};

export function ProjectDetailPage() {
  const styles = useStyles();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading, error } = useProject(projectId);

  if (isLoading) return <Spinner label="Loading project..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!project) return null;

  const label =
    Dnx_projectsstatuscode[project.statuscode as keyof typeof Dnx_projectsstatuscode] ?? 'Unknown';
  const status = STATUS_STYLES[label] ?? STATUS_STYLES.Unknown;

  return (
    <div>
      <Link to="/projects" className={styles.backLink}>
        <ChevronLeft16Regular /> Back to projects
      </Link>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconChip}>
            <Folder20Regular />
          </div>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{project.dnx_project_name}</h1>
            <div className={styles.metaRow}>
              {project.dnx_project_code && (
                <span className={styles.code}>{project.dnx_project_code}</span>
              )}
              <span
                className={styles.statusPill}
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <EditProjectDialog
            project={project}
            trigger={
              <Button appearance="secondary" icon={<Edit16Regular />}>
                Edit
              </Button>
            }
          />
          <DeleteProjectDialog
            projectId={project.dnx_projectid}
            projectName={project.dnx_project_name}
            trigger={
              <Button
                className={styles.deleteBtn}
                appearance="secondary"
                icon={<Delete16Regular />}
              >
                Delete
              </Button>
            }
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>Overview</div>
        <div className={styles.cardBody}>
          <div className={styles.fieldsGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Owner</span>
              <span className={styles.fieldValue}>
                {lookupName(project, 'ownerid') ?? '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Created by</span>
              <span className={styles.fieldValue}>
                {lookupName(project, 'createdby') ?? '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Created</span>
              <span className={styles.fieldValue}>
                {project.createdon ? new Date(project.createdon).toLocaleString() : '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Last modified</span>
              <span className={styles.fieldValue}>
                {project.modifiedon ? new Date(project.modifiedon).toLocaleString() : '—'}
              </span>
            </div>
          </div>
          {project.dnx_description && (
            <div className={styles.description}>
              <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>
                Description
              </div>
              <div className={styles.descText}>{project.dnx_description}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.placeholder}>
        Assessment instances for this project will appear here in Milestone 4.
      </div>
    </div>
  );
}
