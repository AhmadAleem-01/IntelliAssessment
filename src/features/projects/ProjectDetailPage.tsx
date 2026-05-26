import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronLeft20Regular,
  Edit20Regular,
  Delete20Regular,
} from '@fluentui/react-icons';
import { useProject } from './api';
import { EditProjectDialog } from './EditProjectDialog';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { Dnx_projectsstatuscode } from '../../generated/models/Dnx_projectsModel';

const useStyles = makeStyles({
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--app-text-muted)',
    textDecoration: 'none',
    marginBottom: '16px',
    ':hover': { color: 'var(--app-accent)' },
  },
  hero: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '20px',
    marginBottom: '32px',
  },
  heroActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  deleteBtn: {
    color: '#b91c1c !important',
    backgroundColor: 'transparent !important',
    border: '1px solid #fecaca !important',
    ':hover': {
      backgroundColor: '#fef2f2 !important',
      color: '#991b1b !important',
      border: '1px solid #fca5a5 !important',
    },
  },
  mark: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '22px',
    letterSpacing: '-0.01em',
    boxShadow: '0 10px 24px -10px rgba(99,102,241,0.55)',
    flexShrink: 0,
  },
  heroText: { flex: 1 },
  title: {
    fontSize: '30px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    margin: 0,
    lineHeight: 1.15,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '8px',
    color: 'var(--app-text-muted)',
    fontSize: '13px',
  },
  code: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--app-text-subtle)',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  card: {
    backgroundColor: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 'var(--app-radius-lg)',
    padding: '28px',
    boxShadow: 'var(--app-shadow-card)',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--app-text-subtle)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '16px',
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px 32px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--app-text-subtle)',
  },
  fieldValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--app-text)',
  },
  description: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid var(--app-border)',
  },
  descText: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--app-text)',
    whiteSpace: 'pre-wrap',
  },
  placeholder: {
    marginTop: '24px',
    padding: '20px 24px',
    borderRadius: 'var(--app-radius-md)',
    border: '1px dashed var(--app-border)',
    color: 'var(--app-text-muted)',
    fontSize: '13px',
    background: 'var(--app-surface)',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  Active: { bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  OnHold: { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  Archived: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  Inactive: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  Unknown: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
        <ChevronLeft20Regular /> Back to projects
      </Link>

      <div className={styles.hero}>
        <div className={styles.mark}>{initialsOf(project.dnx_project_name)}</div>
        <div className={styles.heroText}>
          <h1 className={styles.title}>{project.dnx_project_name}</h1>
          <div className={styles.metaRow}>
            {project.dnx_project_code && (
              <span className={styles.code}>{project.dnx_project_code}</span>
            )}
            <span
              className={styles.statusPill}
              style={{ background: status.bg, color: status.color }}
            >
              <span className={styles.statusDot} style={{ background: status.dot }} />
              {label === 'OnHold' ? 'On Hold' : label}
            </span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <EditProjectDialog
            project={project}
            trigger={
              <Button appearance="secondary" icon={<Edit20Regular />}>
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
                icon={<Delete20Regular />}
              >
                Delete
              </Button>
            }
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sectionLabel}>Overview</div>
        <div className={styles.fieldsGrid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Owner</span>
            <span className={styles.fieldValue}>{project.owneridname ?? '—'}</span>
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
            <div className={styles.sectionLabel}>Description</div>
            <div className={styles.descText}>{project.dnx_description}</div>
          </div>
        )}
      </div>

      <div className={styles.placeholder}>
        Assessment instances for this project will appear here in Milestone 4.
      </div>
    </div>
  );
}
