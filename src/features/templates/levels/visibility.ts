/**
 * Visibility rules — author-time configuration that hides or reveals a Question
 * based on a previously-answered Question's value at assessment runtime (M4).
 *
 * Stored as JSON in `dnx_visibility_condition` (added in M3c).
 *
 * v1 supports a single condition. The shape is forward-compatible — a future
 * version can add `and`/`or` arrays without breaking the parser.
 *
 * ## Runtime evaluation contract (for the future M4 evaluator)
 *
 * `showWhen.value` is always a single string. The runtime compares it against
 * the source question's answer like this, based on the source's data type:
 *
 * - Boolean / OptionSet (single) / Text / Date → strict equality between
 *   `value` and the response (`equals` matches when equal; `notEquals` when
 *   not equal).
 * - Multiselect (data type 2) → "contains" semantics: `equals` matches when
 *   `value` is among the array of selected response values; `notEquals`
 *   matches when it is not. The editor surfaces this with the labels
 *   "includes" / "does not include" via `operatorLabel()`.
 */

import type { DataType } from './levelTypes';

export type VisibilityOperator = 'equals' | 'notEquals';

export interface VisibilityCondition {
  /** GUID of the source question whose answer drives visibility. */
  questionId: string;
  operator: VisibilityOperator;
  /**
   * Raw value to compare against — string form keeps storage simple regardless
   * of the source question's data type. The runtime stringifies the response
   * value before comparing.
   */
  value: string;
  /** Cached display label of the source question — purely a UX hint. */
  questionLabel?: string;
}

export interface VisibilityRule {
  showWhen: VisibilityCondition;
}

export function parseVisibility(stored: string | undefined | null): VisibilityRule | undefined {
  if (!stored) return undefined;
  const trimmed = stored.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.showWhen &&
      typeof parsed.showWhen.questionId === 'string' &&
      typeof parsed.showWhen.value === 'string' &&
      (parsed.showWhen.operator === 'equals' || parsed.showWhen.operator === 'notEquals')
    ) {
      return parsed as VisibilityRule;
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

export function serializeVisibility(rule: VisibilityRule | undefined): string | undefined {
  if (!rule) return undefined;
  if (!rule.showWhen.questionId || !rule.showWhen.value) return undefined;
  return JSON.stringify(rule);
}

export const OPERATOR_LABEL: Record<VisibilityOperator, string> = {
  equals: 'equals',
  notEquals: 'does not equal',
};

/**
 * Per-data-type operator labels. For Multiselect sources the semantics shift
 * from strict equality to "is among the selected values", so we surface that
 * with friendlier verbs. Storage shape is unchanged.
 */
export function operatorLabel(
  op: VisibilityOperator,
  dataType: DataType | undefined,
): string {
  if (dataType === 2) {
    return op === 'equals' ? 'includes' : 'does not include';
  }
  return OPERATOR_LABEL[op];
}

/**
 * Whether a data type can drive a visibility condition. v1 supports Boolean
 * and the two Option set variants — Text/Date conditions are less common and
 * push the runtime evaluator into fuzzy territory.
 */
export function canDriveVisibility(dataType: DataType | undefined | null): boolean {
  return dataType === 0 || dataType === 1 || dataType === 2;
}
