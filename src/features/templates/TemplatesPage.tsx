import { Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular, DocumentBulletList20Regular } from '@fluentui/react-icons';
import { useTemplates } from './api';
import { NewTemplateDialog } from './NewTemplateDialog';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  cardLink: { textDecoration: 'none', color: 'inherit' },
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background-color 0.12s ease, border 0.12s ease',
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
    gap: '10px',
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  versionPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 6px',
    backgroundColor: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-secondary)',
  },
  desc: {
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
  Draft: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Draft',
  },
  Published: {
    bg: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    label: 'Published',
  },
  Deprecated: {
    bg: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
    label: 'Deprecated',
  },
  Active: {
    bg: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    label: 'Active',
  },
  Inactive: {
    bg: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
    label: 'Inactive',
  },
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
            Reusable assessment definitions — section, subsection, and question hierarchy.
          </div>
        </div>
        <NewTemplateDialog
          trigger={
            <Button appearance="primary" icon={<Add16Regular />}>
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
              <Button appearance="primary" icon={<Add16Regular />}>
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
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderLeft}>
                      <div className={styles.iconChip}>
                        <DocumentBulletList20Regular />
                      </div>
                      <span className={styles.cardName}>{t.dnx_template_name}</span>
                    </div>
                    <span
                      className={styles.statusPill}
                      style={{ backgroundColor: status.bg, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.metaRow}>
                      <span className={styles.versionPill}>v{t.dnx_template_version ?? 1}</span>
                      {t.modifiedon && (
                        <span>Updated {new Date(t.modifiedon).toLocaleDateString()}</span>
                      )}
                    </div>
                    {t.dnx_description && <div className={styles.desc}>{t.dnx_description}</div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
