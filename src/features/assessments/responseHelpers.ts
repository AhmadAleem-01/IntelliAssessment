/**
 * Helpers for reading response values + evaluating visibility rules at runtime.
 *
 * `dnx_assessment_responses` stores one row per (instance, level) pair with
 * exactly one of five `dnx_response_*` columns populated based on the level's
 * data type. This module pulls the right value back out and (separately)
 * evaluates whether a question should be visible given the current responses.
 */

import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { lookupId } from '../../lib/dataverse';
import { parseVisibility, type VisibilityCondition } from '../templates/levels/visibility';
import type { DataType } from '../templates/levels/levelTypes';

/** Map from level GUID → response row, used by the runtime. */
export type ResponsesByLevelId = Map<string, Dnx_assessment_responses>;

export function indexResponses(
  responses: Dnx_assessment_responses[] | undefined,
): ResponsesByLevelId {
  const out: ResponsesByLevelId = new Map();
  if (!responses) return out;
  for (const r of responses) {
    const levelId = lookupId(r, 'dnx_assessment_level');
    if (levelId) out.set(levelId, r);
  }
  return out;
}

/**
 * Pull the natural in-memory value for a question's stored response.
 * Returns null when there's no answer yet.
 */
export function readResponseValue(
  dataType: DataType,
  response: Dnx_assessment_responses | undefined,
): boolean | string | string[] | null {
  if (!response) return null;
  switch (dataType) {
    case 0:
      return response.dnx_response_boolean ?? null;
    case 1:
      return response.dnx_response_option ?? null;
    case 2: {
      const raw = response.dnx_response_multi;
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        /* fall through */
      }
      return [];
    }
    case 3:
      return response.dnx_response_text ?? null;
    case 4:
      // Stored as YYYY-MM-DD already; the SDK may return with appended T00:00:00 — slice defensively.
      return response.dnx_response_date ? response.dnx_response_date.slice(0, 10) : null;
  }
}

/**
 * Evaluate a visibility condition against the current responses.
 *
 * Returns true when the rule matches (question SHOULD be shown). The semantics
 * differ by the source's data type, per the contract in `visibility.ts`:
 *   - Boolean / OptionSet / Text / Date → strict equality
 *   - Multiselect (data type 2) → contains-semantics (value is one of the array)
 */
export function evaluateCondition(
  condition: VisibilityCondition,
  sourceLevel: Dnx_assessment_levels | undefined,
  sourceResponse: Dnx_assessment_responses | undefined,
): boolean {
  if (!sourceLevel) return true; // unknown source — fail open
  const sourceType = (sourceLevel.dnx_data_type ?? 3) as DataType;
  const value = readResponseValue(sourceType, sourceResponse);

  let matches = false;
  if (sourceType === 2) {
    // Multiselect: array contains target value
    const arr = Array.isArray(value) ? value : [];
    matches = arr.includes(condition.value);
  } else if (sourceType === 0) {
    // Boolean: rule value is "Yes"/"No" string, response is boolean
    const target = condition.value === 'Yes';
    matches = value === target;
  } else {
    // OptionSet / Text / Date: strict string compare
    matches = String(value ?? '') === condition.value;
  }

  return condition.operator === 'equals' ? matches : !matches;
}

/**
 * Decide whether a question should be visible right now. Levels without a
 * visibility rule are always visible.
 */
export function isQuestionVisible(
  level: Dnx_assessment_levels,
  levelsById: Map<string, Dnx_assessment_levels>,
  responsesByLevelId: ResponsesByLevelId,
): boolean {
  const rule = parseVisibility(level.dnx_visibility_condition);
  if (!rule) return true;
  const sourceLevel = levelsById.get(rule.showWhen.questionId);
  const sourceResponse = responsesByLevelId.get(rule.showWhen.questionId);
  return evaluateCondition(rule.showWhen, sourceLevel, sourceResponse);
}
