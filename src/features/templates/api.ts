import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClient } from '@microsoft/power-apps/data';
import { Dnx_assessment_templatesService } from '../../generated';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
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

/**
 * Persist the application-details **sample JSON** (the shape authors map against
 * — see the Details tab) into `dnx_application_schema`. Targeted PATCH of just
 * that column with an optimistic cache update, mirroring `useSaveLetterLayout`.
 * Pass the raw JSON string (empty string clears it).
 */
export function useSaveApplicationSchema(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationSchema: string): Promise<void> => {
      const r = await Dnx_assessment_templatesService.update(
        id,
        {
          dnx_application_schema: applicationSchema,
        } as Partial<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>,
      );
      if (!r.success) {
        console.error('[save application schema] failed', r.error);
        throw new Error(r.error?.message ?? 'Failed to save application schema');
      }
    },
    onSuccess: (_data, applicationSchema) => {
      const cached = qc.getQueryData<Dnx_assessment_templates>(templateKeys.detail(id));
      if (cached) {
        qc.setQueryData<Dnx_assessment_templates>(templateKeys.detail(id), {
          ...cached,
          dnx_application_schema: applicationSchema,
        });
      }
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) });
    },
  });
}

/**
 * Upload a background image for the outcome letter into the template's
 * `dnx_letter_background` **File** column (File over Image — Image columns
 * downscale + re-encode, ruining a crisp logo; File stores exact bytes; see
 * gotcha AB). File columns can't be written through the normal update body —
 * they need the two-part write (gotcha O): the row already exists, so we just
 * push the bytes via `uploadFileToRecord`. On success we refetch the template
 * so the new `dnx_letter_background_name` lands in the cache.
 */
export function useSaveLetterBackground(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<void> => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const client = getClient(dataSourcesInfo);
      const r = await client.uploadFileToRecord(
        'dnx_assessment_templates',
        id,
        'dnx_letter_background',
        file.name,
        bytes,
      );
      // The SDK returns a result envelope; surface a failure rather than
      // silently leaving the author thinking the image saved.
      if (r && typeof r === 'object' && 'success' in r && (r as { success: boolean }).success === false) {
        console.error('[save letter background] failed', r);
        throw new Error('Failed to upload the letter background image.');
      }
    },
    onSuccess: () => {
      // Force a refetch so the new dnx_letter_background_name arrives.
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) });
    },
  });
}

// Note: the SDK has no delete-file-from-record method, so "remove background"
// is handled purely in the layout by flipping `page.image = false` — the
// renderer then ignores the (still-present) bytes. See gotcha AB.

/**
 * Resolve a displayable URL for the template's letter-background image.
 *
 * A File column isn't servable by URL, so we download the bytes via
 * `downloadFileFromRecord` (the same call the Word export uses — proven to
 * work) and wrap them in an object URL. Returns undefined until loaded / when
 * disabled. Only fetch when `enabled` (i.e. the layout actually uses a
 * background) to avoid pulling image bytes needlessly. The object URL is
 * revoked on cleanup so we don't leak blobs.
 *
 * `refreshKey` (e.g. `dnx_letter_background_name` + a client counter) forces a
 * re-download after a replacement upload, since neither id nor enabled changes.
 */
export function useLetterBackgroundObjectUrl(
  id: string | undefined,
  enabled: boolean,
  refreshKey?: number | string,
) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    // Nothing to load — resolve to undefined asynchronously (never call
    // setState synchronously in an effect body).
    if (!id || !enabled) {
      Promise.resolve().then(() => {
        if (!cancelled) setUrl(undefined);
      });
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const client = getClient(dataSourcesInfo);
        const r = await client.downloadFileFromRecord(
          'dnx_assessment_templates',
          id,
          'dnx_letter_background',
        );
        if (cancelled) return;
        if (r.success && r.data && r.data.byteLength > 0) {
          objectUrl = URL.createObjectURL(new Blob([r.data]));
          setUrl(objectUrl);
        } else {
          setUrl(undefined);
        }
      } catch (err) {
        console.warn('[letter background] load failed', err);
        if (!cancelled) setUrl(undefined);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, enabled, refreshKey]);
  // Guard against a stale URL flashing when the caller disables the background
  // (the async clear above catches up a tick later).
  return enabled ? url : undefined;
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
