import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  Tooltip,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  LockClosed16Regular,
  Open16Regular,
  Flag16Filled,
} from '@fluentui/react-icons';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import { DetailsPanel } from '../applicationDetails/DetailsPanel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_reviewer_comments } from '../../generated/models/Dnx_reviewer_commentsModel';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import {
  useAssessmentResponses,
  useReopenAssessment,
  useReviewerComments,
  useResolveReviewerComment,
  type useUpsertResponse,
} from './api';
import { indexResponses, isQuestionVisible, hasAnswer } from './responseHelpers';
import { lookupId } from '../../lib/dataverse';
import { QuestionRow } from './QuestionRow';
import { useCriteriaForLevels } from '../rules/api';
import type { Criteria, EvaluationOutcome } from '../rules/types';
import { evaluateNode, evaluateAssessment, findRootCriteria } from '../rules/engine';

/*
 * Checklist — Design System v1.0 ("Calm Efficiency"). Spacious white section
 * cards, blue-accent subsection bullet, semantic banners, dotted outcome pills.
 */
const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  banner: { marginBottom: '12px' },
  lockBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    borderRadius: 'var(--ds-radius-card)',
    backgroundColor: 'var(--ds-pending-soft)',
    color: '#b45309',
    border: '1px solid var(--ds-pending)',
    marginBottom: '8px',
  },
  lockBannerLocked: {
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-body)',
    border: '1px solid var(--ds-border)',
  },
  lockIcon: { flexShrink: 0, display: 'flex', alignItems: 'center' },
  lockText: { flex: 1, fontSize: 'var(--ds-fs-caption)', lineHeight: 1.45 },
  lockTitle: { fontWeight: 600, color: 'var(--ds-text-strong)' },
  // Floating flag navigator (bottom-right, above the app-details/back-to-top FABs).
  flagFab: {
    position: 'fixed',
    right: '24px',
    bottom: '132px',
    zIndex: 40,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    height: '44px',
    padding: '0 8px 0 14px',
    borderRadius: 'var(--ds-radius-pill)',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-pending)',
    boxShadow: '0 6px 20px -6px rgba(17, 24, 39, 0.35)',
  },
  flagFabIcon: { color: '#b45309', display: 'flex', flexShrink: 0 },
  flagFabLabel: {
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: '#b45309',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  flagFabBtn: {
    height: '30px',
    padding: '0 12px',
    borderRadius: 'var(--ds-radius-pill)',
    border: 'none',
    backgroundColor: 'var(--ds-pending)',
    color: '#fff',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ':hover': { backgroundColor: '#d98a08' },
  },
  section: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    cursor: 'pointer',
    backgroundColor: 'var(--ds-surface-card)',
    borderBottom: '1px solid var(--ds-border)',
    userSelect: 'none',
    transition: 'background-color 0.1s ease',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },
  sectionHeaderCollapsed: {
    borderBottom: 'none',
  },
  chevronBtn: {
    width: '20px',
    height: '20px',
    border: 'none',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    color: 'var(--ds-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-heading)',
    flex: 1,
  },
  sectionMeta: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  sectionBody: {
    padding: '8px 20px 18px 20px',
    display: 'flex',
    flexDirection: 'column',
  },
  subsection: {
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--border-radius-md)',
    marginTop: '16px',
    marginBottom: '4px',
    overflow: 'hidden',
    backgroundColor: 'var(--ds-surface-card)',
  },
  subsectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: 'var(--ds-surface-base)',
    borderBottom: '1px solid var(--ds-border)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--ds-brand-accent-soft)',
    },
  },
  subsectionHeaderCollapsed: {
    borderBottom: 'none',
  },
  subIndex: {
    width: '26px',
    height: '26px',
    borderRadius: '7px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  subTitleBlock: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' },
  subsectionTitle: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subSubtitle: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subStatus: {
    padding: '3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
  },
  subStatusDone: { backgroundColor: 'var(--ds-suitable-soft)', color: '#047857' },
  subStatusPartial: { backgroundColor: 'var(--ds-pending-soft)', color: '#b45309' },
  subsectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  subsectionDesc: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    padding: '10px 16px 0 16px',
  },
  subsectionBody: {
    padding: '4px 16px 12px 16px',
  },
  empty: {
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px dashed var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
  },
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    lineHeight: 1.3,
    flexShrink: 0,
  },
  overallBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    marginBottom: '4px',
  },
  overallLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  overallHint: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    flex: 1,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
  },
});

/**
 * Small shared chip used on section / subsection headers + the hero. Mirrors
 * the shape of the one inline in QuestionRow but lives here so the cascade
 * can render them at multiple tree depths without duplicating style.
 */
function OutcomeChip({ outcome }: { outcome: EvaluationOutcome }) {
  const styles = useStyles();
  if (outcome.kind !== 'pass' && outcome.kind !== 'fail') return null;
  const chipClass = `${styles.outcomeChip} ${
    outcome.kind === 'pass' ? styles.outcomeChipPass : styles.outcomeChipFail
  }`;
  const chip = <span className={chipClass}>{outcome.label}</span>;
  if (!outcome.explanation) return chip;
  // `relationship="description"` is the right ARIA semantic — the tooltip
  // describes *why* the chip says what it says, not an alternative label.
  return (
    <Tooltip content={outcome.explanation} relationship="description" withArrow>
      {chip}
    </Tooltip>
  );
}

interface Props {
  instanceId: string;
  templateId: string;
  /** Lifted from AssessmentPage so the autosave indicator can read mutation state. */
  upsert: ReturnType<typeof useUpsertResponse>;
  /**
   * Lock the checklist — no inputs are interactive. Shows a banner with a
   * Reopen action when `pendingReview` is true. Always-locked states like
   * Complete pass `pendingReview: false` so the Reopen action is hidden.
   */
  readOnly: boolean;
  /** True specifically when status is PendingReview (Reopen action is shown). */
  pendingReview: boolean;
  /** Date assessment was submitted, used in the banner copy. */
  submittedOn?: string;
  /**
   * Whether the signed-in user may edit answers / reopen / resolve flags
   * (Assessor or Admin). When false, the checklist is read-only regardless of
   * status and the assessor-only actions are hidden. Defaults true so callers
   * that don't gate keep prior behaviour.
   */
  canAssess?: boolean;
  /**
   * The assessment's parsed application-details JSON, so Section/Subsection
   * levels with an authored details layout can show resolved attribute values.
   * Null / omitted when the instance has no application-details file.
   */
  applicationData?: Record<string, unknown> | null;
  /** Open the comments drawer to reply to a flag, pre-tagging the question. */
  onReplyToFlag?: (levelId: string) => void;
}

export function ChecklistRenderer({
  instanceId,
  templateId,
  upsert,
  readOnly,
  pendingReview,
  submittedOn,
  canAssess = true,
  applicationData = null,
  onReplyToFlag,
}: Props) {
  const styles = useStyles();
  const reopen = useReopenAssessment(instanceId);
  // A non-assessor never gets interactive inputs, even in an editable status.
  const inputsLocked = readOnly || !canAssess;
  // Reopen is an assessor action — only when they could otherwise edit.
  const canReopen = pendingReview && canAssess;
  const { data: comments } = useReviewerComments(instanceId);
  const resolveFlag = useResolveReviewerComment(instanceId);

  // Group unresolved flags by the level GUID they target — passed down to each
  // QuestionRow so it can render its own indicators.
  const flagsByLevelId = useMemo(() => {
    const map = new Map<string, Dnx_reviewer_comments[]>();
    for (const c of comments ?? []) {
      if (c.dnx_is_resolved) continue;
      const levelId = lookupId(c, 'dnx_assessment_level');
      if (!levelId) continue;
      const list = map.get(levelId);
      if (list) list.push(c);
      else map.set(levelId, [c]);
    }
    return map;
  }, [comments]);

  // One ref per flagged question so the "Jump to next flag" button can
  // scrollIntoView. Map keyed by levelId — refs live for the lifetime of the
  // renderer mount so we don't need to clear them between renders.
  const rowRefs = useRef(new Map<string, HTMLDivElement | null>());

  // Which flag the cycle is currently on. 1-based for display; we advance
  // before scrolling so the first click lands on flag 1 of N.
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);

  function getOrderedFlagElements(): HTMLDivElement[] {
    // Sort registered refs by DOM order so "next" follows the visible layout,
    // not comment-creation order from the API.
    const els: HTMLDivElement[] = [];
    for (const el of rowRefs.current.values()) {
      if (el) els.push(el);
    }
    els.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    return els;
  }

  function jumpToNextFlag() {
    const els = getOrderedFlagElements();
    if (els.length === 0) return;
    const next = currentFlagIdx % els.length;
    els[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setCurrentFlagIdx(next + 1);
  }

  const totalFlaggedQuestions = flagsByLevelId.size;
  const {
    data: levels,
    isLoading: levelsLoading,
    error: levelsError,
  } = useTemplateLevels(templateId);
  const {
    data: responses,
    isLoading: respLoading,
    error: respError,
  } = useAssessmentResponses(instanceId);

  // Every level id — we now load criteria for questions AND parents so the
  // cascade can roll up subsection / section / assessment outcomes.
  const allLevelIds = useMemo(
    () => (levels ?? []).map((l) => l.dnx_assessment_levelid),
    [levels],
  );
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);

  if (levelsLoading || respLoading) {
    return <Spinner label="Loading checklist..." size="small" />;
  }
  if (levelsError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(levelsError as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }
  if (respError) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(respError as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const tree = buildTree(levels);

  if (tree.length === 0) {
    return (
      <div className={styles.empty}>
        This template doesn't have any sections yet. Open the template editor to add
        sections, subsections, and questions first.
      </div>
    );
  }

  const responsesByLevelId = indexResponses(responses);
  const levelsById = new Map<string, Dnx_assessment_levels>(
    (levels ?? []).map((l) => [l.dnx_assessment_levelid, l] as const),
  );
  // Overall outcome rolls up every top-level section. Live preview only —
  // persistence happens through Submit and the reviewer Approve flow. If the
  // template carries an authored assessment-level rule (on its hidden Root),
  // that rule drives the aggregation; otherwise we fall back to "every
  // section must pass".
  const rootCriteria = findRootCriteria(levels, criteriaByLevelId);
  const overallOutcome = evaluateAssessment(
    tree,
    criteriaByLevelId,
    responsesByLevelId,
    rootCriteria,
  );

  return (
    <div className={styles.root}>
      {(overallOutcome.kind === 'pass' || overallOutcome.kind === 'fail') && (
        <div className={styles.overallBanner}>
          <span className={styles.overallLabel}>Overall outcome</span>
          <OutcomeChip outcome={overallOutcome} />
          <span className={styles.overallHint}>
            Live preview based on the answers below.
          </span>
        </div>
      )}
      {(readOnly || !canAssess) && (
        <div
          className={`${styles.lockBanner} ${pendingReview && canAssess ? '' : styles.lockBannerLocked}`}
        >
          <span className={styles.lockIcon}>
            <LockClosed16Regular />
          </span>
          <div className={styles.lockText}>
            <div className={styles.lockTitle}>
              {!readOnly && !canAssess
                ? 'Read-only'
                : pendingReview
                  ? 'Submitted for review'
                  : 'Assessment complete'}
            </div>
            {!readOnly && !canAssess ? (
              <>You don't have the Assessor role, so this checklist is read-only for you.</>
            ) : pendingReview ? (
              <>
                Submitted{submittedOn ? ` on ${new Date(submittedOn).toLocaleDateString()}` : ''}.
                The checklist is read-only until you reopen it.
              </>
            ) : (
              <>This assessment is finalised and can no longer be edited.</>
            )}
          </div>
          {canReopen && (
            <Button
              appearance="secondary"
              icon={<Open16Regular />}
              disabled={reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              {reopen.isPending ? 'Reopening...' : 'Reopen for edits'}
            </Button>
          )}
        </div>
      )}
      {reopen.error && (
        <MessageBar intent="error" className={styles.banner}>
          <MessageBarBody>
            Couldn't reopen: {(reopen.error as Error).message}
          </MessageBarBody>
        </MessageBar>
      )}
      {upsert.error && (
        <MessageBar intent="error" className={styles.banner}>
          <MessageBarBody>
            Couldn't save your answer: {(upsert.error as Error).message}
          </MessageBarBody>
        </MessageBar>
      )}
      {tree.map((sectionNode) => (
        <SectionBlock
          key={sectionNode.level.dnx_assessment_levelid}
          node={sectionNode}
          levelsById={levelsById}
          responsesByLevelId={responsesByLevelId}
          flagsByLevelId={flagsByLevelId}
          criteriaByLevelId={criteriaByLevelId}
          rowRefs={rowRefs.current}
          onAnswer={(level, value) =>
            upsert.mutate({
              instanceId,
              levelId: level.dnx_assessment_levelid,
              questionName: level.dnx_name,
              dataType: (level.dnx_data_type ?? 3) as DataType,
              value,
            })
          }
          onResolveFlag={(commentId) => resolveFlag.mutate(commentId)}
          resolvingFlagId={resolveFlag.isPending ? resolveFlag.variables ?? null : null}
          onReplyFlag={onReplyToFlag}
          disabled={inputsLocked || upsert.isPending}
          applicationData={applicationData}
        />
      ))}

      {/* Floating flag navigator — cycles through reviewer-flagged questions.
          Sits above the app-details / back-to-top FABs (bottom 24/78, so 132). */}
      {totalFlaggedQuestions > 0 && (
        <div className={styles.flagFab}>
          <span className={styles.flagFabIcon}>
            <Flag16Filled />
          </span>
          <span className={styles.flagFabLabel}>
            {currentFlagIdx > 0
              ? `Flag ${currentFlagIdx} of ${totalFlaggedQuestions}`
              : `${totalFlaggedQuestions} flag${totalFlaggedQuestions === 1 ? '' : 's'}`}
          </span>
          <button type="button" className={styles.flagFabBtn} onClick={jumpToNextFlag}>
            {currentFlagIdx === 0 ? 'Jump to first' : 'Next flag'}
          </button>
        </div>
      )}
    </div>
  );
}

interface SectionBlockProps {
  node: LevelNode;
  levelsById: Map<string, Dnx_assessment_levels>;
  responsesByLevelId: ReturnType<typeof indexResponses>;
  flagsByLevelId: Map<string, Dnx_reviewer_comments[]>;
  criteriaByLevelId: Map<string, Criteria> | undefined;
  rowRefs: Map<string, HTMLDivElement | null>;
  onAnswer: (level: Dnx_assessment_levels, value: boolean | string | string[] | null) => void;
  onResolveFlag: (commentId: string) => void;
  resolvingFlagId: string | null;
  /** Open the comments drawer to reply to a flag, pre-tagging the question. */
  onReplyFlag?: (levelId: string) => void;
  disabled: boolean;
  /** Parsed application-details JSON for resolving per-level detail panels. */
  applicationData: Record<string, unknown> | null;
}

/**
 * DOM-CustomEvent that comment tags + future external triggers fire to make
 * the checklist scroll a specific question into view. SectionBlock and
 * SubsectionBlock subscribe so they can auto-expand if the target lives
 * somewhere inside their subtree — otherwise scrollIntoView would find no
 * DOM node to anchor on.
 */
const JUMP_EVENT = 'intelli:jump-to-level';

/** True if `id` is the node itself or anywhere in its descendants. */
function containsLevel(node: LevelNode, id: string): boolean {
  if (node.level.dnx_assessment_levelid === id) return true;
  for (const child of node.children) {
    if (containsLevel(child, id)) return true;
  }
  return false;
}

/** Subscribe to JUMP_EVENT and call `onMatch(levelId)` when the target is
 *  in this node's subtree. Shared by Section and Subsection blocks. */
function useJumpToDescendantListener(
  node: LevelNode,
  onMatch: (levelId: string) => void,
) {
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ levelId: string }>).detail;
      if (!detail?.levelId) return;
      if (containsLevel(node, detail.levelId)) onMatch(detail.levelId);
    }
    window.addEventListener(JUMP_EVENT, handler as EventListener);
    return () => window.removeEventListener(JUMP_EVENT, handler as EventListener);
  }, [node, onMatch]);
}

function SectionBlock({
  node,
  levelsById,
  responsesByLevelId,
  flagsByLevelId,
  criteriaByLevelId,
  rowRefs,
  onAnswer,
  onResolveFlag,
  resolvingFlagId,
  onReplyFlag,
  disabled,
  applicationData,
}: SectionBlockProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  // Auto-expand when a jump event targets one of our descendants so the
  // anchor target exists in the DOM by the time the scrollIntoView runs.
  useJumpToDescendantListener(node, () => setExpanded(true));

  const directQuestions = node.children.filter(
    (c) => (c.level.dnx_assessment_level_type as LevelType) === 3,
  );
  const subsections = node.children.filter(
    (c) => (c.level.dnx_assessment_level_type as LevelType) === 2,
  );

  // Visible-question counts for the section header summary line.
  const counts = countVisibleAnswered(node, levelsById, responsesByLevelId);
  const outcome = evaluateNode(node, criteriaByLevelId, responsesByLevelId);

  return (
    <div className={styles.section} id={`level-${node.level.dnx_assessment_levelid}`}>
      <div
        className={`${styles.sectionHeader} ${expanded ? '' : styles.sectionHeaderCollapsed}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          type="button"
          className={styles.chevronBtn}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        </button>
        <span className={styles.sectionLabel}>{node.level.dnx_name}</span>
        <OutcomeChip outcome={outcome} />
        <span className={styles.sectionMeta}>
          {counts.answered} / {counts.visible} answered
        </span>
      </div>
      {expanded && (
        <div className={styles.sectionBody}>
          <DetailsPanel
            storedLayout={node.level.dnx_details_layout}
            applicationData={applicationData}
          />
          {directQuestions.map((q) => (
            <QuestionItem
              key={q.level.dnx_assessment_levelid}
              level={q.level}
              levelsById={levelsById}
              responsesByLevelId={responsesByLevelId}
              flagsByLevelId={flagsByLevelId}
              criteriaByLevelId={criteriaByLevelId}
              rowRefs={rowRefs}
              onAnswer={onAnswer}
              onResolveFlag={onResolveFlag}
              resolvingFlagId={resolvingFlagId}
              onReplyFlag={onReplyFlag}
              disabled={disabled}
            />
          ))}
          {subsections.map((sub, i) => (
            <SubsectionBlock
              key={sub.level.dnx_assessment_levelid}
              index={i + 1}
              node={sub}
              levelsById={levelsById}
              responsesByLevelId={responsesByLevelId}
              flagsByLevelId={flagsByLevelId}
              criteriaByLevelId={criteriaByLevelId}
              rowRefs={rowRefs}
              onAnswer={onAnswer}
              onResolveFlag={onResolveFlag}
              resolvingFlagId={resolvingFlagId}
              onReplyFlag={onReplyFlag}
              disabled={disabled}
              applicationData={applicationData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubsectionBlockProps extends SectionBlockProps {
  /** 1-based position among sibling subsections — shown as the index badge. */
  index: number;
}

function SubsectionBlock({
  index,
  node,
  levelsById,
  responsesByLevelId,
  flagsByLevelId,
  criteriaByLevelId,
  rowRefs,
  onAnswer,
  onResolveFlag,
  resolvingFlagId,
  onReplyFlag,
  disabled,
  applicationData,
}: SubsectionBlockProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  // Auto-expand on cross-component jump (e.g. tag click in CommentsDrawer).
  useJumpToDescendantListener(node, () => setExpanded(true));
  // Per-subsection counts so a long section is easier to scan.
  const counts = countVisibleAnswered(node, levelsById, responsesByLevelId);
  const outcome = evaluateNode(node, criteriaByLevelId, responsesByLevelId);
  return (
    <div className={styles.subsection}>
      <div
        className={`${styles.subsectionHeader} ${expanded ? '' : styles.subsectionHeaderCollapsed}`}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-expanded={expanded}
      >
        <span className={styles.subIndex}>{index}</span>
        <span className={styles.subTitleBlock}>
          <span className={styles.subsectionTitle}>{node.level.dnx_name}</span>
          {node.level.dnx_description && (
            <span className={styles.subSubtitle}>{node.level.dnx_description}</span>
          )}
        </span>
        {outcome.kind === 'pass' || outcome.kind === 'fail' ? (
          <OutcomeChip outcome={outcome} />
        ) : counts.visible > 0 && counts.answered === counts.visible ? (
          <span className={`${styles.subStatus} ${styles.subStatusDone}`}>Complete</span>
        ) : counts.visible > 0 ? (
          <span className={`${styles.subStatus} ${styles.subStatusPartial}`}>
            {counts.answered} of {counts.visible} required
          </span>
        ) : null}
        <button
          type="button"
          className={styles.chevronBtn}
          aria-label={expanded ? 'Collapse subsection' : 'Expand subsection'}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        </button>
      </div>
      {expanded && (
        <>
          {node.level.dnx_description && (
            <div className={styles.subsectionDesc}>{node.level.dnx_description}</div>
          )}
          <div className={styles.subsectionBody}>
            <DetailsPanel
              storedLayout={node.level.dnx_details_layout}
              applicationData={applicationData}
            />
            {node.children
              .filter((c) => (c.level.dnx_assessment_level_type as LevelType) === 3)
              .map((q) => (
                <QuestionItem
                  key={q.level.dnx_assessment_levelid}
                  level={q.level}
                  levelsById={levelsById}
                  responsesByLevelId={responsesByLevelId}
                  flagsByLevelId={flagsByLevelId}
                  criteriaByLevelId={criteriaByLevelId}
                  rowRefs={rowRefs}
                  onAnswer={onAnswer}
                  onResolveFlag={onResolveFlag}
                  resolvingFlagId={resolvingFlagId}
                  onReplyFlag={onReplyFlag}
                  disabled={disabled}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

interface QuestionItemProps {
  level: Dnx_assessment_levels;
  levelsById: Map<string, Dnx_assessment_levels>;
  responsesByLevelId: ReturnType<typeof indexResponses>;
  flagsByLevelId: Map<string, Dnx_reviewer_comments[]>;
  criteriaByLevelId: Map<string, Criteria> | undefined;
  rowRefs: Map<string, HTMLDivElement | null>;
  onAnswer: (level: Dnx_assessment_levels, value: boolean | string | string[] | null) => void;
  onResolveFlag: (commentId: string) => void;
  resolvingFlagId: string | null;
  onReplyFlag?: (levelId: string) => void;
  disabled: boolean;
}

function QuestionItem({
  level,
  levelsById,
  responsesByLevelId,
  flagsByLevelId,
  criteriaByLevelId,
  rowRefs,
  onAnswer,
  onResolveFlag,
  resolvingFlagId,
  onReplyFlag,
  disabled,
}: QuestionItemProps) {
  // Visibility gate — keep the QuestionRow mounted but animate it in/out.
  // The `reveal` CSS handles max-height + opacity + a tiny translateY;
  // pointer-events is disabled during fade so half-hidden inputs are inert.
  const visible = isQuestionVisible(level, levelsById, responsesByLevelId);
  const response = responsesByLevelId.get(level.dnx_assessment_levelid);
  const levelId = level.dnx_assessment_levelid;
  const flags = flagsByLevelId.get(levelId);
  const criteria = criteriaByLevelId?.get(levelId);
  return (
    <div
      id={`level-${levelId}`}
      className={`reveal ${visible ? 'reveal-show' : 'reveal-hide'}`}
      aria-hidden={!visible}
    >
      <QuestionRow
        ref={(el) => {
          // Only register refs for flagged rows — keeps the map small and the
          // jump-to-first-flag lookup direct.
          if (flags && flags.length > 0) rowRefs.set(levelId, el);
          else rowRefs.delete(levelId);
        }}
        level={level}
        response={response}
        onChange={(value) => onAnswer(level, value)}
        disabled={disabled}
        flags={flags}
        onResolveFlag={onResolveFlag}
        resolvingFlagId={resolvingFlagId}
        onReplyFlag={onReplyFlag ? () => onReplyFlag(levelId) : undefined}
        criteria={criteria}
      />
    </div>
  );
}

/**
 * Count visible questions + how many have a non-empty answer. Used in the
 * section header summary. A "visible" question is one whose visibility rule
 * passes given the current responses.
 */
function countVisibleAnswered(
  node: LevelNode,
  levelsById: Map<string, Dnx_assessment_levels>,
  responsesByLevelId: ReturnType<typeof indexResponses>,
): { visible: number; answered: number } {
  let visible = 0;
  let answered = 0;
  const walk = (n: LevelNode) => {
    const lt = n.level.dnx_assessment_level_type as LevelType;
    if (lt === 3) {
      if (!isQuestionVisible(n.level, levelsById, responsesByLevelId)) return;
      visible += 1;
      const r = responsesByLevelId.get(n.level.dnx_assessment_levelid);
      if (r && hasAnswer(r)) answered += 1;
      return;
    }
    n.children.forEach(walk);
  };
  walk(node);
  return { visible, answered };
}

