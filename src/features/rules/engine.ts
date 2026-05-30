import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { readResponseValue } from '../assessments/responseHelpers';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import type { LevelNode } from '../templates/levels/treeBuilder';
import {
  type Criteria,
  type EvaluationOutcome,
  type ScoringGroup,
  OUTCOME_PASS_LABEL,
  OUTCOME_FAIL_LABEL,
  OPERATOR_LABEL,
  operatorsForDataType,
  parseGroups,
} from './types';

/** Format an answer value for display in an explanation. */
function formatValue(value: boolean | string | string[]): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '(none)' : value.join(', ');
  return value;
}

/**
 * Pure, side-effect-free evaluator for a single Question level.
 *
 * Inputs: the level, the first criteria for that level, and the assessor's
 * response row. Returns one of:
 *   - `{ kind: 'pass'|'fail', label }` when an outcome can be computed
 *   - `{ kind: 'not-evaluable', reason }` when not (no rule, no answer,
 *     or the rule's operator is incompatible with the question type).
 *
 * Designed for the live-preview chip in the runtime AND for the future
 * server-side cascade — keep this dependency-free so M7b can call it.
 */
export function evaluateQuestion(
  level: Dnx_assessment_levels,
  criteria: Criteria | undefined,
  response: Dnx_assessment_responses | undefined,
): EvaluationOutcome {
  if (!criteria) return { kind: 'not-evaluable', reason: 'no-criteria' };

  const dataType = (level.dnx_data_type ?? 3) as DataType;
  // If the configured operator can't possibly apply to this question's data
  // type, treat it as bad config rather than silently passing/failing.
  const allowed = operatorsForDataType(dataType);
  if (!allowed.includes(criteria.operator)) {
    return {
      kind: 'not-evaluable',
      reason: 'bad-config',
      explanation: `Rule operator "${OPERATOR_LABEL[criteria.operator]}" doesn't apply to this question's data type.`,
    };
  }

  const value = readResponseValue(dataType, response);
  // Empty answer — even false/"" only counts when the assessor explicitly set it.
  const unanswered =
    value === null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.length === 0);
  if (unanswered) return { kind: 'not-evaluable', reason: 'no-answer' };

  const passed = compare(value, criteria, dataType);
  const opLabel = OPERATOR_LABEL[criteria.operator];
  const valStr = formatValue(value);
  const targetClause = criteria.targetValue ? ` "${criteria.targetValue}"` : '';
  const explanation = passed
    ? `Answer "${valStr}" satisfies rule "${opLabel}${targetClause}".`
    : `Answer "${valStr}" does not satisfy rule "${opLabel}${targetClause}".`;
  if (passed) {
    return {
      kind: 'pass',
      label: OUTCOME_PASS_LABEL[criteria.outcomeIfPass],
      explanation,
    };
  }
  return {
    kind: 'fail',
    label: OUTCOME_FAIL_LABEL[criteria.outcomeIfFail],
    explanation,
  };
}

function compare(
  value: boolean | string | string[],
  criteria: Criteria,
  dataType: DataType,
): boolean {
  const { operator, targetValue } = criteria;
  switch (operator) {
    case 'IsTrue':
      return value === true;
    case 'IsFalse':
      return value === false;
    case 'Equals':
      if (dataType === 4) {
        // Date — compare as YYYY-MM-DD strings, both already trimmed.
        return typeof value === 'string' && value === targetValue;
      }
      return typeof value === 'string' && value === targetValue;
    case 'Contains':
      if (Array.isArray(value)) return value.includes(targetValue);
      if (typeof value === 'string') return value.includes(targetValue);
      return false;
    case 'GreaterThan':
      if (dataType === 4) {
        return typeof value === 'string' && value > targetValue;
      }
      return false;
    case 'LessThan':
      if (dataType === 4) {
        return typeof value === 'string' && value < targetValue;
      }
      return false;
  }
}

/**
 * Pluck the Root-level (`dnx_assessment_level_type === 0`) criteria for a
 * template, if any. Returned by `useEnsureRootLevel` callers; the runtime
 * evaluators take it as an optional arg to `evaluateAssessment`.
 */
export function findRootCriteria(
  levels: Dnx_assessment_levels[] | undefined,
  criteriaByLevelId: Map<string, Criteria> | undefined,
): Criteria | undefined {
  if (!levels || !criteriaByLevelId) return undefined;
  const root = levels.find((l) => l.dnx_assessment_level_type === 0);
  if (!root) return undefined;
  return criteriaByLevelId.get(root.dnx_assessment_levelid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade evaluator — Subsection / Section / Assessment roll-ups.
// All functions are pure and dependency-free so the future server-side flow
// can call them identically. Bottom-up: question outcomes feed subsection
// scoring; subsection + direct-question outcomes feed section scoring;
// section outcomes feed the assessment-level summary.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate an array of child outcomes against a parent criteria.
 *
 * Strategy:
 *   - **Boolean**  (must-all-pass) — every evaluable child must be `pass`.
 *     Any single `fail` flips the parent to fail. If a child is
 *     `not-evaluable`, it's ignored — but if NO child is evaluable we
 *     return `not-evaluable: no-children` so we don't silently pass.
 *   - **Weighted**  — sum of weights of passing children divided by sum of
 *     weights of all evaluable children. Pass if ratio ≥ `passThreshold`.
 *   - **Grouped**  — not implemented in M7b; falls back to Boolean.
 */
export interface AggregateChild {
  outcome: EvaluationOutcome;
  weight: number;
  /** Child level name — surfaced in the parent's explanation tooltip. */
  name: string;
  /** Child level GUID — used by Grouped scoring to match group members. */
  levelId: string;
}

export function aggregateChildOutcomes(
  parentCriteria: Criteria,
  children: AggregateChild[],
): EvaluationOutcome {
  // Grouped scoring branches out before the standard pass/fail-count path.
  // Each group is one composite vote; ungrouped descendants are still
  // required to pass individually. See `aggregateGrouped` below.
  if (parentCriteria.scoringType === 'Grouped') {
    return aggregateGrouped(parentCriteria, children);
  }

  const evaluable = children.filter(
    (c) => c.outcome.kind === 'pass' || c.outcome.kind === 'fail',
  );
  if (evaluable.length === 0) {
    return {
      kind: 'not-evaluable',
      reason: 'no-children',
      explanation: 'No child has a definitive outcome yet.',
    };
  }

  const failedNames = evaluable
    .filter((c) => c.outcome.kind === 'fail')
    .map((c) => c.name);
  const passedCount = evaluable.length - failedNames.length;

  let passed = false;
  let ratioPart = '';
  if (parentCriteria.scoringType === 'Weighted') {
    // Threshold mode honours each child's Importance value. A child with
    // weight 2 counts as two normal children both above and below the line:
    // total = sum of weights of evaluable children; pass = sum of weights of
    // children that passed.
    const totalWeight = evaluable.reduce((sum, c) => sum + (c.weight || 1), 0);
    const passWeight = evaluable
      .filter((c) => c.outcome.kind === 'pass')
      .reduce((sum, c) => sum + (c.weight || 1), 0);
    const ratio = totalWeight > 0 ? passWeight / totalWeight : 0;
    passed = ratio >= parentCriteria.passThreshold;
    const pct = Math.round(ratio * 100);
    const threshold = Math.round(parentCriteria.passThreshold * 100);
    // If every weight is 1, drop the points language and just say "X of Y".
    // Otherwise the tooltip explains the weighted math so a non-engineer
    // can follow it: "5 of 7 points passed (71%) — needed 50%".
    const uniformWeights = evaluable.every((c) => (c.weight || 1) === 1);
    ratioPart = uniformWeights
      ? `${passedCount} of ${evaluable.length} children passed (${pct}%) — needed ${threshold}%`
      : `${passWeight} of ${totalWeight} weighted points passed (${pct}%) — needed ${threshold}%`;
  } else {
    passed = evaluable.every((c) => c.outcome.kind === 'pass');
    ratioPart = `${passedCount} of ${evaluable.length} children passed`;
  }

  const failTail = failedNames.length > 0 ? ` Failed: ${failedNames.join(', ')}.` : '';
  const explanation = `${ratioPart}.${failTail}`;

  return passed
    ? {
        kind: 'pass',
        label: OUTCOME_PASS_LABEL[parentCriteria.outcomeIfPass],
        explanation,
      }
    : {
        kind: 'fail',
        label: OUTCOME_FAIL_LABEL[parentCriteria.outcomeIfFail],
        explanation,
      };
}

/** Weight a level contributes when its parent aggregates. Defaults to 1. */
function weightFor(criteria: Criteria | undefined): number {
  return criteria?.weight && criteria.weight > 0 ? criteria.weight : 1;
}

/**
 * Grouped aggregation: each group is a composite voting unit.
 *
 * - A group passes when at least `minToPass` of its evaluable members passed.
 * - Members listed in a group but absent from the current `children` set
 *   (typo, deleted question, etc.) are silently skipped.
 * - Children NOT mentioned by any group are treated as individually required
 *   — any one of them failing fails the parent. Keeps "leftover" answers
 *   from being silently ignored.
 * - The parent passes when every group passes AND every ungrouped child passes.
 */
function aggregateGrouped(
  parentCriteria: Criteria,
  children: AggregateChild[],
): EvaluationOutcome {
  const groups = parseGroups(parentCriteria.targetValue);
  if (groups.length === 0) {
    // Author flipped to Grouped mode but hasn't defined any group yet —
    // surface that explicitly rather than silently passing.
    return {
      kind: 'not-evaluable',
      reason: 'bad-config',
      explanation: 'Grouped scoring is selected but no groups are defined.',
    };
  }

  // Index children by level id for quick lookup during group evaluation.
  const childByLevelId = new Map<string, AggregateChild>(
    children.map((c) => [c.levelId, c] as const),
  );

  const groupOutcomes: Array<{
    group: ScoringGroup;
    passed: boolean;
    passedCount: number;
    evaluableCount: number;
  }> = [];
  const groupedIds = new Set<string>();
  for (const group of groups) {
    let passedCount = 0;
    let evaluableCount = 0;
    for (const memberId of group.memberLevelIds) {
      groupedIds.add(memberId);
      const child = childByLevelId.get(memberId);
      if (!child) continue;
      if (child.outcome.kind === 'pass') {
        passedCount += 1;
        evaluableCount += 1;
      } else if (child.outcome.kind === 'fail') {
        evaluableCount += 1;
      }
    }
    groupOutcomes.push({
      group,
      passed: evaluableCount > 0 && passedCount >= group.minToPass,
      passedCount,
      evaluableCount,
    });
  }

  // Ungrouped children — treated as individual must-pass leftovers.
  const ungrouped = children.filter((c) => !groupedIds.has(c.levelId));
  const ungroupedEvaluable = ungrouped.filter(
    (c) => c.outcome.kind === 'pass' || c.outcome.kind === 'fail',
  );
  const ungroupedFailed = ungroupedEvaluable.filter(
    (c) => c.outcome.kind === 'fail',
  );

  // Need at least one definitive signal somewhere — otherwise the parent
  // can't claim a verdict.
  const anyGroupEvaluable = groupOutcomes.some((g) => g.evaluableCount > 0);
  if (!anyGroupEvaluable && ungroupedEvaluable.length === 0) {
    return {
      kind: 'not-evaluable',
      reason: 'no-children',
      explanation: 'No grouped members or ungrouped children have a definitive outcome yet.',
    };
  }

  const allGroupsPass = groupOutcomes.every((g) => g.passed);
  const ungroupedPass = ungroupedFailed.length === 0;
  const passed = allGroupsPass && ungroupedPass;

  // Build a plain-English explanation: "Group A 2/3 ≥ 2 ✓ · Group B 1/2 ≥ 2 ✗ · Failed: Q5"
  const groupSummary = groupOutcomes
    .map(
      (g) =>
        `${g.group.name} ${g.passedCount}/${g.evaluableCount} ≥ ${g.group.minToPass} ${
          g.passed ? '✓' : '✗'
        }`,
    )
    .join(' · ');
  const ungroupedTail =
    ungroupedFailed.length > 0
      ? ` Ungrouped failed: ${ungroupedFailed.map((c) => c.name).join(', ')}.`
      : '';
  const explanation = `${groupSummary}.${ungroupedTail}`;

  return passed
    ? {
        kind: 'pass',
        label: OUTCOME_PASS_LABEL[parentCriteria.outcomeIfPass],
        explanation,
      }
    : {
        kind: 'fail',
        label: OUTCOME_FAIL_LABEL[parentCriteria.outcomeIfFail],
        explanation,
      };
}

/**
 * Evaluate a single node (any level type) by walking its subtree.
 *
 * - Question (type 3): forwards to `evaluateQuestion`.
 * - Subsection (2), Section (1), Root (0): collects child outcomes
 *   recursively, then runs `aggregateChildOutcomes` against its own rule.
 *
 * A level without its own criteria but with evaluable descendants returns
 * `not-evaluable: no-criteria` — parents up the chain decide whether to
 * still count it.
 */
export function evaluateNode(
  node: LevelNode,
  criteriaByLevelId: Map<string, Criteria> | undefined,
  responsesByLevelId: Map<string, Dnx_assessment_responses>,
): EvaluationOutcome {
  const levelType = (node.level.dnx_assessment_level_type ?? 1) as LevelType;
  const criteria = criteriaByLevelId?.get(node.level.dnx_assessment_levelid);

  if (levelType === 3) {
    return evaluateQuestion(
      node.level,
      criteria,
      responsesByLevelId.get(node.level.dnx_assessment_levelid),
    );
  }

  // Roll-up. Recurse into every child and collect their outcomes paired with
  // each child's contribution weight (from its own criteria, default 1).
  const children: AggregateChild[] = node.children.map((child) => {
    const outcome = evaluateNode(child, criteriaByLevelId, responsesByLevelId);
    const childCriteria = criteriaByLevelId?.get(child.level.dnx_assessment_levelid);
    return {
      outcome,
      weight: weightFor(childCriteria),
      name: child.level.dnx_name,
      levelId: child.level.dnx_assessment_levelid,
    };
  });

  if (!criteria) {
    // No rule on this parent — pass through as not-evaluable. We don't
    // synthesise a verdict from the children because the author hasn't told
    // us how to combine them; the parent up the tree can still ignore this
    // and roll the grandchildren's outcomes onward.
    return {
      kind: 'not-evaluable',
      reason: 'no-criteria',
      explanation: 'No roll-up rule configured on this level.',
    };
  }

  return aggregateChildOutcomes(criteria, children);
}

/**
 * Overall outcome for an assessment instance — aggregates the top-level
 * Sections under the template root. Always uses Boolean (must-all-pass)
 * semantics: any failing section fails the assessment. Returns
 * `not-evaluable` if no section yields a definitive outcome.
 */
export function evaluateAssessment(
  sectionNodes: LevelNode[],
  criteriaByLevelId: Map<string, Criteria> | undefined,
  responsesByLevelId: Map<string, Dnx_assessment_responses>,
  /**
   * Optional rule authored on the template Root level. When present, sections
   * are aggregated through this rule using the standard `aggregateChildOutcomes`
   * (so authors get Every-child / X%-threshold + per-section Importance for
   * free). When absent, falls back to the implicit "every section must pass"
   * semantics — preserves behaviour for templates with no assessment-level rule.
   */
  rootCriteria?: Criteria,
): EvaluationOutcome {
  if (sectionNodes.length === 0) {
    return { kind: 'not-evaluable', reason: 'no-children' };
  }
  const perSection: AggregateChild[] = sectionNodes.map((n) => ({
    name: n.level.dnx_name,
    outcome: evaluateNode(n, criteriaByLevelId, responsesByLevelId),
    weight: weightFor(criteriaByLevelId?.get(n.level.dnx_assessment_levelid)),
    levelId: n.level.dnx_assessment_levelid,
  }));

  if (rootCriteria) {
    // Authored rule path — same aggregator as sub/section roll-ups.
    return aggregateChildOutcomes(rootCriteria, perSection);
  }

  // Fallback: every section must pass.
  const evaluable = perSection.filter(
    (s) => s.outcome.kind === 'pass' || s.outcome.kind === 'fail',
  );
  if (evaluable.length === 0) {
    return { kind: 'not-evaluable', reason: 'no-children' };
  }
  const failedNames = evaluable
    .filter((s) => s.outcome.kind === 'fail')
    .map((s) => s.name);
  const passedCount = evaluable.length - failedNames.length;
  const explanation =
    failedNames.length === 0
      ? `All ${evaluable.length} section${evaluable.length === 1 ? '' : 's'} suitable.`
      : `${passedCount} of ${evaluable.length} sections suitable. Failed: ${failedNames.join(', ')}.`;
  return failedNames.length === 0
    ? { kind: 'pass', label: 'Suitable', explanation }
    : { kind: 'fail', label: 'Not suitable', explanation };
}
