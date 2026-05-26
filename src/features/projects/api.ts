import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dnx_projectsService } from '../../generated';
import type { Dnx_projects, Dnx_projectsBase } from '../../generated/models/Dnx_projectsModel';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export interface ProjectFormValue {
  dnx_project_name: string;
  dnx_project_code?: string;
  dnx_description?: string;
  /** 1 = Active, 2 = Inactive, 778540001 = Archived, 778540002 = OnHold */
  statuscode?: 1 | 2 | 778540001 | 778540002;
}

export type CreateProjectInput = ProjectFormValue;
export type UpdateProjectInput = ProjectFormValue;

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: async (): Promise<Dnx_projects[]> => {
      const result = await Dnx_projectsService.getAll({
        orderBy: ['createdon desc'],
        top: 100,
      });
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Failed to load projects');
      }
      return result.data ?? [];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Dnx_projects> => {
      // Per Power Apps SDK docs: omit primary key + ownership fields on create —
      // the platform fills ownerid/owneridtype from the signed-in user.
      const record = {
        dnx_project_name: input.dnx_project_name,
        dnx_project_code: input.dnx_project_code,
        dnx_description: input.dnx_description,
        statecode: 0,
        statuscode: input.statuscode ?? 1,
      };
      const result = await Dnx_projectsService.create(
        record as unknown as Omit<Dnx_projectsBase, 'dnx_projectid'>,
      );
      if (!result.success || !result.data) {
        throw new Error(result.error?.message ?? 'Failed to create project');
      }
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProjectInput): Promise<Dnx_projects> => {
      // Only send fields that actually changed — but we keep this simple and pass all editable fields.
      const changes: Partial<Omit<Dnx_projectsBase, 'dnx_projectid'>> = {
        dnx_project_name: input.dnx_project_name,
        dnx_project_code: input.dnx_project_code,
        dnx_description: input.dnx_description,
        statuscode: input.statuscode ?? 1,
      };
      const result = await Dnx_projectsService.update(id, changes);
      if (!result.success || !result.data) {
        throw new Error(result.error?.message ?? 'Failed to update project');
      }
      return result.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(projectKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await Dnx_projectsService.delete(id);
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Dnx_projects> => {
      const result = await Dnx_projectsService.get(id!);
      if (!result.success || !result.data) {
        throw new Error(result.error?.message ?? 'Project not found');
      }
      return result.data;
    },
  });
}
