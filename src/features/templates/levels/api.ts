import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dnx_assessment_levelsService } from '../../../generated';
import type {
  Dnx_assessment_levels,
  Dnx_assessment_levelsBase,
} from '../../../generated/models/Dnx_assessment_levelsModel';
import type { LevelType, DataType } from './levelTypes';
import { serializeVisibility, type VisibilityRule } from './visibility';

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
  /**
   * Conditional visibility rule. When set, this Question is shown at runtime
   * only if the referenced source Question's answer matches. Stored as JSON
   * in `dnx_visibility_condition`. Only valid when levelType === 3 (Question).
   */
  visibilityRule?: VisibilityRule;
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
    // Always include (possibly undefined → null) so clearing a rule writes back.
    dnx_visibility_condition:
      input.levelType === 3 ? serializeVisibility(input.visibilityRule) : undefined,
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
 * Recursively copy a level and all its descendants into the same parent bucket.
 *
 * Siblings within a level are created in parallel (they all share the same
 * parent GUID once the parent record exists), giving good throughput on wide
 * trees. The root of the copied subtree gets " (copy)" appended to its name
 * so users can distinguish it; descendants keep their original names since
 * they're already namespaced under the new copy.
 *
 * Placement: the copy is appended to the end of the parent's sibling bucket.
 * Users can drag-reorder it if they want it elsewhere.
 */
export function useDuplicateLevel(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      source: LevelNodeLike;
      /** Parent under which the copy lands. Null means a top-level section. */
      parentLevelId: string | null;
      /** Order slot for the new root copy (typically nextOrder(siblings)). */
      order: number;
    }): Promise<void> => {
      const copy = async (
        node: LevelNodeLike,
        newParentId: string | null,
        newOrder: number,
        isRoot: boolean,
      ): Promise<string> => {
        const src = node.level;
        const record: Record<string, unknown> = {
          dnx_name: isRoot ? `${src.dnx_name} (copy)` : src.dnx_name,
          dnx_description: src.dnx_description,
          dnx_assessment_level_type: src.dnx_assessment_level_type,
          dnx_assessment_level_order: newOrder,
          dnx_data_type: src.dnx_data_type,
          dnx_hint_text: src.dnx_hint_text,
          dnx_include_in_letter: src.dnx_include_in_letter,
          dnx_is_required: src.dnx_is_required,
          dnx_is_read_only: src.dnx_is_read_only,
          dnx_option_set_reference: src.dnx_option_set_reference,
          dnx_document_type_reference: src.dnx_document_type_reference,
          dnx_visibility_condition: src.dnx_visibility_condition,
          'dnx_Assessment_Template@odata.bind': `/dnx_assessment_templates(${templateId})`,
        };
        if (newParentId) {
          record['dnx_Parent_Assessment_Level@odata.bind'] =
            `/dnx_assessment_levels(${newParentId})`;
        }
        const r = await Dnx_assessment_levelsService.create(
          record as unknown as Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>,
        );
        if (!r.success || !r.data) {
          console.error('[duplicate level] create failed', r.error, 'payload:', record);
          throw new Error(r.error?.message ?? 'Failed to duplicate level');
        }
        const newId = r.data.dnx_assessment_levelid;
        // Children fire in parallel under their newly-created parent.
        await Promise.all(
          node.children.map((child, i) => copy(child, newId, i, false)),
        );
        return newId;
      };
      await copy(params.source, params.parentLevelId, params.order, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: levelKeys.byTemplate(templateId) });
    },
  });
}

/** Minimal shape the duplicate mutation needs — matches `LevelNode` from treeBuilder. */
interface LevelNodeLike {
  level: Dnx_assessment_levels;
  children: LevelNodeLike[];
}

/**
 * Persist a new order for a list of sibling levels.
 *
 * Caller supplies the full ordered ID list. We diff against the current
 * cache to fire only the updates whose `dnx_assessment_level_order`
 * actually changed (typical reorder touches 2 records, not the whole bucket).
 */
export function useReorderLevels(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      /** Full ordered list of sibling IDs after the move. */
      orderedIds: string[];
      /** Current full level list for diffing — passed in so the hook stays pure. */
      currentLevels: Dnx_assessment_levels[];
    }): Promise<void> => {
      const byId = new Map(
        params.currentLevels.map((l) => [l.dnx_assessment_levelid, l] as const),
      );
      const updates: Array<Promise<unknown>> = [];
      params.orderedIds.forEach((id, newOrder) => {
        const existing = byId.get(id);
        if (!existing) return;
        if ((existing.dnx_assessment_level_order ?? 0) === newOrder) return;
        updates.push(
          Dnx_assessment_levelsService.update(id, {
            dnx_assessment_level_order: newOrder,
          } as unknown as Partial<Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>>),
        );
      });
      await Promise.all(updates);
    },
    // Optimistic update: re-write the orders in the cache immediately so the
    // UI doesn't flash while the network round-trips happen.
    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey: levelKeys.byTemplate(templateId) });
      const prev = qc.getQueryData<Dnx_assessment_levels[]>(
        levelKeys.byTemplate(templateId),
      );
      if (prev) {
        const orderById = new Map(params.orderedIds.map((id, i) => [id, i] as const));
        qc.setQueryData<Dnx_assessment_levels[]>(
          levelKeys.byTemplate(templateId),
          prev.map((l) =>
            orderById.has(l.dnx_assessment_levelid)
              ? {
                  ...l,
                  dnx_assessment_level_order: orderById.get(l.dnx_assessment_levelid),
                }
              : l,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back the optimistic update.
      if (ctx?.prev) {
        qc.setQueryData(levelKeys.byTemplate(templateId), ctx.prev);
      }
    },
    onSettled: () => {
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
