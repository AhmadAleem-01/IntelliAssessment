import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  Edit16Regular,
  Delete16Regular,
  Rocket16Regular,
} from '@fluentui/react-icons';
import { useTemplate, usePublishTemplate } from './api';
import { EditTemplateDialog } from './EditTemplateDialog';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { Dnx_assessment_templatesstatuscode } from '../../generated/models/Dnx_assessment_templatesModel';
import { lookupName } from '../../lib/dataverse';
import { useCurrentUserRoles } from '../../lib/roles';
import { LevelTree } from './levels/LevelTree';
import { ScoringMatrix } from '../rules/ScoringMatrix';
import { AiConditioningMatrix } from './levels/AiConditioningMatrix';
import { LetterBuilder } from '../letter/LetterBuilder';
import { DetailsBuilder } from '../applicationDetails/DetailsBuilder';
import { useTemplateLevels } from './levels/api';
import { parseEvidenceBinding } from './levels/evidenceBinding';
import { useAssessmentInstances } from '../assessments/api';
import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';

/*
 * Template editor — Design System v1.0 "Calm Efficiency".
 *
 * Page shell: breadcrumb, a header (title + version + status + a meta line of
 * owner/usage), underline tabs, and — on the Structure tab — a right rail with
 * AI coverage, usage, description, and provenance cards. Every rail metric is
 * computed from real data (levels + a single instances query); nothing is
 * fabricated. The tab bodies (LevelTree / ScoringMatrix / AiConditioningMatrix /
 * LetterBuilder / DetailsBuilder) are unchanged — this is a shell redesign.
 */

type Tab = 'structure' | 'scoring' | 'ai' | 'letter' | 'details';

const TABS: { key: Tab; label: string }[] = [
  { key: 'structure', label: 'Structure' },
  { key: 'scoring', label: 'Scoring & evaluation' },
  { key: 'ai', label: 'AI conditioning' },
  { key: 'letter', label: 'Letter' },
  { key: 'details', label: 'Details' },
];

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '20px' },

  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
  },
  crumbLink: {
    color: 'var(--ds-brand-accent)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  crumbHere: {
    color: 'var(--ds-text-body)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '420px',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  vBadge: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 7px',
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
    border: '1px solid var(--ds-border)',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
  },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-caption)',
    flexWrap: 'wrap',
  },
  metaDot: { color: 'var(--ds-border-strong, #cbd5e1)' },

  headerActions: { display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' },
  iconBtn: {
    // Square button whose height matches the "Edit template" button so the
    // two align on the header baseline.
    minWidth: '32px',
    width: '32px',
    height: '32px',
    padding: 0,
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
    ':hover': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-strong)' },
  },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
  },

  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid var(--ds-border)',
  },
  tab: {
    border: 'none',
    background: 'transparent',
    padding: '10px 14px',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-muted)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'color 0.12s ease, border-color 0.12s ease',
    ':hover': { color: 'var(--ds-text-strong)' },
  },
  tabActive: {
    color: 'var(--ds-text-strong)',
    fontWeight: 600,
    borderBottom: '2px solid var(--ds-brand-primary)',
  },

  banner: { marginBottom: '0' },

  /* Two-column body — main + rail. Rail only on Structure. */
  bodyGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 320px',
    gap: '20px',
    alignItems: 'start',
    '@media (max-width: 1080px)': { gridTemplateColumns: '1fr' },
  },
  bodyFull: { display: 'block' },
  rail: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 },

  /* AI coverage — dark hero */
  aiCard: {
    backgroundColor: 'var(--ds-brand-primary)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '18px 20px',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  aiTitle: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  aiBig: { display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0 2px' },
  aiNum: { fontSize: '34px', fontWeight: 700, lineHeight: 1, color: '#fff' },
  aiOf: { fontSize: 'var(--ds-fs-body)', color: 'rgba(255,255,255,0.72)' },
  aiTrack: {
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    margin: '10px 0 12px',
  },
  aiFill: {
    display: 'block',
    height: '100%',
    borderRadius: '999px',
    backgroundColor: 'var(--ds-ai-primary, #8B5CF6)',
    minWidth: '2px',
  },
  aiNote: { fontSize: 'var(--ds-fs-caption)', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' },

  /* Generic rail card */
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '16px 18px',
  },
  cardTitle: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    marginBottom: '12px',
  },

  /* Usage rows */
  usageRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 0',
  },
  usageBar: { width: '3px', height: '15px', borderRadius: '2px', flexShrink: 0 },
  usageLabel: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)', flex: 1 },
  usageVal: { fontSize: 'var(--ds-fs-body)', fontWeight: 700, color: 'var(--ds-text-strong)' },
  amberNote: {
    marginTop: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    border: '1px solid var(--ds-pending, #F59E0B)',
    fontSize: 'var(--ds-fs-caption)',
    lineHeight: 1.5,
    color: '#b45309',
  },

  descText: {
    fontSize: 'var(--ds-fs-body)',
    lineHeight: 1.6,
    color: 'var(--ds-text-body)',
    whiteSpace: 'pre-wrap',
  },
  descEmpty: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)', fontStyle: 'italic' },

  metaCard: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metaItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  metaKey: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-muted)',
  },
  metaVal: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)' },
});

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  Draft: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'Draft' },
  Published: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'Published' },
  Deprecated: { bg: 'var(--ds-not-suitable-soft)', color: '#b91c1c', dot: 'var(--ds-not-suitable)', label: 'Deprecated' },
  Active: { bg: 'var(--ds-suitable-soft)', color: '#047857', dot: 'var(--ds-suitable)', label: 'Active' },
  Inactive: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'Inactive' },
};

const shortDate = (v: string | undefined) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';
const longDate = (v: string | undefined) =>
  v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function TemplateEditorPage() {
  const styles = useStyles();
  const roles = useCurrentUserRoles();
  const { templateId } = useParams<{ templateId: string }>();
  const { data: template, isLoading, error } = useTemplate(templateId);
  const publish = usePublishTemplate(templateId ?? '');
  const [tab, setTab] = useState<Tab>('structure');

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
  const version = template.dnx_template_version ?? 1;
  const templateGuid = template.dnx_assessment_templateid;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link to="/templates" className={styles.crumbLink}>
          Templates
        </Link>
        <span>/</span>
        <span className={styles.crumbHere}>{template.dnx_template_name}</span>
      </div>

      {publish.error && (
        <MessageBar intent="error" className={styles.banner}>
          <MessageBarBody>Publish failed: {(publish.error as Error).message}</MessageBarBody>
        </MessageBar>
      )}
      {publish.isSuccess && (
        <MessageBar intent="success" className={styles.banner}>
          <MessageBarBody>Template published. Bumped to v{version}.</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{template.dnx_template_name}</h1>
            <span className={styles.vBadge}>v{version}</span>
            <span
              className={styles.statusPill}
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              <span className={styles.statusDot} style={{ backgroundColor: status.dot }} />
              {status.label}
            </span>
          </div>
          <HeaderMeta styles={styles} template={template} />
        </div>

        <div className={styles.headerActions}>
          {isDraft && (
            <Button
              appearance="primary"
              className={styles.primaryBtn}
              icon={<Rocket16Regular />}
              disabled={publish.isPending}
              onClick={() => publish.mutate(version)}
            >
              {publish.isPending ? 'Publishing…' : 'Publish'}
            </Button>
          )}
          <EditTemplateDialog
            template={template}
            trigger={
              <Button className={styles.primaryBtn} appearance="primary" icon={<Edit16Regular />}>
                Edit template
              </Button>
            }
          />
          {roles.canAdmin && (
            <DeleteTemplateDialog
              templateId={templateGuid}
              templateName={template.dnx_template_name}
              trigger={
                <Button
                  className={styles.iconBtn}
                  appearance="subtle"
                  icon={<Delete16Regular />}
                  aria-label="Delete template"
                />
              }
            />
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'structure' ? (
        <div className={styles.bodyGrid}>
          <LevelTree templateId={templateGuid} />
          <div className={styles.rail}>
            <AiCoverageCard styles={styles} templateId={templateGuid} />
            <UsageCard styles={styles} templateId={templateGuid} version={version} />
            <div className={styles.card}>
              <div className={styles.cardTitle}>Description</div>
              {template.dnx_description ? (
                <div className={styles.descText}>{template.dnx_description}</div>
              ) : (
                <div className={styles.descEmpty}>No description yet.</div>
              )}
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaItem}>
                <span className={styles.metaKey}>Created</span>
                <span className={styles.metaVal}>
                  {longDate(template.createdon)}
                  {lookupName(template, 'createdby') ? ` by ${lookupName(template, 'createdby')}` : ''}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaKey}>Published</span>
                <span className={styles.metaVal}>{longDate(template.dnx_published_on)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.bodyFull}>
          {tab === 'scoring' ? (
            <ScoringMatrix templateId={templateGuid} />
          ) : tab === 'ai' ? (
            <AiConditioningMatrix templateId={templateGuid} />
          ) : tab === 'letter' ? (
            <LetterBuilder templateId={templateGuid} />
          ) : (
            <DetailsBuilder templateId={templateGuid} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Header meta line: Owner · Updated · N assessments · N projects ---- */
function HeaderMeta({
  styles,
  template,
}: {
  styles: ReturnType<typeof useStyles>;
  template: { dnx_assessment_templateid: string; modifiedon?: string } & Record<string, unknown>;
}) {
  const { data: instances } = useAssessmentInstances();
  const usage = useMemo(
    () => usageFor(instances, template.dnx_assessment_templateid),
    [instances, template.dnx_assessment_templateid],
  );
  const owner = lookupName(template, 'ownerid');
  return (
    <div className={styles.metaRow}>
      {owner && (
        <>
          <span>Owner {owner}</span>
          <span className={styles.metaDot}>·</span>
        </>
      )}
      <span>Updated {shortDate(template.modifiedon)}</span>
      <span className={styles.metaDot}>·</span>
      <span>
        {usage.assessments} assessment{usage.assessments === 1 ? '' : 's'}
      </span>
      <span className={styles.metaDot}>·</span>
      <span>
        {usage.projects} project{usage.projects === 1 ? '' : 's'}
      </span>
    </div>
  );
}

/* ---- AI coverage: how many Question levels have an evidence/AI binding ---- */
function AiCoverageCard({
  styles,
  templateId,
}: {
  styles: ReturnType<typeof useStyles>;
  templateId: string;
}) {
  const { data: levels } = useTemplateLevels(templateId);
  const { questions, bound } = useMemo(() => {
    let q = 0;
    let b = 0;
    for (const l of levels ?? []) {
      if (l.dnx_assessment_level_type !== 3) continue;
      q += 1;
      const binding = parseEvidenceBinding(l.dnx_document_type_reference);
      // A question is "AI bound" when it has an evidence query and/or an
      // application-data binding it can answer from.
      if (binding && (binding.query.trim() || (binding.applicationDataPaths?.length ?? 0) > 0)) {
        b += 1;
      }
    }
    return { questions: q, bound: b };
  }, [levels]);

  const pct = questions > 0 ? Math.round((bound / questions) * 100) : 0;

  return (
    <div className={`${styles.aiCard} ai-glow-border`}>
      <div className={styles.aiTitle}>AI coverage</div>
      <div className={styles.aiBig}>
        <span className={styles.aiNum}>{bound}</span>
        <span className={styles.aiOf}>of {questions} questions bound</span>
      </div>
      <div className={styles.aiTrack}>
        <span className={styles.aiFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.aiNote}>
        Unbound questions must be answered by hand on every assessment.
      </div>
    </div>
  );
}

/* ---- Usage: live assessments / projects / signed-off, all from instances ---- */
function UsageCard({
  styles,
  templateId,
  version,
}: {
  styles: ReturnType<typeof useStyles>;
  templateId: string;
  version: number;
}) {
  const { data: instances } = useAssessmentInstances();
  const { assessments, projects, signedOff } = useMemo(() => {
    const mine = (instances ?? []).filter(
      (i) =>
        ((i as unknown as Record<string, unknown>)['_dnx_assessmenttemplate_value'] as
          | string
          | undefined) === templateId,
    );
    const projectIds = new Set<string>();
    let signed = 0;
    for (const i of mine) {
      const pid = (i as unknown as Record<string, unknown>)['_dnx_project_value'] as
        | string
        | undefined;
      if (pid) projectIds.add(pid);
      // Complete (778540004) === signed off. Honest count from status.
      if (i.statuscode === 778540004) signed += 1;
    }
    return { assessments: mine.length, projects: projectIds.size, signedOff: signed };
  }, [instances, templateId]);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Usage</div>
      <div className={styles.usageRow}>
        <span className={styles.usageBar} style={{ backgroundColor: 'var(--ds-brand-accent)' }} />
        <span className={styles.usageLabel}>Live assessments</span>
        <span className={styles.usageVal}>{assessments}</span>
      </div>
      <div className={styles.usageRow}>
        <span className={styles.usageBar} style={{ backgroundColor: 'var(--ds-ai-primary, #8B5CF6)' }} />
        <span className={styles.usageLabel}>Projects</span>
        <span className={styles.usageVal}>{projects}</span>
      </div>
      <div className={styles.usageRow}>
        <span className={styles.usageBar} style={{ backgroundColor: 'var(--ds-suitable)' }} />
        <span className={styles.usageLabel}>Signed off</span>
        <span className={styles.usageVal}>{signedOff}</span>
      </div>
      {assessments > 0 && (
        <div className={styles.amberNote}>
          Editing publishes v{version + 1}. The {assessments} live assessment
          {assessments === 1 ? '' : 's'} stay on v{version}.
        </div>
      )}
    </div>
  );
}

/* Shared usage rollup for a single template from the instances list. */
function usageFor(
  instances: Dnx_assessment_instances[] | undefined,
  templateId: string,
): { assessments: number; projects: number } {
  let assessments = 0;
  const projectIds = new Set<string>();
  for (const i of instances ?? []) {
    const tid = (i as unknown as Record<string, unknown>)['_dnx_assessmenttemplate_value'] as
      | string
      | undefined;
    if (tid !== templateId) continue;
    assessments += 1;
    const pid = (i as unknown as Record<string, unknown>)['_dnx_project_value'] as
      | string
      | undefined;
    if (pid) projectIds.add(pid);
  }
  return { assessments, projects: projectIds.size };
}
