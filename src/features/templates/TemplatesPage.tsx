import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import { Add20Regular, DocumentBulletList24Regular } from '@fluentui/react-icons';
import { useTemplates } from './api';
import { NewTemplateDialog } from './NewTemplateDialog';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '32px',
  },
  title: {
    fontSize: '30px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
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
  cardLink: { textDecoration: 'none', color: 'inherit' },
  card: {
    backgroundColor: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 'var(--app-radius-lg)',
    padding: '22px',
    minHeight: '170px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    boxShadow: 'var(--app-shadow-card)',
    ':hover': {
      transform: 'translateY(-3px)',
      boxShadow: 'var(--app-shadow-lift)',
      border: '1px solid rgba(99,102,241,0.3)',
    },
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  cardIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #eef2ff 0%, #fae8ff 100%)',
    color: '#6366f1',
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
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  cardName: {
    fontSize: '17px',
    fontWeight: 600,
    color: 'var(--app-text)',
    letterSpacing: '-0.015em',
    lineHeight: 1.3,
  },
  cardMeta: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '12px',
    color: 'var(--app-text-muted)',
  },
  versionPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 8px',
    background: 'var(--app-bg)',
    borderRadius: '6px',
    border: '1px solid var(--app-border)',
    color: 'var(--app-text-muted)',
  },
  desc: {
    fontSize: '13px',
    color: 'var(--app-text-muted)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
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

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Draft: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Draft' },
  Published: { bg: '#ecfdf5', color: '#047857', dot: '#10b981', label: 'Published' },
  Deprecated: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444', label: 'Deprecated' },
  Active: { bg: '#ecfdf5', color: '#047857', dot: '#10b981', label: 'Active' },
  Inactive: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Inactive' },
};

function statusLabel(code: number | undefined): string {
  if (!code) return 'Draft';
  return (
    Dnx_assessment_templatesstatuscode[
      code as keyof typeof Dnx_assessment_templatesstatuscode
    ] ?? 'Draft'
  );
}

export function TemplatesPage() {
  const styles = useStyles();
  const { data, isLoading, error } = useTemplates();

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Templates</h1>
          <div className={styles.subtitle}>
            Reusable assessment definitions — section, subsection, question hierarchy.
          </div>
        </div>
        <NewTemplateDialog
          trigger={
            <Button appearance="primary" size="large" icon={<Add20Regular />}>
              New template
            </Button>
          }
        />
      </div>

      {isLoading && <Spinner label="Loading templates..." />}

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{(error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {data && data.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No templates yet</div>
          <div className={styles.emptySub}>
            Templates define the structure of an assessment — sections, subsections, and
            questions. Create your first one to start authoring.
          </div>
          <NewTemplateDialog
            trigger={
              <Button appearance="primary" size="large" icon={<Add20Regular />}>
                Create your first template
              </Button>
            }
          />
        </div>
      )}

      {data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((t) => {
            const label = statusLabel(t.statuscode);
            const status = STATUS_STYLES[label] ?? STATUS_STYLES.Draft;
            return (
              <Link
                key={t.dnx_assessment_templateid}
                to={`/templates/${t.dnx_assessment_templateid}/edit`}
                className={styles.cardLink}
              >
                <div className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardIcon}>
                      <DocumentBulletList24Regular />
                    </div>
                    <span
                      className={styles.statusPill}
                      style={{ background: status.bg, color: status.color }}
                    >
                      <span
                        className={styles.statusDot}
                        style={{ background: status.dot }}
                      />
                      {status.label}
                    </span>
                  </div>
                  <div className={styles.cardName}>{t.dnx_template_name}</div>
                  <div className={styles.cardMeta}>
                    <span className={styles.versionPill}>v{t.dnx_template_version ?? 1}</span>
                    {t.modifiedon && (
                      <span>Updated {new Date(t.modifiedon).toLocaleDateString()}</span>
                    )}
                  </div>
                  {t.dnx_description && <div className={styles.desc}>{t.dnx_description}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
