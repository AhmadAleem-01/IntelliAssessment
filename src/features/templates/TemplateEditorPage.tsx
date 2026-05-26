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
  DocumentBulletList24Regular,
  Rocket20Regular,
} from '@fluentui/react-icons';
import { useTemplate, usePublishTemplate } from './api';
import { EditTemplateDialog } from './EditTemplateDialog';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';

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
  mark: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px -10px rgba(236,72,153,0.55)',
    flexShrink: 0,
  },
  heroText: { flex: 1, minWidth: 0 },
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
    flexWrap: 'wrap',
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
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%' },
  heroActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    padding: '32px',
    borderRadius: 'var(--app-radius-lg)',
    border: '1.5px dashed var(--app-border)',
    color: 'var(--app-text-muted)',
    fontSize: '14px',
    background: 'var(--app-surface)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  placeholderTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--app-text)',
  },
  banner: {
    marginBottom: '20px',
  },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  Draft: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  Published: { bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  Deprecated: { bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
  Active: { bg: '#ecfdf5', color: '#047857', dot: '#10b981' },
  Inactive: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
};

export function TemplateEditorPage() {
  const styles = useStyles();
  const { templateId } = useParams<{ templateId: string }>();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const publish = usePublishTemplate(templateId ?? '');

  if (isLoading) return <Spinner label="Loading template..." />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!template) return null;

  const label =
    Dnx_assessment_templatesstatuscode[
      template.statuscode as keyof typeof Dnx_assessment_templatesstatuscode
    ] ?? 'Draft';
  const status = STATUS_STYLES[label] ?? STATUS_STYLES.Draft;
  const isDraft = label === 'Draft';

  return (
    <div>
      <Link to="/templates" className={styles.backLink}>
        <ChevronLeft20Regular /> Back to templates
      </Link>

      {publish.error && (
        <MessageBar intent="error" className={styles.banner}>
          <MessageBarBody>
            Publish failed: {(publish.error as Error).message}
          </MessageBarBody>
        </MessageBar>
      )}
      {publish.isSuccess && (
        <MessageBar intent="success" className={styles.banner}>
          <MessageBarBody>
            Template published. Bumped to v{template.dnx_template_version}.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.hero}>
        <div className={styles.mark}>
          <DocumentBulletList24Regular />
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.title}>{template.dnx_template_name}</h1>
          <div className={styles.metaRow}>
            <span className={styles.versionPill}>v{template.dnx_template_version ?? 1}</span>
            <span
              className={styles.statusPill}
              style={{ background: status.bg, color: status.color }}
            >
              <span className={styles.statusDot} style={{ background: status.dot }} />
              {label}
            </span>
            {template.dnx_published_on && (
              <span>
                Published {new Date(template.dnx_published_on).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className={styles.heroActions}>
          {isDraft && (
            <Button
              appearance="primary"
              icon={<Rocket20Regular />}
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate(template.dnx_template_version ?? 1)
              }
            >
              {publish.isPending ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          <EditTemplateDialog
            template={template}
            trigger={
              <Button appearance="secondary" icon={<Edit20Regular />}>
                Edit
              </Button>
            }
          />
          <DeleteTemplateDialog
            templateId={template.dnx_assessment_templateid}
            templateName={template.dnx_template_name}
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
            <span className={styles.fieldValue}>{template.owneridname ?? '—'}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Created</span>
            <span className={styles.fieldValue}>
              {template.createdon ? new Date(template.createdon).toLocaleString() : '—'}
            </span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Last modified</span>
            <span className={styles.fieldValue}>
              {template.modifiedon ? new Date(template.modifiedon).toLocaleString() : '—'}
            </span>
          </div>
        </div>
        {template.dnx_description && (
          <div className={styles.description}>
            <div className={styles.sectionLabel}>Description</div>
            <div className={styles.descText}>{template.dnx_description}</div>
          </div>
        )}
      </div>

      <div className={styles.placeholder}>
        <div className={styles.placeholderTitle}>Tree editor coming next</div>
        <div>
          The Root → Section → Subsection → Question authoring experience lands in
          Milestone 3.
        </div>
      </div>
    </div>
  );
}
