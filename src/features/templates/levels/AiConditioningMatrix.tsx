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
  Add16Regular,
  Edit16Regular,
  Document16Regular,
} from '@fluentui/react-icons';
import { useTemplateLevels } from './api';
import { buildTree, type LevelNode } from './treeBuilder';
import type { LevelType } from './levelTypes';
import { parseEvidenceBinding } from './evidenceBinding';
import { EvidenceBindingEditor } from './EvidenceBindingEditor';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: 'var(--color-background-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  },
  body: { display: 'flex', flexDirection: 'column' },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    ':last-child': { borderBottom: 'none' },
  },
  rowHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 18px',
    cursor: 'pointer',
    userSelect: 'none',
    ':hover': { backgroundColor: 'var(--color-background-secondary)' },
  },
  rowHeaderActive: { backgroundColor: 'var(--color-background-secondary)' },
  rowChevron: {
    width: '20px',
    height: '20px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Tinted type-label column — same convention as the scoring matrix:
  // Section purple, Subsection blue, Question teal.
  rowPath: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
    minWidth: '90px',
  },
  rowPathSection: { color: 'var(--color-purple-text)' },
  rowPathSubsection: { color: 'var(--color-blue-text)' },
  rowPathQuestion: { color: 'var(--color-teal-text)' },
  rowName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowSummary: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  varChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    border: '0.5px solid var(--color-purple)',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  querySnippet: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    maxWidth: '260px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  noBindingHint: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  rowBody: {
    padding: '4px 18px 18px 18px',
    backgroundColor: 'var(--color-background-secondary)',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  // Section / Subsection group rows are display-only (no binding to edit), so
  // they aren't clickable and skip the hover affordance — otherwise identical
  // layout to a question row.
  rowHeaderStatic: {
    cursor: 'default',
    ':hover': { backgroundColor: 'transparent' },
  },
});

const LEVEL_LABEL: Record<LevelType, string> = {
  1: 'Section',
  2: 'Subsection',
  3: 'Question',
};

/**
 * A row in the flattened list. Section / Subsection rows are display-only
 * group headers (they carry no binding); Question rows are editable. `depth`
 * drives the left indent so the hierarchy reads at a glance.
 */
type FlatRow =
  | { kind: 'header'; node: LevelNode; levelType: LevelType; depth: number }
  | { kind: 'question'; node: LevelNode; depth: number };

/**
 * Flatten the tree into an ordered list that keeps Section / Subsection group
 * headers inline above their descendants, with Questions as the editable leaf
 * rows. A header is only emitted when its subtree actually contains at least
 * one question — empty sections would just be noise on a tab that's all about
 * questions.
 */
function flattenWithHeaders(nodes: LevelNode[], depth: number): FlatRow[] {
  const out: FlatRow[] = [];
  for (const node of nodes) {
    const levelType = (node.level.dnx_assessment_level_type as LevelType) ?? 1;
    if (levelType === 3) {
      out.push({ kind: 'question', node, depth });
      continue;
    }
    // Section / Subsection — only show it if a descendant question exists.
    const childRows = flattenWithHeaders(node.children, depth + 1);
    if (childRows.some((r) => r.kind === 'question')) {
      out.push({ kind: 'header', node, levelType, depth });
      out.push(...childRows);
    }
  }
  return out;
}

interface Props {
  templateId: string;
}

/**
 * AI conditioning tab — one row per Question, each showing its AI evidence
 * binding (file variable + extraction query) with an inline editor. Parallel
 * to the Scoring & evaluation matrix, but scoped to questions since only
 * questions carry an evidence binding. The binding is what drives the
 * assessment-time AI auto-fill (M6b).
 */
export function AiConditioningMatrix({ templateId }: Props) {
  const styles = useStyles();
  const { data: levels, isLoading, error } = useTemplateLevels(templateId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading questions..." size="small" />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const tree = buildTree(levels);
  const rows = flattenWithHeaders(tree, 0);
  const hasQuestions = rows.some((r) => r.kind === 'question');

  if (!hasQuestions) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          This template doesn't have any questions yet. Switch to the Structure tab to
          add sections, subsections, and questions first.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        AI conditioning — for each question, declare the evidence file it reads and the
        query the assistant follows. The assessor maps file variables to real uploads at
        assessment time.
      </div>
      <div className={styles.body}>
        {rows.map((row) => {
          const levelId = row.node.level.dnx_assessment_levelid;
          // Match the scoring matrix exactly: chevron · tinted type label ·
          // name · summary, indented by depth. No left rails.
          const indent = 18 + row.depth * 18;

          if (row.kind === 'header') {
            const tintPath =
              row.levelType === 1 ? styles.rowPathSection : styles.rowPathSubsection;
            return (
              <div key={levelId} className={styles.row}>
                <div
                  className={`${styles.rowHeader} ${styles.rowHeaderStatic}`}
                  style={{ paddingLeft: indent }}
                >
                  <span className={styles.rowChevron} aria-hidden />
                  <span className={`${styles.rowPath} ${tintPath}`}>
                    {LEVEL_LABEL[row.levelType]}
                  </span>
                  <span className={styles.rowName} title={row.node.level.dnx_name}>
                    {row.node.level.dnx_name}
                  </span>
                </div>
              </div>
            );
          }

          const node = row.node;
          const isExpanded = expandedId === levelId;
          const binding = parseEvidenceBinding(node.level.dnx_document_type_reference);
          const hasBinding = !!binding && (!!binding.fileVariable || !!binding.query);
          return (
            <div key={levelId} className={styles.row}>
              <div
                className={`${styles.rowHeader} ${isExpanded ? styles.rowHeaderActive : ''}`}
                style={{ paddingLeft: indent }}
                onClick={() => setExpandedId(isExpanded ? null : levelId)}
              >
                <span className={styles.rowChevron}>
                  {isExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                </span>
                <span className={`${styles.rowPath} ${styles.rowPathQuestion}`}>
                  {LEVEL_LABEL[3]}
                </span>
                <span className={styles.rowName} title={node.level.dnx_name}>
                  {node.level.dnx_name}
                </span>
                {hasBinding ? (
                  <span className={styles.rowSummary}>
                    {binding!.fileVariable && (
                      <span className={styles.varChip} title={binding!.fileVariable}>
                        <Document16Regular />
                        {binding!.fileVariable}
                      </span>
                    )}
                    {binding!.query && (
                      <span className={styles.querySnippet} title={binding!.query}>
                        {binding!.query}
                      </span>
                    )}
                    <Edit16Regular />
                  </span>
                ) : (
                  <span className={styles.rowSummary}>
                    <span className={styles.noBindingHint}>No AI binding</span>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Add16Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(levelId);
                      }}
                    >
                      Add binding
                    </Button>
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className={styles.rowBody}>
                  <EvidenceBindingEditor
                    level={node.level}
                    templateId={templateId}
                    onSaved={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
