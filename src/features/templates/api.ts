import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dnx_assessment_templatesService } from '../../generated';
import type {
  Dnx_assessment_templates,
  Dnx_assessment_templatesBase,
} from '../../generated/models/Dnx_assessment_templatesModel';

export const templateKeys = {
  all: ['templates'] as const,
  list: () => [...templateKeys.all, 'list'] as const,
  detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
};

export interface TemplateFormValue {
  dnx_template_name: string;
  dnx_description?: string;
  /** 1 Active · 2 Inactive · 778540001 Draft · 778540002 Published · 778540003 Deprecated */
  statuscode?: 1 | 2 | 778540001 | 778540002 | 778540003;
}

export type CreateTemplateInput = TemplateFormValue;
export type UpdateTemplateInput = TemplateFormValue;

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: async (): Promise<Dnx_assessment_templates[]> => {
      const r = await Dnx_assessment_templatesService.getAll({
        orderBy: ['modifiedon desc'],
        top: 100,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load templates');
      return r.data ?? [];
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Dnx_assessment_templates> => {
      const r = await Dnx_assessment_templatesService.get(id!);
      if (!r.success || !r.data) {
        throw new Error(r.error?.message ?? 'Template not found');
      }
      return r.data;
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput): Promise<Dnx_assessment_templates> => {
      const record = {
        dnx_template_name: input.dnx_template_name,
        dnx_description: input.dnx_description,
        dnx_template_version: 1,
        statecode: 0,
        statuscode: input.statuscode ?? 778540001, // Default to Draft
      };
      const r = await Dnx_assessment_templatesService.create(
        record as unknown as Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>,
      );
      if (!r.success || !r.data) {
        throw new Error(r.error?.message ?? 'Failed to create template');
      }
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTemplateInput): Promise<Dnx_assessment_templates> => {
      const changes: Partial<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>> = {
        dnx_template_name: input.dnx_template_name,
        dnx_description: input.dnx_description,
        statuscode: input.statuscode ?? 778540001,
      };
      const r = await Dnx_assessment_templatesService.update(id, changes);
      if (!r.success || !r.data) {
        throw new Error(r.error?.message ?? 'Failed to update template');
      }
      return r.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(templateKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await Dnx_assessment_templatesService.delete(id);
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: templateKeys.detail(id) });
      qc.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

/**
 * Persist the custom outcome-letter layout (M8b) into `dnx_letter_template_json`.
 * Targeted PATCH of just that column so authoring the letter doesn't disturb
 * the template's other fields. Patches the detail cache optimistically so the
 * Letter tab + the letter dialog see the saved layout immediately. Pass the
 * serialised JSON string (empty string to clear back to the default layout).
 */
export function useSaveLetterLayout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (letterTemplateJson: string): Promise<void> => {
      const r = await Dnx_assessment_templatesService.update(
        id,
        {
          dnx_letter_template_json: letterTemplateJson,
        } as Partial<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>,
      );
      if (!r.success) {
        console.error('[save letter layout] failed', r.error);
        throw new Error(r.error?.message ?? 'Failed to save letter layout');
      }
    },
    onSuccess: (_data, letterTemplateJson) => {
      const cached = qc.getQueryData<Dnx_assessment_templates>(templateKeys.detail(id));
      if (cached) {
        qc.setQueryData<Dnx_assessment_templates>(templateKeys.detail(id), {
          ...cached,
          dnx_letter_template_json: letterTemplateJson,
        });
      }
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) });
    },
  });
}

/** Publish: flip status to Published and bump version + published_on timestamp. */
export function usePublishTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentVersion: number): Promise<Dnx_assessment_templates> => {
      const changes = {
        statuscode: 778540002, // Published
        dnx_template_version: currentVersion + 1,
        // dnx_published_on is configured as Date Only in Dataverse (Edm.Date) —
        // must be YYYY-MM-DD, not a full ISO datetime.
        dnx_published_on: new Date().toISOString().slice(0, 10),
      };
      const r = await Dnx_assessment_templatesService.update(
        id,
        changes as Partial<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>,
      );
      if (!r.success || !r.data) {
        // Surface the real Dataverse error to the console so we can see what was rejected.
        console.error('[publish template] failed', r.error, 'payload:', changes);
        throw new Error(r.error?.message ?? 'Failed to publish template');
      }
      return r.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(templateKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}
