import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular, Folder20Regular } from '@fluentui/react-icons';
import { useProjects } from './api';
import { NewProjectDialog } from './NewProjectDialog';
import { Dnx_projectsstatuscode } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_projects } from '../../generated/models/Dnx_projectsModel';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '24px',
  },
  headerText: { flex: 1 },
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    outline: 'none',
  },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    transition: 'background-color 0.12s ease, border 0.12s ease',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-secondary)',
    },
  },
  cardHeader: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  cardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  iconChip: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  },
  cardBody: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardCode: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    letterSpacing: '0.04em',
  },
  cardDesc: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  empty: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px dashed var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '56px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  emptyTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  emptySub: {
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    maxWidth: '380px',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Active: {
    bg: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    label: 'Active',
  },
  OnHold: {
    bg: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    label: 'On hold',
  },
  Archived: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Archived',
  },
  Inactive: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Inactive',
  },
  Unknown: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Unknown',
  },
};

function statusLabel(code: number | undefined): string {
  if (!code) return 'Unknown';
  return Dnx_projectsstatuscode[code as keyof typeof Dnx_projectsstatuscode] ?? 'Unknown';
}

function ProjectCard({ project }: { project: Dnx_projects }) {
  const styles = useStyles();
  const label = statusLabel(project.statuscode);
  const status = STATUS_STYLES[label] ?? STATUS_STYLES.Unknown;
  return (
    <Link to={`/projects/${project.dnx_projectid}`} className={styles.cardLink}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <div className={styles.iconChip}>
              <Folder20Regular />
            </div>
            <span className={styles.cardName}>{project.dnx_project_name}</span>
          </div>
          <span
            className={styles.statusPill}
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>
        <div className={styles.cardBody}>
          {project.dnx_project_code && (
            <span className={styles.cardCode}>{project.dnx_project_code}</span>
          )}
          {project.dnx_description && (
            <div className={styles.cardDesc}>{project.dnx_description}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProjectsPage() {
  const styles = useStyles();
  const { data: projects, isLoading, error } = useProjects();

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Projects</h1>
          <div className={styles.subtitle}>
            Top-level containers grouping one or more assessments.
          </div>
        </div>
        <NewProjectDialog
          trigger={
            <Button appearance="primary" icon={<Add16Regular />}>
              New project
            </Button>
          }
        />
      </div>

      {isLoading && <Spinner label="Loading projects..." />}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{(error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {projects && projects.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No projects yet</div>
          <div className={styles.emptySub}>
            Projects are the top-level workspace for assessments. Create your first one
            to start authoring templates and capturing responses.
          </div>
          <NewProjectDialog
            trigger={
              <Button appearance="primary" icon={<Add16Regular />}>
                Create your first project
              </Button>
            }
          />
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className={styles.grid}>
          {projects.map((p) => (
            <ProjectCard key={p.dnx_projectid} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
