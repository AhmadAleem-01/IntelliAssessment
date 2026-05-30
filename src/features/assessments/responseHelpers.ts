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

/** Whether a response row has any non-empty answer in any of its value columns. */
export function hasAnswer(r: Dnx_assessment_responses | undefined): boolean {
  if (!r) return false;
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

/** A required question that's currently visible but has no answer recorded. */
export interface MissingRequired {
  levelId: string;
  label: string;
  /** Section › Subsection path so the assessor can locate it in a long template. */
  path: string;
}

/**
 * Walk all template levels and find required Questions that are visible
 * (not hidden by a visibility rule) AND have no answer recorded. The
 * assessment cannot be submitted while this list is non-empty.
 */
export function validateSubmission(
  levels: Dnx_assessment_levels[] | undefined,
  responses: Dnx_assessment_responses[] | undefined,
): MissingRequired[] {
  if (!levels || levels.length === 0) return [];
  const levelsById = new Map(
    levels.map((l) => [l.dnx_assessment_levelid, l] as const),
  );
  const responsesByLevelId = indexResponses(responses);

  // Build parent path strings for each question via a tiny up-walk (capped to
  // depth 8 to defend against cycles).
  const pathOf = (level: Dnx_assessment_levels): string => {
    const labels: string[] = [];
    let parentId: string | undefined;
    const rec = level as unknown as Record<string, unknown>;
    parentId = rec._dnx_parent_assessment_level_value as string | undefined;
    for (let i = 0; i < 8 && parentId; i++) {
      const parent = levelsById.get(parentId);
      if (!parent) break;
      labels.unshift(parent.dnx_name);
      const prec = parent as unknown as Record<string, unknown>;
      parentId = prec._dnx_parent_assessment_level_value as string | undefined;
    }
    return labels.join(' › ');
  };

  const missing: MissingRequired[] = [];
  for (const level of levels) {
    if (level.dnx_assessment_level_type !== 3) continue;
    if (!level.dnx_is_required) continue;
    if (!isQuestionVisible(level, levelsById, responsesByLevelId)) continue;
    const r = responsesByLevelId.get(level.dnx_assessment_levelid);
    if (hasAnswer(r)) continue;
    missing.push({
      levelId: level.dnx_assessment_levelid,
      label: level.dnx_name,
      path: pathOf(level),
    });
  }
  return missing;
}
