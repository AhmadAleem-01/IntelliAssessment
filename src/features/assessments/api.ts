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
      // Side-effect: bump the instance's version + invalidate so the autosave
      // badge updates. Fire-and-forget — if the version bump fails for any
      // reason we don't want to mask the successful response save.
      void bumpInstanceVersion(qc, instanceId);
    },
  });
}

/**
 * Increment `dnx_assessment_instances.dnx_version` by 1.
 *
 * Reads the current value from the React Query cache (already loaded by
 * AssessmentPage's `useAssessmentInstance` query), writes back the next
 * integer, and invalidates the detail query so the `v{n}` badge in the
 * hero refreshes. Errors are logged but not re-thrown — the caller's
 * primary mutation succeeded; we don't want to surface "version bump
 * failed" toasts when the user already saw their answer save.
 */
async function bumpInstanceVersion(
  qc: ReturnType<typeof useQueryClient>,
  instanceId: string,
): Promise<void> {
  try {
    const cached = qc.getQueryData<Dnx_assessment_instances>(
      assessmentKeys.detail(instanceId),
    );
    const current = cached?.dnx_version ?? 0;
    const next = current + 1;
    await Dnx_assessment_instancesService.update(instanceId, {
      dnx_version: next,
    } as unknown as Partial<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>);
    // Optimistic local update so the badge reads `v{next}` before the
    // refetch lands.
    if (cached) {
      qc.setQueryData<Dnx_assessment_instances>(assessmentKeys.detail(instanceId), {
        ...cached,
        dnx_version: next,
      });
    }
    qc.invalidateQueries({ queryKey: assessmentKeys.detail(instanceId) });
  } catch (e) {
    console.warn('[bumpInstanceVersion] failed', e);
  }
}

/**
 * Flip the instance from Draft → PendingReview after the assessor confirms
 * submission. Sets `dnx_submittedon` to the current date (Edm.Date — gotcha B)
 * and bumps the version one final time so the submission has a distinct slot.
 *
 * Caller is responsible for required-field validation BEFORE invoking this
 * mutation — see `validateSubmission()` in responseHelpers.ts.
 */
export function useSubmitForReview(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;
      const changes = {
        statuscode: 778540003, // PendingReview
        dnx_submittedon: new Date().toISOString().slice(0, 10),
        dnx_version: nextVersion,
      };
      const r = await Dnx_assessment_instancesService.update(
        instanceId,
        changes as unknown as Partial<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>,
      );
      if (!r.success || !r.data) {
        console.error('[submit assessment] failed', r.error, changes);
        throw new Error(r.error?.message ?? 'Failed to submit');
      }
      return r.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(assessmentKeys.detail(instanceId), data);
      qc.invalidateQueries({ queryKey: assessmentKeys.list() });
      const projectId = (data as unknown as Record<string, unknown>)
        ._dnx_project_value as string | undefined;
      if (projectId) {
        qc.invalidateQueries({ queryKey: assessmentKeys.byProject(projectId) });
      }
    },
  });
}

/**
 * Reopen a previously-submitted assessment for further edits.
 *
 * Flips `statuscode` from PendingReview → InProgress (778540002) and bumps
 * the version. The original `dnx_submittedon` date is deliberately left
 * intact — it records that the assessment WAS submitted at some point even
 * if it's been pulled back. A reviewer can still see this history once the
 * audit-snapshot work (M4c.5) lands.
 *
 * Caller should confirm via dialog before invoking — there's no validation
 * here, the assessor is consciously unlocking their own work.
 */
export function useReopenAssessment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;
      const changes = {
        statuscode: 778540002, // InProgress
        dnx_version: nextVersion,
      };
      const r = await Dnx_assessment_instancesService.update(
        instanceId,
        changes as unknown as Partial<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>,
      );
      if (!r.success || !r.data) {
        console.error('[reopen assessment] failed', r.error, changes);
        throw new Error(r.error?.message ?? 'Failed to reopen');
      }
      return r.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(assessmentKeys.detail(instanceId), data);
      qc.invalidateQueries({ queryKey: assessmentKeys.list() });
      const projectId = (data as unknown as Record<string, unknown>)
        ._dnx_project_value as string | undefined;
      if (projectId) {
        qc.invalidateQueries({ queryKey: assessmentKeys.byProject(projectId) });
      }
    },
  });
}
