import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  CheckmarkCircle16Filled,
  ErrorCircle16Filled,
} from '@fluentui/react-icons';
import { Button } from '@fluentui/react-components';
import {
  SendCopy20Regular,
  CheckmarkCircle16Regular,
  DismissCircle16Regular,
  PersonStar16Regular,
} from '@fluentui/react-icons';
import {
  useAssessmentInstance,
  useUpsertResponse,
  useAssessmentResponses,
  useSaveEvidenceMapping,
  useReviewerComments,
} from './api';
import { ChecklistRenderer } from './ChecklistRenderer';
import { CommentsDrawer, useGeneralCommentCount } from './CommentsDrawer';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';
import { EvidenceCard } from '../evidence/EvidenceCard';
import { Comment20Regular, History20Regular, Sparkle16Filled } from '@fluentui/react-icons';
import { SubmitAssessmentDialog } from './SubmitAssessmentDialog';
import { ApproveAssessmentDialog } from './ApproveAssessmentDialog';
import { RejectAssessmentDialog } from './RejectAssessmentDialog';
import { Dnx_assessment_instancesstatuscode } from '../../generated/models/Dnx_assessment_instancesModel';
import { lookupName, lookupId } from '../../lib/dataverse';
import { useCurrentUserRoles } from '../../lib/roles';
import { ApplicationDetailsCard } from '../applicationDetails/ApplicationDetailsCard';
import { ApplicationDetailsFab } from '../applicationDetails/ApplicationDetailsFab';
import { useScrolledPast } from '../../lib/useScrolledPast';
import { useApplicationDetails } from '../applicationDetails/api';
import { collectUsedPaths } from '../applicationDetails/usedPaths';
import { Tooltip } from '@fluentui/react-components';
import { DocumentText20Regular } from '@fluentui/react-icons';
import { LetterDialog } from '../letter/LetterDialog';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import { useCriteriaForLevels } from '../rules/api';
import { evaluateAssessment, findRootCriteria } from '../rules/engine';
import { indexResponses, hasAnswer, isQuestionVisible } from './responseHelpers';
import type { EvaluationOutcome } from '../rules/types';
import { AiPopulateDialog, type AcceptedSuggestion } from '../evidence/AiPopulateDialog';
import { useEvidenceFiles } from '../evidence/api';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';

/*
 * Assessment detail — the heaviest screen — migrated to Design System v1.0
 * ("Calm Efficiency"): 24px title, spacious white cards, dotted rounded-full
 * status/outcome pills, blue accent for links/primary actions, semantic
 * green/amber reviewer actions. Violet is deliberately NOT used here — it is
 * reserved for the AI surfaces (EvidenceCard's AI button, the AI dialog, the
 * per-answer AI badge), which keep their own violet identity.
 */
const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: '18px' },

  /* Breadcrumb + title */
  crumbs: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  crumbLink: { color: 'var(--ds-text-muted)', textDecoration: 'none', ':hover': { color: 'var(--ds-brand-accent)' } },
  crumbSep: { color: 'var(--ds-border)' },
  crumbCurrent: { color: 'var(--ds-text-body)' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  metaText: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  overdue: { fontSize: 'var(--ds-fs-caption)', color: '#b91c1c', fontWeight: 600 },
  versionText: { fontSize: '11px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--ds-text-muted)' },

  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', flexShrink: 0 },
  iconAction: {
    position: 'relative',
    minWidth: '36px',
    color: 'var(--ds-text-body)',
  },
  actionBadge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    minWidth: '15px',
    height: '15px',
    padding: '0 3px',
    borderRadius: '999px',
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 700,
    lineHeight: '15px',
    textAlign: 'center',
  },
  headerProgress: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', minWidth: '180px' },
  headerProgressLabel: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums' },
  headerProgressTrack: { display: 'block', width: '180px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--ds-surface-base)', overflow: 'hidden' },
  headerProgressFill: { display: 'block', height: '100%', borderRadius: '999px', backgroundColor: 'var(--ds-brand-accent)', minWidth: '2px', transition: 'width 0.25s ease' },

  /* 3-column body */
  body: {
    display: 'grid',
    gridTemplateColumns: '232px minmax(0, 1fr) 320px',
    gap: '20px',
    // NOTE: no `align-items: start` — the rail columns must stretch to the row
    // (center checklist) height so their sticky children have the full scroll
    // range to travel. With content-height columns, sticky can't move.
    '@media (max-width: 1100px)': { gridTemplateColumns: 'minmax(0, 1fr) 320px' },
    '@media (max-width: 820px)': { gridTemplateColumns: '1fr' },
  },

  /* Left rail */
  leftRail: { '@media (max-width: 1100px)': { display: 'none' } },
  navSticky: { display: 'flex', flexDirection: 'column', gap: '16px' },
  railHead: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ds-text-muted)' },
  navList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '9px 12px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid transparent',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    ':hover': { backgroundColor: 'var(--ds-surface-card)', borderColor: 'var(--ds-border)' },
  },
  navDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  navName: { flex: 1, minWidth: 0, fontSize: 'var(--ds-fs-body)', fontWeight: 500, color: 'var(--ds-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  navCount: { fontSize: '11px', color: 'var(--ds-text-muted)', fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
  templateCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '14px',
    borderRadius: 'var(--ds-radius-card)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
  },
  templateLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--ds-text-strong)' },
  templateName: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-body)' },
  templateMeta: { fontSize: '11px', color: 'var(--ds-text-muted)', marginTop: '3px' },

  /* Center + right rail */
  center: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 },
  rightRail: { '@media (max-width: 820px)': { gridColumn: '1' } },
  railSticky: { display: 'flex', flexDirection: 'column', gap: '16px' },

  /* AI card (dark, violet glow) */
  aiCard: {
    backgroundColor: 'var(--ds-brand-primary)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    color: '#fff',
  },
  aiTitle: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: '#fff' },
  aiDesc: { fontSize: 'var(--ds-fs-caption)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 },
  aiBtn: {
    marginTop: '2px',
    padding: '10px 16px',
    borderRadius: 'var(--border-radius-md)',
    border: 'none',
    backgroundColor: 'var(--ds-ai-primary)',
    color: '#fff',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    cursor: 'pointer',
    ':hover': { backgroundColor: '#7c46f0' },
  },

  /* Floating quick-jump to application details — a circular icon button that
     expands on hover to reveal its label (matches the back-to-top FAB shape;
     sits just above it). See the shared `.fab-expand` helper in index.css. */
  jumpAppData: {
    position: 'fixed',
    right: '24px',
    bottom: '78px',
    zIndex: 40,
    border: '1px solid var(--ds-ai-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-ai-primary)',
    boxShadow: '0 6px 20px -6px rgba(17, 24, 39, 0.35)',
    ':hover': { backgroundColor: 'var(--ds-ai-surface)' },
  },

  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 500,
    color: 'var(--ds-text-muted)',
    textDecoration: 'none',
    marginBottom: '16px',
    ':hover': { color: 'var(--ds-brand-accent)' },
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
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  iconChip: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
  title: {
    fontSize: 'var(--ds-fs-h1)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-caption)',
    flexWrap: 'wrap',
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
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 600,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
  },
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  cardHeader: {
    padding: '18px 22px',
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-heading)',
  },
  cardBody: { padding: '0 22px 22px' },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '18px 28px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  fieldLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  fieldValue: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-body)',
  },
  templateLink: {
    color: 'var(--ds-brand-accent)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  projectLink: {
    color: 'var(--ds-brand-accent)',
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
    ':hover:active': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
  },
  placeholder: {
    padding: '28px',
    borderRadius: 'var(--ds-radius-card)',
    border: '1px dashed var(--ds-border)',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
    backgroundColor: 'var(--ds-surface-card)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  placeholderTitle: {
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
  },
  reviewerPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    borderRadius: 'var(--ds-radius-card)',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    border: '1px solid var(--ds-brand-accent)',
    marginBottom: '16px',
  },
  reviewerMark: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewerCopy: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  reviewerTitle: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
  },
  reviewerSub: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-body)',
    lineHeight: 1.45,
  },
  reviewerActions: { display: 'flex', gap: '8px', flexShrink: 0 },
  approveBtn: {
    backgroundColor: 'var(--ds-suitable) !important',
    color: '#fff !important',
    border: '1px solid transparent !important',
    ':hover': {
      backgroundColor: '#0f9f74 !important',
    },
  },
  rejectBtn: {
    color: '#b45309 !important',
    backgroundColor: 'transparent !important',
    border: '1px solid var(--ds-pending) !important',
    ':hover': {
      backgroundColor: 'var(--ds-pending-soft) !important',
    },
  },
  // Calm card with a straight (square) left accent bar — a real 3px left
  // border with the left corners squared off, so the accent is a flat edge
  // flush to the card rather than a rounded inset shadow.
  feedbackBanner: {
    padding: '14px 16px 14px 18px',
    borderRadius: 'var(--ds-radius-card)',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    border: '1px solid var(--ds-border)',
    borderLeftWidth: '3px',
    backgroundColor: 'var(--ds-surface-card)',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  feedbackTitle: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  feedbackDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  feedbackMeta: {
    marginLeft: '6px',
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 0,
    color: 'var(--ds-text-muted)',
    fontSize: '11px',
  },
  feedbackBody: {
    fontSize: 'var(--ds-fs-body)',
    lineHeight: 1.5,
    color: 'var(--ds-text-body)',
    whiteSpace: 'pre-wrap',
  },
  feedbackFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '10px',
    paddingTop: '12px',
    borderTop: '1px solid var(--ds-border)',
  },
  feedbackFootText: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  feedbackFootActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  feedbackThreadLink: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-text-body)',
    ':hover': { color: 'var(--ds-text-strong)' },
  },
  primaryBtnDark: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
  },
  saveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
  },
  saveBadgeIdle: {
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
  },
  saveBadgeSaving: {
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
  },
  saveBadgeSaved: {
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
  },
  saveBadgeError: {
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
  },
  spinDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
    opacity: 0.6,
    animationName: 'save-pulse',
    animationDuration: '0.9s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
});

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; dot: string; label: string }
> = {
  Draft: { bg: 'var(--ds-surface-base)', color: 'var(--ds-text-body)', dot: 'var(--ds-text-muted)', label: 'draft' },
  InProgress: {
    bg: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    dot: 'var(--ds-brand-accent)',
    label: 'in progress',
  },
  PendingReview: {
    bg: 'var(--ds-pending-soft)',
    color: '#b45309',
    dot: 'var(--ds-pending)',
    label: 'pending review',
  },
  Complete: {
    bg: 'var(--ds-suitable-soft)',
    color: '#047857',
    dot: 'var(--ds-suitable)',
    label: 'complete',
  },
  Active: { bg: 'var(--ds-brand-accent-soft)', color: 'var(--ds-brand-accent)', dot: 'var(--ds-brand-accent)', label: 'active' },
  Inactive: {
    bg: 'var(--ds-surface-base)',
    color: 'var(--ds-text-body)',
    dot: 'var(--ds-text-muted)',
    label: 'inactive',
  },
};

export function AssessmentPage() {
  const styles = useStyles();
  // Snapshot "now" once (point-in-time overdue calc; keeps render pure).
  const [now] = useState(() => Date.now());
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { data: assessment, isLoading, error } = useAssessmentInstance(assessmentId);
  const roles = useCurrentUserRoles();
  // Application-details JSON for this instance — powers per-level detail panels
  // and feeds AI bindings. Only fetched when the instance actually has a file.
  const { data: applicationData } = useApplicationDetails(
    assessmentId,
    !!assessment?.dnx_application_details_name,
    assessment?.dnx_application_details_name,
  );

  // Autosave state — lifted here so the badge in the hero can see the upsert
  // mutation's status. ChecklistRenderer gets the mutation via prop.
  const upsert = useUpsertResponse(assessmentId ?? '');
  const saveMapping = useSaveEvidenceMapping(assessmentId ?? '');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // When "Reply" is clicked on a flagged question, open Comments pre-tagging it.
  const [replyTagLevelId, setReplyTagLevelId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // M6b — AI auto-fill: mapping + review dialog open state.
  const [aiOpen, setAiOpen] = useState(false);
  // The floating application-details reference only appears once scrolled down —
  // in sync with the back-to-top FAB.
  const scrolledDown = useScrolledPast(400);
  const generalCommentCount = useGeneralCommentCount(assessmentId);
  useEffect(() => {
    if (upsert.isSuccess && upsert.data) {
      setLastSavedAt(new Date());
    }
  }, [upsert.isSuccess, upsert.data]);

  // Live outcome preview for the hero chip. Pulled from the same data the
  // checklist already loads downstream — React Query dedupes the queries.
  const templateIdForOutcome = assessment
    ? lookupId(assessment, 'dnx_assessmenttemplate')
    : undefined;
  const { data: levels } = useTemplateLevels(templateIdForOutcome);
  // Application-details attribute paths the template actually uses (AI bindings
  // + details panels) — the card validates the uploaded JSON against these.
  const requiredAppDataPaths = useMemo(() => collectUsedPaths(levels), [levels]);
  const { data: responses } = useAssessmentResponses(assessmentId);
  const allLevelIds = (levels ?? []).map((l) => l.dnx_assessment_levelid);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);
  // Real uploaded evidence files — offered as mapping targets in the auto-fill
  // dialog. Keyed off the assessment name (same key the EvidenceCard uses, so
  // React Query dedupes this query).
  const { data: evidenceFiles } = useEvidenceFiles(assessment?.dnx_assessment_name);
  const responsesByLevelId = indexResponses(responses);
  const liveOutcome: EvaluationOutcome = levels
    ? evaluateAssessment(
        buildTree(levels),
        criteriaByLevelId,
        responsesByLevelId,
        findRootCriteria(levels, criteriaByLevelId),
      )
    : { kind: 'not-evaluable', reason: 'no-children' };

  // Per-section answered counts for the left nav + header progress. Walks each
  // top-level Section, counting VISIBLE questions and how many have an answer.
  // Same source the checklist uses (deduped), so the numbers always agree.
  const sectionSummary = useMemo(() => {
    if (!levels) return { sections: [], totalVisible: 0, totalAnswered: 0 };
    const byId = new Map(levels.map((l) => [l.dnx_assessment_levelid, l] as const));
    const tree = buildTree(levels);
    let totalVisible = 0;
    let totalAnswered = 0;
    const countNode = (node: LevelNode): { visible: number; answered: number } => {
      let visible = 0;
      let answered = 0;
      const walk = (n: LevelNode) => {
        const lt = n.level.dnx_assessment_level_type as LevelType;
        if (lt === 3) {
          if (!isQuestionVisible(n.level, byId, responsesByLevelId)) return;
          visible += 1;
          if (hasAnswer(responsesByLevelId.get(n.level.dnx_assessment_levelid))) answered += 1;
          return;
        }
        n.children.forEach(walk);
      };
      walk(node);
      return { visible, answered };
    };
    const sections = tree
      .filter((n) => (n.level.dnx_assessment_level_type as LevelType) === 1)
      .map((n) => {
        const c = countNode(n);
        totalVisible += c.visible;
        totalAnswered += c.answered;
        return {
          id: n.level.dnx_assessment_levelid,
          name: n.level.dnx_name,
          visible: c.visible,
          answered: c.answered,
        };
      });
    return { sections, totalVisible, totalAnswered };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, responses]);

  // Questions the AI should attempt: ALL Question-type levels. We deliberately
  // do NOT filter by answered or visible state here — the assessor can re-fill
  // an already-answered question, and a question hidden by a visibility rule on
  // screen can still be answered from evidence. The review step lets them pick
  // which proposals to apply, so offering everything is safe. The dialog itself
  // narrows to questions that carry a file variable (via groupByFileVariable).
  const aiQuestions: Dnx_assessment_levels[] = (levels ?? []).filter(
    (l) => (l.dnx_assessment_level_type as LevelType) === 3,
  );
  // Level ids that already have an answer — passed to the dialog so the review
  // list can flag "accepting will overwrite the current answer".
  const answeredLevelIds = new Set(
    aiQuestions
      .filter((l) => hasAnswer(responsesByLevelId.get(l.dnx_assessment_levelid)))
      .map((l) => l.dnx_assessment_levelid),
  );

  // Persist one accepted suggestion through the normal upsert path so autosave,
  // version bump, and the AI badge all flow through the same code. The `ai`
  // payload flags the row as AI-populated with its confidence + rationale.
  const handleAcceptSuggestion = ({ level, suggestion }: AcceptedSuggestion) => {
    upsert.mutate({
      instanceId: assessment!.dnx_assessment_instanceid,
      levelId: level.dnx_assessment_levelid,
      questionName: level.dnx_name,
      dataType: (level.dnx_data_type ?? 3) as DataType,
      value: suggestion.value,
      ai: {
        confidence: suggestion.confidence,
        sourceSummary: suggestion.rationale,
        sourceAttributes: suggestion.usedAttributes,
      },
    });
  };

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
  const templateName = lookupName(assessment, 'dnx_assessmenttemplate');
  const assessor = lookupName(assessment, 'ownerid');

  const editable = label !== 'PendingReview' && label !== 'Complete';

  function jumpToSection(id: string) {
    window.dispatchEvent(new CustomEvent('intelli:jump-to-level', { detail: { levelId: id } }));
    const el = document.getElementById(`level-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const progressPct =
    sectionSummary.totalVisible > 0
      ? Math.round((sectionSummary.totalAnswered / sectionSummary.totalVisible) * 100)
      : 0;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.crumbs}>
            <Link to="/assessments" className={styles.crumbLink}>Assessments</Link>
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{assessment.dnx_assessment_name}</h1>
            <span
              className={styles.statusPill}
              style={{ backgroundColor: status.bg, color: status.color }}
            >
              <span className={styles.statusDot} style={{ backgroundColor: status.dot }} />
              {status.label}
            </span>
            {assessment.dnx_duedate && (() => {
              const due = new Date(assessment.dnx_duedate).getTime();
              const od = due < now && !['Complete', 'PendingReview'].includes(label);
              return od ? (
                <span className={styles.overdue}>
                  Overdue {Math.floor((now - due) / 86_400_000)}d
                </span>
              ) : (
                <span className={styles.metaText}>
                  Due {new Date(assessment.dnx_duedate).toLocaleDateString()}
                </span>
              );
            })()}
            <SaveBadge upsert={upsert} lastSavedAt={lastSavedAt} />
            <HeroOutcomeChip
              styles={styles}
              persisted={assessment.dnx_outcome as 0 | 1 | 2 | undefined | null}
              live={liveOutcome}
              statusLabel={label}
            />
          </div>
        </div>
        {templateId && (
          <div className={styles.headerRight}>
            {sectionSummary.totalVisible > 0 && (
              <div className={styles.headerProgress}>
                <span className={styles.headerProgressLabel}>
                  {sectionSummary.totalAnswered} of {sectionSummary.totalVisible} answered
                </span>
                <span className={styles.headerProgressTrack}>
                  <span className={styles.headerProgressFill} style={{ width: `${progressPct}%` }} />
                </span>
              </div>
            )}
            <div className={styles.headerActions}>
              {/* Secondary actions are icon-only (tooltip labels) so the header
                  stays uncluttered; only the primary action carries a label. */}
              <Tooltip
                content={`Comments${generalCommentCount > 0 ? ` (${generalCommentCount})` : ''}`}
                relationship="label"
              >
                <Button
                  appearance="subtle"
                  icon={<Comment20Regular />}
                  onClick={() => setCommentsOpen(true)}
                  className={styles.iconAction}
                >
                  {generalCommentCount > 0 && (
                    <span className={styles.actionBadge}>{generalCommentCount}</span>
                  )}
                </Button>
              </Tooltip>
              <Tooltip content="Version history" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<History20Regular />}
                  onClick={() => setHistoryOpen(true)}
                  className={styles.iconAction}
                />
              </Tooltip>
              <LetterDialog
                assessment={assessment}
                trigger={
                  <Tooltip content="Outcome letter" relationship="label">
                    <Button
                      appearance="subtle"
                      icon={<DocumentText20Regular />}
                      className={styles.iconAction}
                    />
                  </Tooltip>
                }
              />
              {editable && roles.canAssess && (
                <SubmitAssessmentDialog
                  instanceId={assessment.dnx_assessment_instanceid}
                  templateId={templateId}
                  alreadySubmitted={false}
                  trigger={
                    <Button appearance="primary" icon={<SendCopy20Regular />} className={styles.primaryBtn}>
                      Submit for review
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>

      <CommentsDrawer
        instanceId={assessment.dnx_assessment_instanceid}
        templateId={templateId ?? undefined}
        open={commentsOpen}
        onOpenChange={(o) => {
          setCommentsOpen(o);
          if (!o) setReplyTagLevelId(null);
        }}
        initialTaggedLevelId={replyTagLevelId}
      />
      <VersionHistoryDrawer
        instanceId={assessment.dnx_assessment_instanceid}
        templateId={templateId ?? undefined}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <AiPopulateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        assessmentName={assessment.dnx_assessment_name}
        questions={aiQuestions}
        answeredLevelIds={answeredLevelIds}
        availableFiles={(evidenceFiles ?? []).map((f) => f.fileName)}
        persistedMappingJson={assessment.dnx_evidence_mapping}
        onPersistMapping={(mapping) => saveMapping.mutate(mapping)}
        onAccept={handleAcceptSuggestion}
        applicationData={applicationData}
      />

      {/* Three columns: left nav (sticky) · center checklist · right rail (sticky) */}
      <div className={styles.body}>
        {/* Left: section nav + template */}
        <aside className={styles.leftRail}>
          <div className={styles.navSticky}>
            <span className={styles.railHead}>Sections</span>
            <nav className={styles.navList}>
              {sectionSummary.sections.map((s) => {
                const done = s.visible > 0 && s.answered === s.visible;
                const partial = s.answered > 0 && s.answered < s.visible;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.navItem}
                    onClick={() => jumpToSection(s.id)}
                  >
                    <span
                      className={styles.navDot}
                      style={{
                        backgroundColor: done
                          ? 'var(--ds-suitable)'
                          : partial
                            ? 'var(--ds-pending)'
                            : 'var(--ds-border)',
                      }}
                    />
                    <span className={styles.navName}>{s.name}</span>
                    <span className={styles.navCount}>
                      {s.answered}/{s.visible}
                    </span>
                  </button>
                );
              })}
            </nav>
            {templateName && (
              <div className={styles.templateCard}>
                <span className={styles.templateLabel}>Template</span>
                <span className={styles.templateName}>
                  {templateId ? (
                    <Link to={`/templates/${templateId}/edit`} className={styles.templateLink}>
                      {templateName}
                    </Link>
                  ) : (
                    templateName
                  )}
                </span>
                <span className={styles.templateMeta}>
                  {assessor ? `Assessor ${assessor}` : ''}
                  {assessment.createdon
                    ? ` · created ${new Date(assessment.createdon).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                    : ''}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Center: banners + checklist */}
        <main className={styles.center}>
          <ReviewerFeedbackBanner
            assessment={assessment}
            statusLabel={label}
            onOpenThread={() => setCommentsOpen(true)}
          />

          {label === 'PendingReview' && roles.canReview && (
            <div className={styles.reviewerPanel}>
              <div className={styles.reviewerMark}>
                <PersonStar16Regular />
              </div>
              <div className={styles.reviewerCopy}>
                <span className={styles.reviewerTitle}>Reviewer actions</span>
                <span className={styles.reviewerSub}>
                  {assessment.dnx_submittedon
                    ? `Submitted on ${new Date(assessment.dnx_submittedon).toLocaleDateString()}. `
                    : ''}
                  Approve to finalise the outcome, or send back to the assessor with notes.
                </span>
              </div>
              <div className={styles.reviewerActions}>
                <RejectAssessmentDialog
                  instanceId={assessment.dnx_assessment_instanceid}
                  templateId={templateId ?? ''}
                  trigger={
                    <Button className={styles.rejectBtn} appearance="secondary" icon={<DismissCircle16Regular />}>
                      Send back
                    </Button>
                  }
                />
                <ApproveAssessmentDialog
                  instanceId={assessment.dnx_assessment_instanceid}
                  trigger={
                    <Button className={styles.approveBtn} appearance="primary" icon={<CheckmarkCircle16Regular />}>
                      Approve
                    </Button>
                  }
                />
              </div>
            </div>
          )}

          {templateId ? (
            <ChecklistRenderer
              instanceId={assessment.dnx_assessment_instanceid}
              templateId={templateId}
              upsert={upsert}
              readOnly={label === 'PendingReview' || label === 'Complete'}
              pendingReview={label === 'PendingReview'}
              submittedOn={assessment.dnx_submittedon}
              canAssess={roles.canAssess}
              applicationData={applicationData}
              onReplyToFlag={(levelId) => {
                setReplyTagLevelId(levelId);
                setCommentsOpen(true);
              }}
            />
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderTitle}>Template missing</div>
              This assessment has no template linked. Open the instance in Dataverse to
              set one before answering.
            </div>
          )}
        </main>

        {/* Right rail: AI auto-fill · application data · evidence (sticky) */}
        <aside className={styles.rightRail}>
          <div className={styles.railSticky}>
            {editable && roles.canAssess && aiQuestions.length > 0 && (
              <div className={`${styles.aiCard} ai-glow-border`}>
                <span className={styles.aiTitle}>
                  <Sparkle16Filled />
                  AI auto-fill
                </span>
                <span className={styles.aiDesc}>
                  Draft answers from evidence and application data — you review before
                  anything is saved.
                </span>
                <button
                  type="button"
                  className={styles.aiBtn}
                  onClick={() => setAiOpen(true)}
                >
                  Draft answers
                </button>
              </div>
            )}

            <ApplicationDetailsCard
              instanceId={assessment.dnx_assessment_instanceid}
              detailsName={assessment.dnx_application_details_name}
              disabled={label === 'PendingReview' || label === 'Complete' || !roles.canAssess}
              requiredPaths={requiredAppDataPaths}
            />

            <EvidenceCard
              assessmentName={assessment.dnx_assessment_name}
              disabled={label === 'PendingReview' || label === 'Complete'}
            />
          </div>
        </aside>
      </div>

      {/* Floating application-details reference — expands IN PLACE (not a modal,
          which fought the webview's scroll). Only when the instance has app
          data and the assessor has scrolled down. */}
      {assessment.dnx_application_details_name && scrolledDown && (
        <ApplicationDetailsFab
          data={applicationData ?? null}
          detailsName={assessment.dnx_application_details_name}
        />
      )}
    </div>
  );
}

/**
 * Reviewer feedback banner — shown whenever `dnx_outcome_notes` is set.
 *
 * Three color variants by (status, outcome):
 *   - Complete + Suitable    → green   "Approved"
 *   - Complete + NotSuitable → red     "Marked not suitable"
 *   - InProgress + notes     → amber   "Sent back by reviewer"
 *
 * Persists across reopen cycles so the assessor always sees what the
 * reviewer said while they're fixing things up.
 */
function ReviewerFeedbackBanner({
  assessment,
  statusLabel,
  onOpenThread,
}: {
  assessment: import('../../generated/models/Dnx_assessment_instancesModel').Dnx_assessment_instances;
  statusLabel: string;
  onOpenThread?: () => void;
}) {
  const styles = useStyles();
  const { data: comments } = useReviewerComments(assessment.dnx_assessment_instanceid);
  const notes = assessment.dnx_outcome_notes?.trim();

  // Unresolved per-question flags → count + first flag's level (for jump).
  const unresolvedFlags = (comments ?? []).filter(
    (c) => !c.dnx_is_resolved && lookupId(c, 'dnx_assessment_level'),
  );
  const flagCount = unresolvedFlags.length;
  const firstFlagLevelId = flagCount > 0 ? lookupId(unresolvedFlags[0], 'dnx_assessment_level') : undefined;

  if (!notes && flagCount === 0) return null;

  const outcome = assessment.dnx_outcome;
  let title = 'Reviewer feedback';
  let accent = 'var(--ds-pending)';
  let titleColor = '#b45309';

  if (statusLabel === 'Complete' && outcome === 0) {
    title = 'Approved — suitable';
    accent = 'var(--ds-suitable)';
    titleColor = '#047857';
  } else if (statusLabel === 'Complete' && outcome === 1) {
    title = 'Reviewed — not suitable';
    accent = 'var(--ds-not-suitable)';
    titleColor = '#b91c1c';
  } else if (statusLabel === 'InProgress' || statusLabel === 'Draft') {
    title = 'Sent back by reviewer';
  } else if (!notes) {
    return null;
  }

  const reviewer = lookupName(assessment, 'modifiedby') ?? lookupName(assessment, 'createdby');
  const when = assessment.modifiedon
    ? new Date(assessment.modifiedon).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;

  function jumpToFirstFlag() {
    if (!firstFlagLevelId) return;
    window.dispatchEvent(new CustomEvent('intelli:jump-to-level', { detail: { levelId: firstFlagLevelId } }));
    setTimeout(() => {
      document.getElementById(`level-${firstFlagLevelId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  return (
    <div className={styles.feedbackBanner} style={{ borderLeftColor: accent }}>
      <span className={styles.feedbackTitle} style={{ color: titleColor }}>
        {title}
        {(reviewer || when) && (
          <span className={styles.feedbackMeta}>
            · {reviewer ?? 'Reviewer'}{when ? ` · ${when}` : ''}
          </span>
        )}
      </span>
      {notes && <div className={styles.feedbackBody}>{notes}</div>}
      {(flagCount > 0 || onOpenThread) && (
        <div className={styles.feedbackFoot}>
          <span className={styles.feedbackFootText}>
            {flagCount > 0
              ? `${flagCount} question${flagCount === 1 ? '' : 's'} flagged · not resolved`
              : ''}
          </span>
          <div className={styles.feedbackFootActions}>
            {flagCount > 0 && (
              <Button appearance="primary" size="small" className={styles.primaryBtnDark} onClick={jumpToFirstFlag}>
                Jump to first flag
              </Button>
            )}
            {onOpenThread && (
              <button type="button" className={styles.feedbackThreadLink} onClick={onOpenThread}>
                Open thread
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tiny inline pill that surfaces the autosave state for the checklist.
 *
 *   pending   → purple pulse + "Saving..."
 *   error     → red filled-circle + "Save failed"
 *   saved     → green checkmark + "Saved at HH:MM"
 *   nothing yet → muted "Autosave on"
 */
interface SaveBadgeProps {
  upsert: ReturnType<typeof useUpsertResponse>;
  lastSavedAt: Date | null;
}
function SaveBadge({ upsert, lastSavedAt }: SaveBadgeProps) {
  const styles = useStyles();
  if (upsert.isPending) {
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeSaving}`} aria-live="polite">
        <span className={styles.spinDot} aria-hidden />
        Saving...
      </span>
    );
  }
  if (upsert.isError) {
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeError}`} aria-live="polite">
        <ErrorCircle16Filled />
        Save failed — retry
      </span>
    );
  }
  if (lastSavedAt) {
    const time = lastSavedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <span className={`${styles.saveBadge} ${styles.saveBadgeSaved}`} aria-live="polite">
        <CheckmarkCircle16Filled />
        Saved at {time}
      </span>
    );
  }
  return <span className={`${styles.saveBadge} ${styles.saveBadgeIdle}`}>Autosave on</span>;
}

/**
 * Hero outcome chip — what verdict this assessment carries right now.
 *
 * Source of truth depends on status:
 *   - **Draft / InProgress** → live preview computed from current answers
 *     (matches the chip inside the checklist banner; gives feedback while
 *     editing).
 *   - **PendingReview / Complete** → persisted `dnx_outcome` written by
 *     submit or reviewer approval. Live preview is hidden here so the
 *     hero doesn't disagree with what was actually saved.
 *
 * Renders nothing when there's no signal yet (no rules, no answers, no
 * persisted value) to avoid a perpetually empty / Pending pill cluttering
 * the meta row.
 */
interface HeroOutcomeChipProps {
  styles: ReturnType<typeof useStyles>;
  persisted: 0 | 1 | 2 | undefined | null;
  live: EvaluationOutcome;
  statusLabel: string;
}
function HeroOutcomeChip({ styles, persisted, live, statusLabel }: HeroOutcomeChipProps) {
  const isLocked = statusLabel === 'PendingReview' || statusLabel === 'Complete';
  // Locked status: trust the persisted value. Pending (2) means submitted
  // without a definitive verdict — render a muted "Pending" so reviewers
  // know an actual decision is still required.
  if (isLocked) {
    if (persisted === 0) {
      return (
        <Tooltip
          content="Outcome recorded at submission / approval."
          relationship="description"
          withArrow
        >
          <span className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}>
            Suitable
          </span>
        </Tooltip>
      );
    }
    if (persisted === 1) {
      return (
        <Tooltip
          content="Outcome recorded at submission / approval."
          relationship="description"
          withArrow
        >
          <span className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}>
            Not suitable
          </span>
        </Tooltip>
      );
    }
    return null;
  }
  // Draft / InProgress: live preview only.
  if (live.kind === 'pass') {
    return (
      <Tooltip
        content={live.explanation ?? 'Live preview based on current answers.'}
        relationship="description"
        withArrow
      >
        <span className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}>
          Suitable (preview)
        </span>
      </Tooltip>
    );
  }
  if (live.kind === 'fail') {
    return (
      <Tooltip
        content={live.explanation ?? 'Live preview based on current answers.'}
        relationship="description"
        withArrow
      >
        <span className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}>
          Not suitable (preview)
        </span>
      </Tooltip>
    );
  }
  return null;
}
