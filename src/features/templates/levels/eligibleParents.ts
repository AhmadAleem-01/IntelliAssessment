import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';
import { lookupId } from '../../../lib/dataverse';
import { canDriveVisibility } from './visibility';
import { parseOptions } from './options';
import type { DataType } from './levelTypes';

export interface EligibleQuestion {
  id: string;
  label: string;
  dataType: DataType;
  /** For OptionSet/Multiselect — the list of choices the user can compare against. */
  options: string[];
  /**
   * Human-readable path of the question's parent — e.g. "Qualification Section ›
   * Qualification 1" — used as the OptionGroup label so duplicate question
   * names in different parents are distinguishable.
   *
   * Empty string when the question lives directly at the template root (no
   * parent), which shouldn't happen in practice — questions are always under
   * a Section or Subsection.
   */
  parentPath: string;
  /** Stable key for grouping siblings together in the dropdown. */
  parentKey: string;
}

/**
 * Build the list of questions that may drive a visibility condition for the
 * question currently being authored.
 *
 * - Source must be a Question (level_type === 3)
 * - Source must use a data type that supports visibility (Boolean / OptionSet / Multi)
 * - Source must NOT be the question being edited (self-reference forbidden)
 * - In v1 we accept ANY question in the same template — runtime will simply
 *   ignore the rule if the user reorders things so the source appears after
 *   the dependent.
 */
export function eligibleParents(
  allLevels: Dnx_assessment_levels[] | undefined,
  excludeId: string | undefined,
): EligibleQuestion[] {
  if (!allLevels) return [];

  const byId = new Map(allLevels.map((l) => [l.dnx_assessment_levelid, l] as const));

  const out: EligibleQuestion[] = [];
  for (const level of allLevels) {
    if (level.dnx_assessment_level_type !== 3) continue;
    if (excludeId && level.dnx_assessment_levelid === excludeId) continue;
    const dataType = level.dnx_data_type as DataType | undefined;
    if (dataType === undefined || dataType === null) continue;
    if (!canDriveVisibility(dataType)) continue;
    const path = parentPathOf(level, byId);
    out.push({
      id: level.dnx_assessment_levelid,
      label: level.dnx_name,
      dataType,
      options:
        dataType === 1 || dataType === 2 ? parseOptions(level.dnx_option_set_reference) : [],
      parentPath: path.label,
      parentKey: path.key,
    });
  }
  return out;
}

/** Walk the parent chain to build a display path + stable grouping key. */
function parentPathOf(
  level: Dnx_assessment_levels,
  byId: Map<string, Dnx_assessment_levels>,
): { label: string; key: string } {
  const labels: string[] = [];
  const ids: string[] = [];
  let parentId = lookupId(level, 'dnx_parent_assessment_level');
  // Cap traversal at a reasonable depth so a corrupted self-cycle doesn't loop.
  for (let i = 0; i < 8 && parentId; i++) {
    const parent = byId.get(parentId);
    if (!parent) break;
    labels.unshift(parent.dnx_name);
    ids.unshift(parent.dnx_assessment_levelid);
    parentId = lookupId(parent, 'dnx_parent_assessment_level');
  }
  return {
    label: labels.join(' › ') || 'Unfiled',
    key: ids.join('/') || '__root__',
  };
}

/**
 * Group eligible questions by their parent path. Order preserved from input
 * (which is dataverse `dnx_assessment_level_order asc`), so groups appear in
 * the same order as the user sees in the tree.
 */
export interface ParentGroup {
  key: string;
  path: string;
  questions: EligibleQuestion[];
}

export function groupByParent(questions: EligibleQuestion[]): ParentGroup[] {
  const groups: ParentGroup[] = [];
  const byKey = new Map<string, ParentGroup>();
  for (const q of questions) {
    let g = byKey.get(q.parentKey);
    if (!g) {
      g = { key: q.parentKey, path: q.parentPath, questions: [] };
      byKey.set(q.parentKey, g);
      groups.push(g);
    }
    g.questions.push(q);
  }
  return groups;
}

/** Boolean value labels — kept here so the editor + runtime stay aligned. */
export const BOOLEAN_VALUES = ['Yes', 'No'] as const;
