import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dnx_assessment_instancesService } from '../../generated';
import type {
  Dnx_assessment_instances,
  Dnx_assessment_instancesBase,
} from '../../generated/models/Dnx_assessment_instancesModel';

export const assessmentKeys = {
  all: ['assessments'] as const,
  list: () => [...assessmentKeys.all, 'list'] as const,
  byProject: (projectId: string) => [...assessmentKeys.all, 'byProject', projectId] as const,
  detail: (id: string) => [...assessmentKeys.all, 'detail', id] as const,
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
