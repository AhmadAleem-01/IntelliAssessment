import { useState } from 'react';
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
  DocumentBulletList20Regular,
  Rocket16Regular,
} from '@fluentui/react-icons';
import { useTemplate, usePublishTemplate } from './api';
import { EditTemplateDialog } from './EditTemplateDialog';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';
import { lookupName } from '../../lib/dataverse';
import { LevelTree } from './levels/LevelTree';
import { ScoringMatrix } from '../rules/ScoringMatrix';
import { AiConditioningMatrix } from './levels/AiConditioningMatrix';

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
  tabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  tab: {
    border: 'none',
    background: 'transparent',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 0.1s ease, border-color 0.1s ease',
    ':hover': { color: 'var(--color-text-primary)' },
  },
  tabActive: {
    color: 'var(--color-purple-text)',
    borderBottom: '2px solid var(--color-purple)',
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
  versionPill: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 6px',
    backgroundColor: 'var(--color-background-secondary)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-secondary)',
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
    flexWrap: 'wrap',
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
  banner: { marginBottom: '16px' },
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
});

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  Draft: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Draft' },
  Published: { bg: 'var(--color-green-soft)', color: 'var(--color-green-text)', label: 'Published' },
  Deprecated: { bg: 'var(--color-red-soft)', color: 'var(--color-red-text)', label: 'Deprecated' },
  Active: { bg: 'var(--color-green-soft)', color: 'var(--color-green-text)', label: 'Active' },
  Inactive: { bg: 'var(--color-gray-soft)', color: 'var(--color-gray-text)', label: 'Inactive' },
};

export function TemplateEditorPage() {
  const styles = useStyles();
  const { templateId } = useParams<{ templateId: string }>();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const publish = usePublishTemplate(templateId ?? '');
  // Three views over the same template — Structure (tree authoring), Scoring
  // (one row per level, inline rule editing), and AI conditioning (one row per
  // question, inline evidence-binding editing). Tab state is local since it
  // doesn't survive page reloads — fine for now.
  const [tab, setTab] = useState<'structure' | 'scoring' | 'ai'>('structure');

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
        <ChevronLeft16Regular /> Back to templates
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

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconChip}>
            <DocumentBulletList20Regular />
          </div>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{template.dnx_template_name}</h1>
            <div className={styles.metaRow}>
              <span className={styles.versionPill}>v{template.dnx_template_version ?? 1}</span>
              <span
                className={styles.statusPill}
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
              {template.dnx_published_on && (
                <span>
                  Published {new Date(template.dnx_published_on).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          {isDraft && (
            <Button
              appearance="primary"
              icon={<Rocket16Regular />}
              disabled={publish.isPending}
              onClick={() => publish.mutate(template.dnx_template_version ?? 1)}
            >
              {publish.isPending ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          <EditTemplateDialog
            template={template}
            trigger={
              <Button appearance="secondary" icon={<Edit16Regular />}>
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
                {lookupName(template, 'ownerid') ?? '—'}
              </span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Created by</span>
              <span className={styles.fieldValue}>
                {lookupName(template, 'createdby') ?? '—'}
              </span>
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
              <div className={styles.fieldLabel} style={{ marginBottom: 6 }}>
                Description
              </div>
              <div className={styles.descText}>{template.dnx_description}</div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'structure' ? styles.tabActive : ''}`}
          onClick={() => setTab('structure')}
        >
          Structure
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'scoring' ? styles.tabActive : ''}`}
          onClick={() => setTab('scoring')}
        >
          Scoring & evaluation
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'ai' ? styles.tabActive : ''}`}
          onClick={() => setTab('ai')}
        >
          AI conditioning
        </button>
      </div>

      {tab === 'structure' ? (
        <LevelTree templateId={template.dnx_assessment_templateid} />
      ) : tab === 'scoring' ? (
        <ScoringMatrix templateId={template.dnx_assessment_templateid} />
      ) : (
        <AiConditioningMatrix templateId={template.dnx_assessment_templateid} />
      )}
    </div>
  );
}
