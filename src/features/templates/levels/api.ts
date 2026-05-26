import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dnx_assessment_levelsService } from '../../../generated';
import type {
  Dnx_assessment_levels,
  Dnx_assessment_levelsBase,
} from '../../../generated/models/Dnx_assessment_levelsModel';
import type { LevelType, DataType } from './levelTypes';

export const levelKeys = {
  all: ['levels'] as const,
  byTemplate: (templateId: string) => [...levelKeys.all, 'byTemplate', templateId] as const,
};

export interface LevelFormValue {
  name: string;
  description?: string;
  levelType: LevelType;
  /** Required when levelType === 3 (Question). */
  dataType?: DataType;
  hintText?: string;
  includeInLetter?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  optionSetReference?: string;
  documentTypeReference?: string;
}

export interface CreateLevelInput extends LevelFormValue {
  templateId: string;
  /** Parent level id; null/undefined means top-level (sibling of root sections). */
  parentLevelId?: string | null;
  order: number;
}

export interface UpdateLevelInput extends LevelFormValue {
  /** Allow changing order during edit or via drag-reorder. */
  order?: number;
}

/** All levels for a template, sorted by order within siblings. */
export function useTemplateLevels(templateId: string | undefined) {
  return useQuery({
    queryKey: levelKeys.byTemplate(templateId ?? ''),
    enabled: !!templateId,
    queryFn: async (): Promise<Dnx_assessment_levels[]> => {
      const r = await Dnx_assessment_levelsService.getAll({
        filter: `_dnx_assessment_template_value eq ${templateId}`,
        orderBy: ['dnx_assessment_level_order asc', 'createdon asc'],
        top: 500,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load levels');
      return r.data ?? [];
    },
  });
}

/** Build the OData @odata.bind value used for Dataverse lookup fields. */
function bindLookup(entitySet: string, id: string): string {
  return `/${entitySet}(${id})`;
}

function levelToRecord(
  input: LevelFormValue & {
    templateId?: string;
    parentLevelId?: string | null;
    order?: number;
  },
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    dnx_name: input.name,
    dnx_description: input.description,
    dnx_assessment_level_type: input.levelType,
    dnx_assessment_level_order: input.order,
    dnx_hint_text: input.hintText,
    dnx_include_in_letter: input.includeInLetter,
    dnx_is_required: input.isRequired,
    dnx_is_read_only: input.isReadOnly,
    dnx_option_set_reference: input.optionSetReference,
    dnx_document_type_reference: input.documentTypeReference,
  };
  // Question levels carry data type; otherwise omit so Dataverse keeps it null.
  if (input.levelType === 3 && input.dataType !== undefined) {
    record.dnx_data_type = input.dataType;
  }
  if (input.templateId) {
    record['dnx_Assessment_Template@odata.bind'] = bindLookup(
      'dnx_assessment_templates',
      input.templateId,
    );
  }
  if (input.parentLevelId) {
    record['dnx_Parent_Assessment_Level@odata.bind'] = bindLookup(
      'dnx_assessment_levels',
      input.parentLevelId,
    );
  }
  return record;
}

export function useCreateLevel(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLevelInput): Promise<Dnx_assessment_levels> => {
      const record = levelToRecord({ ...input, templateId });
      const r = await Dnx_assessment_levelsService.create(
        record as unknown as Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>,
      );
      if (!r.success || !r.data) {
        console.error('[create level] failed', r.error, 'payload:', record);
        throw new Error(r.error?.message ?? 'Failed to create level');
      }
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: levelKeys.byTemplate(templateId) });
    },
  });
}

export function useUpdateLevel(templateId: string, levelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateLevelInput): Promise<Dnx_assessment_levels> => {
      const record = levelToRecord(input);
      const r = await Dnx_assessment_levelsService.update(
        levelId,
        record as unknown as Partial<Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>>,
      );
      if (!r.success || !r.data) {
        console.error('[update level] failed', r.error, 'payload:', record);
        throw new Error(r.error?.message ?? 'Failed to update level');
      }
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: levelKeys.byTemplate(templateId) });
    },
  });
}

/**
 * Delete a level and all its descendants. Dataverse cascade rules on the
 * self-reference may or may not be configured, so we iterate the local tree
 * and delete bottom-up to guarantee no orphans.
 */
export function useDeleteLevel(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      levelId: string;
      descendantIds: string[];
    }): Promise<void> => {
      // Delete deepest descendants first so each parent is empty when removed.
      const ids = [...params.descendantIds, params.levelId];
      for (const id of ids) {
        await Dnx_assessment_levelsService.delete(id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: levelKeys.byTemplate(templateId) });
    },
  });
}
