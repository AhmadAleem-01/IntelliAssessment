import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dnx_assessment_instancesService,
  Dnx_assessment_responsesService,
} from '../../generated';
import type {
  Dnx_assessment_instances,
  Dnx_assessment_instancesBase,
} from '../../generated/models/Dnx_assessment_instancesModel';
import type {
  Dnx_assessment_responses,
  Dnx_assessment_responsesBase,
} from '../../generated/models/Dnx_assessment_responsesModel';
import type { DataType } from '../templates/levels/levelTypes';

export const assessmentKeys = {
  all: ['assessments'] as const,
  list: () => [...assessmentKeys.all, 'list'] as const,
  byProject: (projectId: string) => [...assessmentKeys.all, 'byProject', projectId] as const,
  detail: (id: string) => [...assessmentKeys.all, 'detail', id] as const,
  responses: (instanceId: string) =>
    [...assessmentKeys.all, 'responses', instanceId] as const,
};

export interface CreateAssessmentInput {
  name: string;
  projectId: string;
  templateId: string;
  /** ISO date (YYYY-MM-DD) — `dnx_duedate` is configured Date Only in Dataverse. */
  dueDate?: string;
}

/** Every instance in the org, newest first. */
export function useAssessmentInstances() {
  return useQuery({
    queryKey: assessmentKeys.list(),
    queryFn: async (): Promise<Dnx_assessment_instances[]> => {
      const r = await Dnx_assessment_instancesService.getAll({
        orderBy: ['createdon desc'],
        top: 200,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load assessments');
      return r.data ?? [];
    },
  });
}

/** Instances belonging to a single project. */
export function useAssessmentInstancesByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.byProject(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async (): Promise<Dnx_assessment_instances[]> => {
      const r = await Dnx_assessment_instancesService.getAll({
        filter: `_dnx_project_value eq ${projectId}`,
        orderBy: ['createdon desc'],
        top: 100,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load assessments');
      return r.data ?? [];
    },
  });
}

export function useAssessmentInstance(id: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Dnx_assessment_instances> => {
      const r = await Dnx_assessment_instancesService.get(id!);
      if (!r.success || !r.data) {
        throw new Error(r.error?.message ?? 'Assessment not found');
      }
      return r.data;
    },
  });
}

export function useCreateAssessmentInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssessmentInput): Promise<Dnx_assessment_instances> => {
      const record: Record<string, unknown> = {
        dnx_assessment_name: input.name,
        // Lookups: SchemaName-cased @odata.bind keys (see context.md gotcha K).
        // If you ever get a `Does Not Exist` 404 here despite the GUID being
        // valid, the most likely cause is the lookup column on the source
        // table pointing at the WRONG table (e.g. an accidental duplicate
        // `dnx_projects` table) — see context.md gotcha M.
        'dnx_Project@odata.bind': `/dnx_projects(${input.projectId})`,
        'dnx_AssessmentTemplate@odata.bind': `/dnx_assessment_templates(${input.templateId})`,
        statecode: 0,
        statuscode: 778540001, // Draft
        dnx_version: 1,
        dnx_outcome: 2, // Pending
      };
      if (input.dueDate) {
        // dnx_duedate is likely Date Only — slice to YYYY-MM-DD just in case
        // (gotcha B). Already a date string when coming from <input type=date>,
        // but slicing is idempotent.
        record.dnx_duedate = input.dueDate.slice(0, 10);
      }
      const r = await Dnx_assessment_instancesService.create(
        record as unknown as Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>,
      );
      if (!r.success || !r.data) {
        console.error('[create assessment] failed', r.error, 'payload:', record);
        throw new Error(r.error?.message ?? 'Failed to create assessment');
      }
      return r.data;
    },
    onSuccess: (data) => {
      // Invalidate the list views and the per-project list this instance landed in.
      qc.invalidateQueries({ queryKey: assessmentKeys.list() });
      const projectId = (data as unknown as Record<string, unknown>)
        ._dnx_project_value as string | undefined;
      if (projectId) {
        qc.invalidateQueries({ queryKey: assessmentKeys.byProject(projectId) });
      }
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Assessment Responses (M4b)                                                 */
/* -------------------------------------------------------------------------- */

/** All response rows for one assessment instance, indexed by level on the consumer side. */
export function useAssessmentResponses(instanceId: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.responses(instanceId ?? ''),
    enabled: !!instanceId,
    queryFn: async (): Promise<Dnx_assessment_responses[]> => {
      const r = await Dnx_assessment_responsesService.getAll({
        filter: `_dnx_assessment_value eq ${instanceId}`,
        orderBy: ['createdon asc'],
        top: 500,
      });
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Failed to load responses');
      }
      return r.data ?? [];
    },
  });
}

/**
 * Discriminated input describing a single answer being saved. The dataType
 * drives which `dnx_response_*` column gets written.
 */
export interface UpsertResponseInput {
  instanceId: string;
  levelId: string;
  /** The question's name — used as the response row's `dnx_name`. */
  questionName: string;
  dataType: DataType;
  /** The answer value, shape depends on dataType. */
  value: boolean | string | string[] | null;
}

/**
 * Map a (dataType, value) pair to the right Dataverse column. Only ONE
 * `dnx_response_*` column ever holds the value — the others are explicitly
 * cleared so a re-answered question with a different data type doesn't keep
 * stale data.
 */
function responseColumns(
  dataType: DataType,
  value: boolean | string | string[] | null,
): Partial<Dnx_assessment_responsesBase> {
  const blank: Partial<Dnx_assessment_responsesBase> = {
    dnx_response_boolean: undefined,
    dnx_response_option: undefined,
    dnx_response_multi: undefined,
    dnx_response_text: undefined,
    dnx_response_date: undefined,
  };
  if (value === null || value === undefined) return blank;
  switch (dataType) {
    case 0: // Boolean
      return { ...blank, dnx_response_boolean: typeof value === 'boolean' ? value : value === 'Yes' };
    case 1: // OptionSet
      return { ...blank, dnx_response_option: String(value) };
    case 2: // Multiselect — stored as JSON array of strings
      return {
        ...blank,
        dnx_response_multi: JSON.stringify(Array.isArray(value) ? value : []),
      };
    case 3: // Text
      return { ...blank, dnx_response_text: String(value) };
    case 4: // Date — date-only (YYYY-MM-DD), see gotcha B
      return { ...blank, dnx_response_date: typeof value === 'string' ? value.slice(0, 10) : undefined };
  }
}

/**
 * Create or update a response row for a (instance, level) pair.
 *
 * Look up existing rows in the cache (keyed by `_dnx_assessment_level_value`).
 * If one exists for this level, send an UPDATE. Otherwise, CREATE with both
 * lookups bound via `@odata.bind` (SchemaName-cased per gotcha K). Both branches
 * invalidate the responses query so the renderer sees the fresh value.
 */
export function useUpsertResponse(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertResponseInput): Promise<Dnx_assessment_responses> => {
      const cached = qc.getQueryData<Dnx_assessment_responses[]>(
        assessmentKeys.responses(instanceId),
      );
      const existing = cached?.find(
        (r) =>
          (r as unknown as Record<string, unknown>)._dnx_assessment_level_value ===
          input.levelId,
      );
      const columns = responseColumns(input.dataType, input.value);

      if (existing) {
        const r = await Dnx_assessment_responsesService.update(
          existing.dnx_assessment_responseid,
          columns as Partial<Omit<Dnx_assessment_responsesBase, 'dnx_assessment_responseid'>>,
        );
        if (!r.success || !r.data) {
          console.error('[upsert response] update failed', r.error, columns);
          throw new Error(r.error?.message ?? 'Failed to save answer');
        }
        return r.data;
      }

      const record: Record<string, unknown> = {
        dnx_name: input.questionName,
        'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${input.instanceId})`,
        'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${input.levelId})`,
        statecode: 0,
        statuscode: 1,
        ...columns,
      };
      const r = await Dnx_assessment_responsesService.create(
        record as unknown as Omit<Dnx_assessment_responsesBase, 'dnx_assessment_responseid'>,
      );
      if (!r.success || !r.data) {
        console.error('[upsert response] create failed', r.error, record);
        throw new Error(r.error?.message ?? 'Failed to save answer');
      }
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.responses(instanceId) });
    },
  });
}
