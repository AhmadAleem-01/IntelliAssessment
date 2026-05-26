import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import { Add20Regular, ArrowRight20Regular } from '@fluentui/react-icons';
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
    marginBottom: '32px',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: '30px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    color: 'var(--app-text)',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    outline: 'none',
  },
  card: {
    position: 'relative',
    backgroundColor: 'var(--app-surface)',
    borderRadius: 'var(--app-radius-lg)',
    border: '1px solid var(--app-border)',
    padding: '22px',
    transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: 'var(--app-shadow-card)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minHeight: '170px',
    overflow: 'hidden',
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: 'var(--app-shadow-lift)',
      border: '1px solid rgba(99,102,241,0.3)',
    },
    ':hover .card-arrow': {
      opacity: 1,
      transform: 'translate(0, 0)',
    },
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  initials: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: '15px',
    letterSpacing: '-0.01em',
    boxShadow: '0 8px 16px -8px rgba(99,102,241,0.5)',
    flexShrink: 0,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  cardName: {
    fontSize: '17px',
    fontWeight: 600,
    color: 'var(--app-text)',
    letterSpacing: '-0.015em',
    lineHeight: 1.3,
  },
  cardCode: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--app-text-subtle)',
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardDesc: {
    fontSize: '13px',
    color: 'var(--app-text-muted)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    color: 'var(--app-accent)',
    opacity: 0,
    transform: 'translate(-6px, 0)',
    transition: 'all 0.18s ease',
    display: 'flex',
  },
  empty: {
    backgroundColor: 'var(--app-surface)',
    border: '1.5px dashed var(--app-border)',
    borderRadius: 'var(--app-radius-lg)',
    padding: '64px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--app-text)',
    letterSpacing: '-0.01em',
  },
  emptySub: {
    color: 'var(--app-text-muted)',
    fontSize: '14px',
    maxWidth: '380px',
  },
});

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #f97316 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  Active: { bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  OnHold: { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  Archived: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  Inactive: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  Unknown: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
};

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
        <div className={styles.cardTop}>
          <div
            className={styles.initials}
            style={{ background: gradientFor(project.dnx_projectid) }}
          >
            {initialsOf(project.dnx_project_name)}
          </div>
          <span
            className={styles.statusPill}
            style={{ background: status.bg, color: status.color }}
          >
            <span className={styles.statusDot} style={{ background: status.dot }} />
            {label === 'OnHold' ? 'On Hold' : label}
          </span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardName}>{project.dnx_project_name}</div>
          {project.dnx_project_code && (
            <div className={styles.cardCode}>{project.dnx_project_code}</div>
          )}
          {project.dnx_description && (
            <div className={styles.cardDesc} style={{ marginTop: 4 }}>
              {project.dnx_description}
            </div>
          )}
        </div>
        <span className={`${styles.arrow} card-arrow`}>
          <ArrowRight20Regular />
        </span>
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
            <Button appearance="primary" size="large" icon={<Add20Regular />}>
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
              <Button appearance="primary" size="large" icon={<Add20Regular />}>
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
