import { useEffect, useMemo, useState } from 'react';
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
  Trophy16Regular,
} from '@fluentui/react-icons';
import { useTemplateLevels, useEnsureRootLevel } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { LevelType } from '../templates/levels/levelTypes';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { useCriteriaForLevels } from './api';
import { CriteriaEditor } from './CriteriaEditor';
import { OPERATOR_LABEL, type Criteria } from './types';

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
  body: {
    display: 'flex',
    flexDirection: 'column',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
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
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
    },
  },
  rowHeaderActive: {
    backgroundColor: 'var(--color-background-secondary)',
  },
  rowChevron: {
    width: '20px',
    height: '20px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowPath: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    flexShrink: 0,
    minWidth: '90px',
  },
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
    gap: '6px',
    flexShrink: 0,
  },
  ruleChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
  },
  // Per-level-type tint so a glance tells you whether the rule belongs to a
  // section (purple, top of hierarchy), a subsection (blue, middle), or a
  // question (teal, leaf). Same convention is used for the row's type label.
  ruleChipSection: {
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    border: '0.5px solid var(--color-purple)',
  },
  ruleChipSubsection: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
    border: '0.5px solid var(--color-blue)',
  },
  ruleChipQuestion: {
    backgroundColor: 'var(--color-teal-soft)',
    color: 'var(--color-teal-text)',
    border: '0.5px solid var(--color-teal)',
  },
  rowPathSection: { color: 'var(--color-purple-text)' },
  rowPathSubsection: { color: 'var(--color-blue-text)' },
  rowPathQuestion: { color: 'var(--color-teal-text)' },
  // Assessment-outcome row sits above the section rows with a subtle amber
  // accent — it's a different kind of row (template-wide) so it shouldn't
  // visually blend in with the section / subsection / question hierarchy.
  rowHeaderAssessment: {
    borderLeft: '3px solid var(--color-amber)',
    backgroundColor: 'var(--color-amber-soft)',
    ':hover': {
      backgroundColor: 'var(--color-amber-soft)',
      filter: 'brightness(0.97)',
    },
  },
  ruleChipAssessment: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    border: '0.5px solid var(--color-amber)',
  },
  rowPathAssessment: { color: 'var(--color-amber-text)' },
  importanceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    border: '0.5px solid var(--color-amber)',
  },
  noRuleHint: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  rowBody: {
    padding: '4px 18px 18px 18px',
    backgroundColor: 'var(--color-background-secondary)',
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
});

const LEVEL_LABEL: Record<LevelType, string> = {
  1: 'Section',
  2: 'Subsection',
  3: 'Question',
};

interface FlatRow {
  node: LevelNode;
  /** Section › Subsection breadcrumb prefix shown before the level name. */
  pathLabel: string;
  /** Visual indent depth — 0 for sections, 1 for subsections, etc. */
  depth: number;
}

/**
 * Walk the template's level tree into a flat ordered list. Sections lead,
 * subsections nested under them, questions at the leaves. Keeping it flat
 * lets every row be independently collapsible without re-implementing the
 * tree expand/collapse state.
 */
function flatten(nodes: LevelNode[], depth: number, prefix: string[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const node of nodes) {
    out.push({
      node,
      pathLabel: prefix.join(' › '),
      depth,
    });
    if (node.children.length > 0) {
      out.push(...flatten(node.children, depth + 1, [...prefix, node.level.dnx_name]));
    }
  }
  return out;
}

function summariseCriteria(c: Criteria | undefined, levelType: LevelType): string {
  if (!c) return '';
  // Question rule — show just operator + target. Importance renders as a
  // separate badge alongside this chip.
  if (levelType === 3) {
    const op = OPERATOR_LABEL[c.operator];
    const target = c.targetValue ? ` "${c.targetValue}"` : '';
    return `${op}${target}`;
  }
  // Parent rule — show scoring mode + threshold in plain English.
  return c.scoringType === 'Weighted'
    ? `At least ${Math.round(c.passThreshold * 100)}% must pass`
    : 'Every child must pass';
}

interface Props {
  templateId: string;
}

export function ScoringMatrix({ templateId }: Props) {
  const styles = useStyles();
  const { data: levels, isLoading, error } = useTemplateLevels(templateId);

  // Pull criteria for every level in one query — same hook the runtime uses.
  const allLevelIds = useMemo(
    () => (levels ?? []).map((l) => l.dnx_assessment_levelid),
    [levels],
  );
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading levels..." size="small" />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const tree = buildTree(levels);
  const rows = flatten(tree, 0, []);

  if (rows.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          This template doesn't have any levels yet. Switch to the Structure tab to add
          sections, subsections, and questions first.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        Scoring & evaluation — author rules at any level. Each rule rolls up to its
        parent automatically.
      </div>
      <div className={styles.body}>
        <AssessmentOutcomeRow
          templateId={templateId}
          levels={levels ?? []}
          criteriaByLevelId={criteriaByLevelId}
        />
        {rows.map(({ node, pathLabel, depth }) => {
          const levelId = node.level.dnx_assessment_levelid;
          const levelType = (node.level.dnx_assessment_level_type ?? 1) as LevelType;
          const criteria = criteriaByLevelId?.get(levelId);
          const isExpanded = expandedId === levelId;
          const summary = summariseCriteria(criteria, levelType);
          // Tint each row's type label + rule chip by level type so the
          // hierarchy is obvious at a glance: Section = purple, Subsection
          // = blue, Question = teal.
          const tintChip =
            levelType === 1
              ? styles.ruleChipSection
              : levelType === 2
                ? styles.ruleChipSubsection
                : styles.ruleChipQuestion;
          const tintPath =
            levelType === 1
              ? styles.rowPathSection
              : levelType === 2
                ? styles.rowPathSubsection
                : styles.rowPathQuestion;

          return (
            <div key={levelId} className={styles.row}>
              <div
                className={`${styles.rowHeader} ${isExpanded ? styles.rowHeaderActive : ''}`}
                style={{ paddingLeft: 18 + depth * 18 }}
                onClick={() => setExpandedId(isExpanded ? null : levelId)}
              >
                <span className={styles.rowChevron}>
                  {isExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                </span>
                <span className={`${styles.rowPath} ${tintPath}`}>
                  {LEVEL_LABEL[levelType]}
                </span>
                <span className={styles.rowName} title={pathLabel ? `${pathLabel} › ${node.level.dnx_name}` : node.level.dnx_name}>
                  {node.level.dnx_name}
                </span>
                {criteria ? (
                  <span className={styles.rowSummary}>
                    <span className={`${styles.ruleChip} ${tintChip}`}>{summary}</span>
                    {levelType === 3 && criteria.weight && criteria.weight !== 1 && (
                      <span
                        className={styles.importanceBadge}
                        title={`Counts ${criteria.weight}× in its parent's % threshold`}
                      >
                        ×{criteria.weight}
                      </span>
                    )}
                    <Edit16Regular />
                  </span>
                ) : (
                  <span className={styles.rowSummary}>
                    <span className={styles.noRuleHint}>No rule</span>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Add16Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(levelId);
                      }}
                    >
                      Add rule
                    </Button>
                  </span>
                )}
              </div>
              {isExpanded && (
                <div className={styles.rowBody}>
                  <CriteriaEditor level={node.level} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Synthetic top row representing the template's overall assessment outcome.
 *
 * The rule binds to a hidden Root-typed level (`dnx_assessment_level_type === 0`)
 * that's auto-created the first time the row is expanded — the schema only
 * allows criteria to hang off a level, so we make sure a level exists. Once
 * the Root level is created, this row behaves like any other in the matrix:
 * the inline CriteriaEditor authors the rule, the chip in the header shows
 * its summary, and the runtime cascade picks it up via `findRootCriteria`.
 */
function AssessmentOutcomeRow({
  templateId,
  levels,
  criteriaByLevelId,
}: {
  templateId: string;
  levels: Dnx_assessment_levels[];
  criteriaByLevelId: Map<string, Criteria> | undefined;
}) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const ensureRoot = useEnsureRootLevel(templateId);

  // If a Root exists already, use it; otherwise the editor stays gated until
  // the user expands the row, which triggers the ensure-root mutation.
  const existingRoot = useMemo(
    () => levels.find((l) => l.dnx_assessment_level_type === 0),
    [levels],
  );
  const [rootLevel, setRootLevel] = useState<Dnx_assessment_levels | undefined>(
    existingRoot,
  );
  // Keep local state in sync when the levels query refreshes after creation.
  useEffect(() => {
    if (existingRoot) setRootLevel(existingRoot);
  }, [existingRoot]);

  const criteria = rootLevel
    ? criteriaByLevelId?.get(rootLevel.dnx_assessment_levelid)
    : undefined;
  const summary = criteria
    ? criteria.scoringType === 'Weighted'
      ? `At least ${Math.round(criteria.passThreshold * 100)}% must pass`
      : 'Every section must pass'
    : '';

  async function handleExpand() {
    // Idempotent — returns existing root if it's already there.
    if (!rootLevel) {
      const created = await ensureRoot.mutateAsync();
      setRootLevel(created);
    }
    setExpanded(true);
  }

  return (
    <div className={styles.row}>
      <div
        className={`${styles.rowHeader} ${styles.rowHeaderAssessment} ${expanded ? styles.rowHeaderActive : ''}`}
        onClick={() => (expanded ? setExpanded(false) : void handleExpand())}
      >
        <span className={styles.rowChevron}>
          {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        </span>
        <span className={`${styles.rowPath} ${styles.rowPathAssessment}`}>
          <Trophy16Regular style={{ marginRight: 4, verticalAlign: '-2px' }} />
          Assessment
        </span>
        <span className={styles.rowName}>Overall outcome</span>
        {criteria ? (
          <span className={styles.rowSummary}>
            <span className={`${styles.ruleChip} ${styles.ruleChipAssessment}`}>
              {summary}
            </span>
            <Edit16Regular />
          </span>
        ) : (
          <span className={styles.rowSummary}>
            <span className={styles.noRuleHint}>
              {ensureRoot.isPending ? 'Preparing…' : 'Defaults to every section must pass'}
            </span>
            <Button
              appearance="subtle"
              size="small"
              icon={<Add16Regular />}
              disabled={ensureRoot.isPending}
              onClick={(e) => {
                e.stopPropagation();
                void handleExpand();
              }}
            >
              Add rule
            </Button>
          </span>
        )}
      </div>
      {expanded && rootLevel && (
        <div className={styles.rowBody}>
          <CriteriaEditor level={rootLevel} />
        </div>
      )}
      {ensureRoot.error && (
        <div style={{ padding: '8px 18px' }}>
          <MessageBar intent="error">
            <MessageBarBody>{(ensureRoot.error as Error).message}</MessageBarBody>
          </MessageBar>
        </div>
      )}
    </div>
  );
}
