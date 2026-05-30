import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { readResponseValue } from '../assessments/responseHelpers';
import type { DataType } from '../templates/levels/levelTypes';
import {
  type Criteria,
  type EvaluationOutcome,
  OUTCOME_PASS_LABEL,
  OUTCOME_FAIL_LABEL,
  operatorsForDataType,
} from './types';

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
    return { kind: 'not-evaluable', reason: 'bad-config' };
  }

  const value = readResponseValue(dataType, response);
  // Empty answer — even false/"" only counts when the assessor explicitly set it.
  const unanswered =
    value === null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.length === 0);
  if (unanswered) return { kind: 'not-evaluable', reason: 'no-answer' };

  const passed = compare(value, criteria, dataType);
  if (passed) {
    return { kind: 'pass', label: OUTCOME_PASS_LABEL[criteria.outcomeIfPass] };
  }
  return { kind: 'fail', label: OUTCOME_FAIL_LABEL[criteria.outcomeIfFail] };
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
