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

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  banner: { marginBottom: '12px' },
  lockBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    border: '0.5px solid var(--color-amber)',
    marginBottom: '8px',
  },
  lockBannerLocked: {
    backgroundColor: 'var(--color-gray-soft)',
    color: 'var(--color-text-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
  },
  lockIcon: { flexShrink: 0, display: 'flex', alignItems: 'center' },
  lockText: { flex: 1, fontSize: '12px', lineHeight: 1.4 },
  lockTitle: { fontWeight: 500, color: 'var(--color-text-primary)' },
  flagsBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    border: '0.5px solid var(--color-amber)',
    marginBottom: '8px',
  },
  flagsCount: {
    flex: 1,
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    lineHeight: 1.3,
  },
  flagsSub: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
  },
  flagsCounter: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-amber-text)',
    backgroundColor: 'var(--color-background-primary)',
    padding: '4px 10px',
    borderRadius: 'var(--border-radius-md)',
    border: '0.5px solid var(--color-amber)',
    flexShrink: 0,
  },
  section: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    cursor: 'pointer',
    backgroundColor: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    userSelect: 'none',
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
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    flex: 1,
  },
  sectionMeta: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  sectionBody: {
    padding: '6px 18px 14px 18px',
    display: 'flex',
    flexDirection: 'column',
  },
  subsection: {
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    marginTop: '14px',
    marginBottom: '4px',
    overflow: 'hidden',
    backgroundColor: 'var(--color-background-primary)',
  },
  subsectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    backgroundColor: 'var(--color-background-tertiary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
    },
  },
  subsectionHeaderCollapsed: {
    borderBottom: 'none',
  },
  subsectionBullet: {
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-purple)',
    flexShrink: 0,
  },
  subsectionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subsectionLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
  },
  subsectionDesc: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    padding: '8px 14px 0 14px',
  },
  subsectionBody: {
    padding: '4px 14px 10px 14px',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px dashed var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-lg)',
  },
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    lineHeight: 1.3,
    flexShrink: 0,
  },
  overallBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    backgroundColor: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    marginBottom: '4px',
  },
  overallLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  overallHint: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    flex: 1,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    border: '0.5px solid var(--color-green)',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
    border: '0.5px solid var(--color-red)',
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
}

export function ChecklistRenderer({
  instanceId,
  templateId,
  upsert,
  readOnly,
  pendingReview,
  submittedOn,
}: Props) {
  const styles = useStyles();
  const reopen = useReopenAssessment(instanceId);
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
      {totalFlaggedQuestions > 0 && (
        <div className={styles.flagsBanner}>
          <span className={styles.lockIcon}>
            <Flag16Filled />
          </span>
          <div className={styles.flagsCount}>
            {totalFlaggedQuestions} question{totalFlaggedQuestions === 1 ? '' : 's'} flagged by the reviewer
            <div className={styles.flagsSub}>
              Jump to each flag and address the reviewer's notes. Mark each as resolved
              when fixed.
            </div>
          </div>
          {currentFlagIdx > 0 && (
            <span className={styles.flagsCounter}>
              {currentFlagIdx} of {totalFlaggedQuestions}
            </span>
          )}
          <Button appearance="secondary" onClick={jumpToNextFlag}>
            {currentFlagIdx === 0 ? 'Jump to first flag' : 'Next flag'}
          </Button>
        </div>
      )}
      {readOnly && (
        <div
          className={`${styles.lockBanner} ${pendingReview ? '' : styles.lockBannerLocked}`}
        >
          <span className={styles.lockIcon}>
            <LockClosed16Regular />
          </span>
          <div className={styles.lockText}>
            <div className={styles.lockTitle}>
              {pendingReview ? 'Submitted for review' : 'Assessment complete'}
            </div>
            {pendingReview ? (
              <>
                Submitted{submittedOn ? ` on ${new Date(submittedOn).toLocaleDateString()}` : ''}.
                The checklist is read-only until you reopen it.
              </>
            ) : (
              <>This assessment is finalised and can no longer be edited.</>
            )}
          </div>
          {pendingReview && (
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
          disabled={readOnly || upsert.isPending}
        />
      ))}
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
  disabled: boolean;
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
  disabled,
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
    <div className={styles.section}>
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
              disabled={disabled}
            />
          ))}
          {subsections.map((sub) => (
            <SubsectionBlock
              key={sub.level.dnx_assessment_levelid}
              node={sub}
              levelsById={levelsById}
              responsesByLevelId={responsesByLevelId}
              flagsByLevelId={flagsByLevelId}
              criteriaByLevelId={criteriaByLevelId}
              rowRefs={rowRefs}
              onAnswer={onAnswer}
              onResolveFlag={onResolveFlag}
              resolvingFlagId={resolvingFlagId}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SubsectionBlockProps extends SectionBlockProps {}

function SubsectionBlock({
  node,
  levelsById,
  responsesByLevelId,
  flagsByLevelId,
  criteriaByLevelId,
  rowRefs,
  onAnswer,
  onResolveFlag,
  resolvingFlagId,
  disabled,
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
        <span className={styles.subsectionBullet} aria-hidden />
        <span className={styles.subsectionLabel}>Subsection</span>
        <span className={styles.subsectionTitle}>{node.level.dnx_name}</span>
        <OutcomeChip outcome={outcome} />
        <span className={styles.subsectionLabel}>
          {counts.answered}/{counts.visible}
        </span>
      </div>
      {expanded && (
        <>
          {node.level.dnx_description && (
            <div className={styles.subsectionDesc}>{node.level.dnx_description}</div>
          )}
          <div className={styles.subsectionBody}>
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

