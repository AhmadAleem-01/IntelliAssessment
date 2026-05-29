import { useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronRight16Regular } from '@fluentui/react-icons';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import { useAssessmentResponses, useUpsertResponse } from './api';
import { indexResponses, isQuestionVisible } from './responseHelpers';
import { QuestionRow } from './QuestionRow';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  banner: { marginBottom: '12px' },
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
    borderTop: '0.5px solid var(--color-border-tertiary)',
    paddingTop: '12px',
    marginTop: '6px',
  },
  subsectionHeader: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: '4px',
  },
  subsectionDesc: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px',
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
}

export function ChecklistRenderer({ instanceId, templateId }: Props) {
  const styles = useStyles();
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
  const upsert = useUpsertResponse(instanceId);

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
          disabled={upsert.isPending}
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
  return (
    <div className={styles.subsection}>
      <div className={styles.subsectionHeader}>{node.level.dnx_name}</div>
      {node.level.dnx_description && (
        <div className={styles.subsectionDesc}>{node.level.dnx_description}</div>
      )}
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
  // Visibility gate — return null when the rule fails.
  if (!isQuestionVisible(level, levelsById, responsesByLevelId)) return null;
  const response = responsesByLevelId.get(level.dnx_assessment_levelid);
  return (
    <QuestionRow
      level={level}
      response={response}
      onChange={(value) => onAnswer(level, value)}
      disabled={disabled}
    />
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

function hasAnswer(r: import('../../generated/models/Dnx_assessment_responsesModel').Dnx_assessment_responses): boolean {
  if (r.dnx_response_boolean !== undefined && r.dnx_response_boolean !== null) return true;
  if (r.dnx_response_option) return true;
  if (r.dnx_response_text) return true;
  if (r.dnx_response_date) return true;
  if (r.dnx_response_multi) {
    try {
      const arr = JSON.parse(r.dnx_response_multi);
      return Array.isArray(arr) && arr.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}
