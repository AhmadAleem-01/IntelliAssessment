/**
 * Shared, framework-agnostic letter data assembly (M8b).
 *
 * Both the on-screen/PDF renderer (`LetterPreview`, JSX + `dangerouslySetInnerHTML`)
 * and the Word exporter (`letterToDocx`, `docx` library calls) need the exact
 * same computed data — outcome, meta values, per-question answers, the
 * responses-by-section tree, and grouped-subsections buckets. Pulling this into
 * one pure module means the two renderers can never drift apart on what a
 * letter actually contains; they only differ in how they paint it.
 */

import type { Dnx_assessment_instances } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Criteria, EvaluationOutcome } from '../rules/types';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { DataType, LevelType } from '../templates/levels/levelTypes';
import { indexResponses, readResponseValue } from '../assessments/responseHelpers';
import { evaluateAssessment, findRootCriteria } from '../rules/engine';
import { lookupName } from '../../lib/dataverse';
import type { MetaFieldKey, PlaceholderValues } from './letterLayout';

export interface CollectedQuestion {
  levelId: string;
  label: string;
  answer: string;
}

/** A Section's direct + nested letter-visible questions, for the Responses block. */
export interface LetterSection {
  level: Dnx_assessment_levels;
  directQuestions: CollectedQuestion[];
  subsections: { level: Dnx_assessment_levels; questions: CollectedQuestion[] }[];
}

/** One subsection with its letter-visible questions (Grouped subsections block). */
export interface GroupedSubsection {
  levelId: string;
  name: string;
  questions: CollectedQuestion[];
}
/** A group of subsections that share one answer value for the group-by question. */
export interface SubsectionGroup {
  groupValue: string;
  subsections: GroupedSubsection[];
}

export interface LetterData {
  tree: LevelNode[];
  outcomeLabel: string;
  outcomeKind: 'pass' | 'fail' | 'pending';
  liveOutcome: EvaluationOutcome;
  /** Set only when the persisted (locked-in) outcome is driving the label. */
  persistedLabel: string | null;
  values: PlaceholderValues;
  /** Every question's formatted answer, keyed by level id (for answer-chip tokens). */
  answerByLevelId: Record<string, string>;
  metaValueFor: (key: MetaFieldKey) => string;
  sections: LetterSection[];
  notes: string | undefined;
}

export function buildLetterData(
  assessment: Dnx_assessment_instances,
  levels: Dnx_assessment_levels[],
  responses: Dnx_assessment_responses[],
  criteriaByLevelId: Map<string, Criteria> | undefined,
): LetterData {
  const tree = buildTree(levels);
  const responsesByLevelId = indexResponses(responses);
  const rootCriteria = findRootCriteria(levels, criteriaByLevelId);
  const liveOutcome: EvaluationOutcome = evaluateAssessment(
    tree,
    criteriaByLevelId,
    responsesByLevelId,
    rootCriteria,
  );

  // Prefer the persisted outcome over live preview when the assessment has
  // been submitted or approved — the candidate's letter should reflect the
  // recorded verdict, not "this is what it would be if you edited it now".
  const persisted = assessment.dnx_outcome;
  const persistedLabel =
    persisted === 0 ? 'Suitable' : persisted === 1 ? 'Not suitable' : null;

  const outcomeLabel =
    persistedLabel ??
    (liveOutcome.kind === 'pass'
      ? 'Suitable'
      : liveOutcome.kind === 'fail'
        ? 'Not suitable'
        : 'Pending');

  const outcomeKind: LetterData['outcomeKind'] =
    persisted === 0 || liveOutcome.kind === 'pass'
      ? 'pass'
      : persisted === 1 || liveOutcome.kind === 'fail'
        ? 'fail'
        : 'pending';

  const projectName = lookupName(assessment, 'dnx_project');
  const templateName = lookupName(assessment, 'dnx_assessmenttemplate');
  const candidateName = lookupName(assessment, 'ownerid');

  const submittedOn = assessment.dnx_submittedon
    ? new Date(assessment.dnx_submittedon).toLocaleDateString()
    : null;
  const today = new Date().toLocaleDateString();
  const notes = assessment.dnx_outcome_notes?.trim();

  const sections: LetterSection[] = tree
    .map((sectionNode) => ({
      level: sectionNode.level,
      directQuestions: collectIncluded(sectionNode, false, responsesByLevelId),
      subsections: sectionNode.children
        .filter((c) => (c.level.dnx_assessment_level_type as LevelType) === 2)
        .map((subNode) => ({
          level: subNode.level,
          questions: collectIncluded(subNode, true, responsesByLevelId),
        }))
        .filter((s) => s.questions.length > 0),
    }))
    .filter((s) => s.directQuestions.length > 0 || s.subsections.length > 0);

  const values: PlaceholderValues = {
    candidate: candidateName ?? '—',
    assessment: assessment.dnx_assessment_name,
    project: projectName ?? '—',
    template: templateName ?? '—',
    outcome: outcomeLabel,
    submittedOn: submittedOn ?? '—',
    today,
    version: String(assessment.dnx_version ?? 1),
  };

  // Every question's formatted answer, keyed by level id — powers the inline
  // answer-chip tokens in heading / text / signature blocks. Covers ALL
  // questions (not just include_in_letter ones), since an author may
  // reference any answer in prose.
  const answerByLevelId: Record<string, string> = {};
  for (const level of levels) {
    if ((level.dnx_assessment_level_type as LevelType) !== 3) continue;
    const dataType = (level.dnx_data_type ?? 3) as DataType;
    const value = readResponseValue(
      dataType,
      responsesByLevelId.get(level.dnx_assessment_levelid),
    );
    answerByLevelId[level.dnx_assessment_levelid] = formatAnswer(value, dataType);
  }

  const metaValueFor = (key: MetaFieldKey): string => {
    switch (key) {
      case 'candidate':
        return candidateName ?? '—';
      case 'assessment':
        return assessment.dnx_assessment_name;
      case 'project':
        return projectName ?? '—';
      case 'template':
        return templateName ?? '—';
      case 'submittedOn':
        return submittedOn ?? '—';
      case 'today':
        return today;
      case 'version':
        return `v${assessment.dnx_version ?? 1}`;
    }
  };

  return {
    tree,
    outcomeLabel,
    outcomeKind,
    liveOutcome,
    persistedLabel,
    values,
    answerByLevelId,
    metaValueFor,
    sections,
    notes,
  };
}

/**
 * Group a chosen Section's direct Subsections by the answer to a question
 * that lives inside each of them (M8b.2 — "grouped subsections" block). Every
 * subsection has its OWN instance of the group-by question (e.g. every
 * "Qualification N" subsection has its own "Reason" question), so we match by
 * NAME rather than by level id — see context.md gotcha Z. Under each group
 * value we carry the subsection's `include_in_letter` questions for detail.
 * Subsections with no answer to the group-by question are skipped;
 * first-seen order is preserved.
 */
export function buildGroupedSubsections(
  tree: LevelNode[],
  sectionLevelId: string,
  groupByQuestionName: string,
  responsesByLevelId: ReturnType<typeof indexResponses>,
): SubsectionGroup[] {
  const questionName = groupByQuestionName.trim();
  if (!sectionLevelId || !questionName) return [];
  const section = tree.find((n) => n.level.dnx_assessment_levelid === sectionLevelId);
  if (!section) return [];

  const order: string[] = [];
  const byValue = new Map<string, GroupedSubsection[]>();

  for (const sub of section.children) {
    if ((sub.level.dnx_assessment_level_type as LevelType) !== 2) continue;
    const groupQ = sub.children.find(
      (c) =>
        (c.level.dnx_assessment_level_type as LevelType) === 3 &&
        c.level.dnx_name.trim() === questionName,
    );
    if (!groupQ) continue;
    const dataType = (groupQ.level.dnx_data_type ?? 3) as DataType;
    const value = readResponseValue(
      dataType,
      responsesByLevelId.get(groupQ.level.dnx_assessment_levelid),
    );
    const groupValue = formatAnswer(value, dataType);
    if (!groupValue || groupValue === '—') continue;
    if (!byValue.has(groupValue)) {
      byValue.set(groupValue, []);
      order.push(groupValue);
    }
    byValue.get(groupValue)!.push({
      levelId: sub.level.dnx_assessment_levelid,
      name: sub.level.dnx_name,
      questions: collectIncluded(sub, false, responsesByLevelId),
    });
  }

  return order.map((groupValue) => ({ groupValue, subsections: byValue.get(groupValue)! }));
}

/**
 * Walk a Section or Subsection node and pull out the questions flagged
 * `include_in_letter`. `includeAll` controls whether to recurse into
 * subsections — used so the Section-level pass picks up direct Questions
 * only, leaving the Subsection-level pass to handle nested ones.
 */
export function collectIncluded(
  node: LevelNode,
  includeAll: boolean,
  responsesByLevelId: ReturnType<typeof indexResponses>,
): CollectedQuestion[] {
  const out: CollectedQuestion[] = [];
  for (const child of node.children) {
    const childType = child.level.dnx_assessment_level_type as LevelType;
    if (childType === 3) {
      if (!child.level.dnx_include_in_letter) continue;
      const dataType = (child.level.dnx_data_type ?? 3) as DataType;
      const response = responsesByLevelId.get(child.level.dnx_assessment_levelid);
      const value = readResponseValue(dataType, response);
      out.push({
        levelId: child.level.dnx_assessment_levelid,
        label: child.level.dnx_name,
        answer: formatAnswer(value, dataType),
      });
    } else if (childType === 2 && includeAll) {
      out.push(...collectIncluded(child, true, responsesByLevelId));
    }
  }
  return out;
}

export function formatAnswer(
  value: boolean | string | string[] | null,
  dataType: DataType,
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.length === 0 ? '—' : value.join(', ');
  }
  if (dataType === 4 && typeof value === 'string') {
    // Date — already YYYY-MM-DD in storage; render as local date string.
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }
  return value;
}
