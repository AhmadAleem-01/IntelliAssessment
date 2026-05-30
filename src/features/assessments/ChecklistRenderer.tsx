import { useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  LockClosed16Regular,
  Open16Regular,
} from '@fluentui/react-icons';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import {
  useAssessmentResponses,
  useReopenAssessment,
  type useUpsertResponse,
} from './api';
import { indexResponses, isQuestionVisible, hasAnswer } from './responseHelpers';
import { QuestionRow } from './QuestionRow';

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
});

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

  return (
    <div className={styles.root}>
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
          onAnswer={(level, value) =>
            upsert.mutate({
              instanceId,
              levelId: level.dnx_assessment_levelid,
              questionName: level.dnx_name,
              dataType: (level.dnx_data_type ?? 3) as DataType,
              value,
            })
          }
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
  onAnswer: (level: Dnx_assessment_levels, value: boolean | string | string[] | null) => void;
  disabled: boolean;
}

function SectionBlock({
  node,
  levelsById,
  responsesByLevelId,
  onAnswer,
  disabled,
}: SectionBlockProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);

  const directQuestions = node.children.filter(
    (c) => (c.level.dnx_assessment_level_type as LevelType) === 3,
  );
  const subsections = node.children.filter(
    (c) => (c.level.dnx_assessment_level_type as LevelType) === 2,
  );

  // Visible-question counts for the section header summary line.
  const counts = countVisibleAnswered(node, levelsById, responsesByLevelId);

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
              onAnswer={onAnswer}
              disabled={disabled}
            />
          ))}
          {subsections.map((sub) => (
            <SubsectionBlock
              key={sub.level.dnx_assessment_levelid}
              node={sub}
              levelsById={levelsById}
              responsesByLevelId={responsesByLevelId}
              onAnswer={onAnswer}
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
  onAnswer,
  disabled,
}: SubsectionBlockProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  // Per-subsection counts so a long section is easier to scan.
  const counts = countVisibleAnswered(node, levelsById, responsesByLevelId);
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
                  onAnswer={onAnswer}
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
  onAnswer: (level: Dnx_assessment_levels, value: boolean | string | string[] | null) => void;
  disabled: boolean;
}

function QuestionItem({
  level,
  levelsById,
  responsesByLevelId,
  onAnswer,
  disabled,
}: QuestionItemProps) {
  // Visibility gate — keep the QuestionRow mounted but animate it in/out.
  // The `reveal` CSS handles max-height + opacity + a tiny translateY;
  // pointer-events is disabled during fade so half-hidden inputs are inert.
  const visible = isQuestionVisible(level, levelsById, responsesByLevelId);
  const response = responsesByLevelId.get(level.dnx_assessment_levelid);
  return (
    <div
      className={`reveal ${visible ? 'reveal-show' : 'reveal-hide'}`}
      aria-hidden={!visible}
    >
      <QuestionRow
        level={level}
        response={response}
        onChange={(value) => onAnswer(level, value)}
        disabled={disabled}
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

