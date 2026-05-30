import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dnx_evaluationcriteriasService } from '../../generated/services/Dnx_evaluationcriteriasService';
import type {
  Dnx_evaluationcriterias,
  Dnx_evaluationcriteriasBase,
} from '../../generated/models/Dnx_evaluationcriteriasModel';
import { lookupId } from '../../lib/dataverse';
import {
  OPERATOR,
  OUTCOME_PASS,
  OUTCOME_FAIL,
  SCORING_TYPE,
  type Criteria,
  type OperatorKey,
  type OutcomePassKey,
  type OutcomeFailKey,
  type ScoringTypeKey,
} from './types';

export const criteriaKeys = {
  all: ['criteria'] as const,
  byLevel: (levelId: string) => ['criteria', 'level', levelId] as const,
  byTemplate: (templateId: string) => ['criteria', 'template', templateId] as const,
};

function toCriteria(row: Dnx_evaluationcriterias): Criteria | null {
  const levelId = lookupId(row, 'dnx_assessment_level');
  if (!levelId) return null;
  const pass = row.dnx_outcome_if_pass;
  const fail = row.dnx_outcome_if_fail;
  if (pass === undefined || pass === null) return null;
  if (fail === undefined || fail === null) return null;
  // Operator may be absent for non-question rules — default to Equals so the
  // type stays narrow; the evaluator skips it when scoringType !== Boolean.
  const op = row.dnx_operator;
  return {
    id: row.dnx_evaluationcriteriaid,
    levelId,
    name: row.dnx_criteria_name,
    operator:
      op === undefined || op === null
        ? 'Equals'
        : (keyOf(OPERATOR, op) as OperatorKey),
    targetValue: row.dnx_target_value ?? '',
    outcomeIfPass: keyOf(OUTCOME_PASS, pass) as OutcomePassKey,
    outcomeIfFail: keyOf(OUTCOME_FAIL, fail) as OutcomeFailKey,
    scoringType:
      row.dnx_scoring_type === undefined || row.dnx_scoring_type === null
        ? 'Boolean'
        : (keyOf(SCORING_TYPE, row.dnx_scoring_type) as ScoringTypeKey),
    // Dataverse decimals come back as numbers in current versions of the
    // generated client; defensively coerce for the rare string case.
    passThreshold:
      typeof row.dnx_pass_threshold === 'number'
        ? row.dnx_pass_threshold
        : parseFloat(String(row.dnx_pass_threshold ?? '0.5')) || 0.5,
    weight:
      typeof row.dnx_weight === 'number'
        ? row.dnx_weight
        : parseFloat(String(row.dnx_weight ?? '1')) || 1,
  };
}

// Reverse-lookup an enum map (e.g. `{Equals: 0}`) given the numeric value.
// The generated picklist constants are number→name, but Dataverse may return
// either the number OR the string label depending on how the row was loaded,
// so we accept both.
function keyOf<T extends Record<string, number>>(map: T, val: unknown): keyof T {
  if (typeof val === 'string' && val in map) return val as keyof T;
  if (typeof val === 'number') {
    const found = Object.entries(map).find(([, v]) => v === val);
    if (found) return found[0] as keyof T;
  }
  // Fall through — caller treats `null` mapping as bad config.
  return Object.keys(map)[0] as keyof T;
}

/** All criteria attached to a single Question level. */
export function useCriteriaForLevel(levelId: string | undefined) {
  return useQuery({
    queryKey: criteriaKeys.byLevel(levelId ?? ''),
    enabled: !!levelId,
    queryFn: async (): Promise<Criteria[]> => {
      const r = await Dnx_evaluationcriteriasService.getAll({
        filter: `_dnx_assessment_level_value eq ${levelId}`,
        top: 50,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load criteria');
      return (r.data ?? []).map(toCriteria).filter((c): c is Criteria => c !== null);
    },
  });
}

/**
 * All criteria for an entire template — used by the runtime so the live
 * preview only fires one query per assessment instead of one-per-question.
 * We filter client-side by levelId since OData doesn't let us join the
 * level table back to the template in a single round trip.
 */
export function useCriteriaForLevels(levelIds: string[]) {
  // Stable key: sorted GUIDs joined. Cheap because the level set rarely changes.
  const key = [...levelIds].sort().join(',');
  return useQuery({
    queryKey: ['criteria', 'levels', key],
    enabled: levelIds.length > 0,
    queryFn: async (): Promise<Map<string, Criteria>> => {
      // OData `in` syntax for collections of GUIDs.
      const filter = levelIds
        .map((id) => `_dnx_assessment_level_value eq ${id}`)
        .join(' or ');
      const r = await Dnx_evaluationcriteriasService.getAll({
        filter,
        top: 500,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load criteria');
      const out = new Map<string, Criteria>();
      for (const row of r.data ?? []) {
        const c = toCriteria(row);
        // M7a: one criteria per level. If multiple exist (legacy / M7b), keep first.
        if (c && !out.has(c.levelId)) out.set(c.levelId, c);
      }
      return out;
    },
  });
}

export interface UpsertCriteriaInput {
  /** Existing row id, or undefined to create. */
  id?: string;
  levelId: string;
  name: string;
  /** Question-level only. Other levels can pass any value (it'll be ignored). */
  operator: OperatorKey;
  targetValue: string;
  outcomeIfPass: OutcomePassKey;
  outcomeIfFail: OutcomeFailKey;
  scoringType: ScoringTypeKey;
  /** 0..1 — Weighted scoring pass ratio. */
  passThreshold: number;
  /** 0..N — how this level counts when its parent aggregates. */
  weight: number;
  /**
   * Question Value (0) for question rules, Subsection Outcome (1) for
   * subsection rules, Section Outcome (2) for section rules. The evaluator
   * doesn't read it back today; it's there for the future server cascade
   * + reporting filters.
   */
  sourceType: 0 | 1 | 2;
}

export function useUpsertCriteria(levelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertCriteriaInput): Promise<string> => {
      // Picklist payloads go out as the numeric option-set values. The
      // autogenerated types expose them as string keys ('Equals', 'Boolean'),
      // but Dataverse Web API accepts the numbers — cast through unknown
      // matches the pattern used by the other feature modules.
      const body = {
        dnx_criteria_name: input.name.slice(0, 100),
        dnx_operator: OPERATOR[input.operator],
        dnx_target_value: input.targetValue,
        dnx_outcome_if_pass: OUTCOME_PASS[input.outcomeIfPass],
        dnx_outcome_if_fail: OUTCOME_FAIL[input.outcomeIfFail],
        dnx_scoring_type: SCORING_TYPE[input.scoringType],
        dnx_source_type: input.sourceType,
        dnx_pass_threshold: input.passThreshold,
        dnx_weight: input.weight,
      } as unknown as Partial<Dnx_evaluationcriteriasBase>;

      if (input.id) {
        const r = await Dnx_evaluationcriteriasService.update(input.id, body);
        if (!r.success) throw new Error(r.error?.message ?? 'Failed to save rule');
        return input.id;
      }
      const create = await Dnx_evaluationcriteriasService.create({
        ...body,
        'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${input.levelId})`,
        'dnx_Source_Assessment_Level@odata.bind': `/dnx_assessment_levels(${input.levelId})`,
        statecode: 0,
        statuscode: 1,
      } as unknown as Omit<Dnx_evaluationcriteriasBase, 'dnx_evaluationcriteriaid'>);
      if (!create.success || !create.data) {
        throw new Error(create.error?.message ?? 'Failed to create rule');
      }
      return create.data.dnx_evaluationcriteriaid;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: criteriaKeys.byLevel(levelId) });
      // Coarse — any template-wide criteria query also needs to refresh.
      qc.invalidateQueries({ queryKey: ['criteria', 'levels'] });
    },
  });
}

export function useDeleteCriteria(levelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await Dnx_evaluationcriteriasService.delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: criteriaKeys.byLevel(levelId) });
      qc.invalidateQueries({ queryKey: ['criteria', 'levels'] });
    },
  });
}
