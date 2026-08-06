import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClient } from '@microsoft/power-apps/data';
import {
  Dnx_assessment_instancesService,
  Dnx_assessment_responsesService,
  Dnx_assessment_versionsService,
  Dnx_reviewer_commentsService,
} from '../../generated';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
import type {
  Dnx_assessment_instances,
  Dnx_assessment_instancesBase,
} from '../../generated/models/Dnx_assessment_instancesModel';
import type {
  Dnx_assessment_responses,
  Dnx_assessment_responsesBase,
} from '../../generated/models/Dnx_assessment_responsesModel';
import type {
  Dnx_assessment_versions,
  Dnx_assessment_versionsBase,
} from '../../generated/models/Dnx_assessment_versionsModel';
import type {
  Dnx_reviewer_comments,
  Dnx_reviewer_commentsBase,
} from '../../generated/models/Dnx_reviewer_commentsModel';
import type { DataType } from '../templates/levels/levelTypes';
import { lookupId } from '../../lib/dataverse';

export const assessmentKeys = {
  all: ['assessments'] as const,
  list: () => [...assessmentKeys.all, 'list'] as const,
  byProject: (projectId: string) => [...assessmentKeys.all, 'byProject', projectId] as const,
  detail: (id: string) => [...assessmentKeys.all, 'detail', id] as const,
  responses: (instanceId: string) =>
    [...assessmentKeys.all, 'responses', instanceId] as const,
  comments: (instanceId: string) =>
    [...assessmentKeys.all, 'comments', instanceId] as const,
  versions: (instanceId: string) =>
    [...assessmentKeys.all, 'versions', instanceId] as const,
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
/* Evidence file mapping (M6b — assessment-time variable → real file binding)  */
/* -------------------------------------------------------------------------- */

/**
 * The assessor's binding of each template-declared evidence file variable
 * (e.g. `q1-resume`) to a real uploaded file name. Persisted as JSON in the
 * `dnx_evidence_mapping` multiline-text column so the auto-fill dialog can
 * restore the assessor's picks across reloads instead of falling back to the
 * name-match best guess every time.
 */
export type EvidenceMapping = Record<string, string>;

/** Parse the stored mapping JSON; tolerant of empty / malformed values. */
export function parseEvidenceMapping(stored: string | undefined | null): EvidenceMapping {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: EvidenceMapping = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v) out[k] = v;
      }
      return out;
    }
  } catch {
    /* fall through — treat as no mapping */
  }
  return {};
}

/**
 * Persist the evidence mapping on the instance. Writes the JSON into
 * `dnx_evidence_mapping` and patches the detail cache optimistically so a
 * reopened dialog sees the saved picks immediately. Deliberately does NOT bump
 * the version or snapshot — the mapping is operator scaffolding for auto-fill,
 * not an answer, so it shouldn't pollute the audit trail or version count.
 */
export function useSaveEvidenceMapping(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: EvidenceMapping): Promise<void> => {
      const json = Object.keys(mapping).length ? JSON.stringify(mapping) : '';
      const r = await Dnx_assessment_instancesService.update(
        instanceId,
        { dnx_evidence_mapping: json } as unknown as Partial<
          Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>
        >,
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Failed to save evidence mapping');
      }
    },
    onSuccess: (_data, mapping) => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      if (cached) {
        qc.setQueryData<Dnx_assessment_instances>(assessmentKeys.detail(instanceId), {
          ...cached,
          dnx_evidence_mapping: Object.keys(mapping).length
            ? JSON.stringify(mapping)
            : '',
        });
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
  /**
   * AI provenance (M6b). Present only when this write came from accepting an
   * AI-proposed answer. A manual edit afterwards passes nothing here, which
   * flips `dnx_manual_override` true and clears the AI flag so the badge
   * reflects that a human took over. Omit entirely for ordinary manual saves.
   */
  ai?: {
    confidence: number;
    sourceSummary: string;
    /** Application-details attribute paths this judgement used (provenance). */
    sourceAttributes?: string[];
  };
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
    case 4: {
      // Date — date-only (YYYY-MM-DD), see gotcha B. An empty / whitespace
      // string means the assessor cleared the picker; `Edm.Date` rejects '',
      // so send null to clear the column rather than an empty literal.
      const trimmed = typeof value === 'string' ? value.trim() : '';
      return {
        ...blank,
        dnx_response_date: trimmed ? trimmed.slice(0, 10) : null,
      } as Partial<Dnx_assessment_responsesBase>;
    }
  }
}

/**
 * AI provenance columns (M6b). When `ai` is present the write is an accepted
 * AI suggestion: flag it, store confidence + the model's rationale, and clear
 * the manual-override flag. When absent it's a plain manual save — explicitly
 * clear the AI flag and set manual_override so a later hand-edit of an
 * AI-populated answer correctly demotes the badge to "edited by assessor".
 */
function aiColumns(
  ai: UpsertResponseInput['ai'],
): Partial<Dnx_assessment_responsesBase> {
  if (ai) {
    return {
      dnx_ai_populated: true,
      dnx_manual_override: false,
      dnx_confidence_score: ai.confidence,
      dnx_ai_source_summary: ai.sourceSummary.slice(0, 2000),
      // JSON array of attribute paths used, or '' when the judgement was
      // evidence-only — cleared explicitly so a re-fill doesn't keep stale ones.
      dnx_ai_source_attributes:
        ai.sourceAttributes && ai.sourceAttributes.length
          ? JSON.stringify(ai.sourceAttributes)
          : '',
    } as Partial<Dnx_assessment_responsesBase>;
  }
  return {
    dnx_ai_populated: false,
    dnx_manual_override: true,
    dnx_ai_source_attributes: '',
  } as Partial<Dnx_assessment_responsesBase>;
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
      const columns = { ...responseColumns(input.dataType, input.value), ...aiColumns(input.ai) };

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
    // Fire-and-forget audit snapshot for the new version.
    void snapshotAssessment(qc, instanceId, next, 'Autosave');
  } catch (e) {
    console.warn('[bumpInstanceVersion] failed', e);
  }
}

/**
 * Snapshot the full assessment state into a new `dnx_assessment_versions` row.
 *
 * Two-call write pattern because `dnx_snapsho_tjson` is a Dataverse File-type
 * column (note the typo `snapsho_tjson` — that IS the actual schema name):
 *
 *   1. `Dnx_assessment_versionsService.create()` makes the row with the
 *      version number, change summary, and instance lookup.
 *   2. The SDK's `client.uploadFileToRecord()` then uploads the JSON payload
 *      to that row's `dnx_snapsho_tjson` column. Files in Dataverse can't be
 *      written via the normal create/update body.
 *
 * Always fire-and-forget — errors are logged but never thrown, because the
 * assessor's primary save has already succeeded. The audit trail being one
 * row behind is acceptable; an outright save failure isn't.
 *
 * Reads cache for the instance + responses. The just-saved response may not
 * be in cache yet (invalidation is async) so the snapshot will sometimes
 * lag by one save. Acceptable for audit purposes — the final snapshot at
 * submission time is the authoritative one.
 */
export type SnapshotReason =
  | 'Autosave'
  | 'Submitted'
  | 'Reopened'
  | 'Approved'
  | 'Rejected'
  | 'Reverted';

async function snapshotAssessment(
  qc: ReturnType<typeof useQueryClient>,
  instanceId: string,
  versionNumber: number,
  changeReason: SnapshotReason,
): Promise<void> {
  try {
    const instance = qc.getQueryData<Dnx_assessment_instances>(
      assessmentKeys.detail(instanceId),
    );
    if (!instance) return;
    const responses =
      qc.getQueryData<Dnx_assessment_responses[]>(
        assessmentKeys.responses(instanceId),
      ) ?? [];

    const snapshot = {
      capturedAt: new Date().toISOString(),
      reason: changeReason,
      version: versionNumber,
      instance: {
        id: instance.dnx_assessment_instanceid,
        name: instance.dnx_assessment_name,
        statuscode: instance.statuscode,
        outcome: instance.dnx_outcome ?? null,
        outcomeNotes: instance.dnx_outcome_notes ?? null,
        dueDate: instance.dnx_duedate ?? null,
        submittedOn: instance.dnx_submittedon ?? null,
        projectId: lookupId(instance, 'dnx_project') ?? null,
        templateId: lookupId(instance, 'dnx_assessmenttemplate') ?? null,
      },
      responses: responses.map((r) => ({
        levelId: lookupId(r, 'dnx_assessment_level') ?? null,
        questionName: r.dnx_name,
        boolean: r.dnx_response_boolean ?? null,
        option: r.dnx_response_option ?? null,
        multi: r.dnx_response_multi ?? null,
        text: r.dnx_response_text ?? null,
        date: r.dnx_response_date ?? null,
      })),
    };

    const versionRow = await Dnx_assessment_versionsService.create({
      dnx_version_number: String(versionNumber),
      dnx_change_summary: changeReason,
      'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
      statecode: 0,
      statuscode: 1,
    } as unknown as Omit<Dnx_assessment_versionsBase, 'dnx_assessment_versionid'>);

    if (!versionRow.success || !versionRow.data) {
      console.warn('[snapshot] version row create failed', versionRow.error);
      return;
    }

    const fileName = `snapshot-v${versionNumber}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-')}.json`;

    const client = getClient(dataSourcesInfo);
    const upload = await client.uploadFileToRecord(
      'dnx_assessment_versions',
      versionRow.data.dnx_assessment_versionid,
      'dnx_snapsho_tjson',
      fileName,
      JSON.stringify(snapshot),
    );
    if (!upload.success) {
      console.warn('[snapshot] file upload failed', upload.error);
    }
    // Refresh any open VersionHistoryDrawer for this instance. Fire-and-
    // forget invalidation — if the drawer isn't mounted, this is a noop.
    qc.invalidateQueries({ queryKey: assessmentKeys.versions(instanceId) });
  } catch (e) {
    console.warn('[snapshot] threw', e);
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
/**
 * Outcome enum on dnx_assessment_instances: 0 = Suitable, 1 = NotSuitable,
 * 2 = Pending. The picker on the reviewer Approve dialog uses the same
 * picklist; submit and reopen both write through it too.
 */
export const ASSESSMENT_OUTCOME = {
  Suitable: 0,
  NotSuitable: 1,
  Pending: 2,
} as const;
export type AssessmentOutcomeValue =
  (typeof ASSESSMENT_OUTCOME)[keyof typeof ASSESSMENT_OUTCOME];

export function useSubmitForReview(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    /**
     * Optional `outcome` lets the caller persist the assessor's pre-evaluation
     * verdict alongside the status flip. Pass 0 for Suitable, 1 for
     * NotSuitable, or omit (= Pending) when the rules don't yield a definitive
     * result yet. The reviewer can still override on Approve.
     */
    mutationFn: async (
      input?: { outcome?: AssessmentOutcomeValue },
    ): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;
      const changes: Record<string, unknown> = {
        statuscode: 778540003, // PendingReview
        dnx_submittedon: new Date().toISOString().slice(0, 10),
        dnx_version: nextVersion,
        dnx_outcome: input?.outcome ?? ASSESSMENT_OUTCOME.Pending,
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
      // Snapshot the submitted state — this becomes the canonical reviewer
      // record. Uses the post-update version that's already in `data`.
      void snapshotAssessment(qc, instanceId, data.dnx_version ?? 0, 'Submitted');
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
      // Clear the persisted outcome back to Pending — the assessor is taking
      // the work back, so any previously-submitted verdict is no longer
      // authoritative until they re-submit.
      const changes: Record<string, unknown> = {
        statuscode: 778540002, // InProgress
        dnx_version: nextVersion,
        dnx_outcome: ASSESSMENT_OUTCOME.Pending,
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
      // Snapshot the reopen event so the audit log records who pulled the
      // submission back and at what version.
      void snapshotAssessment(qc, instanceId, data.dnx_version ?? 0, 'Reopened');
    },
  });
}

/**
 * Reviewer action: approve a PendingReview assessment with a final outcome.
 *
 * Sets statuscode → Complete (778540004), assigns the chosen outcome
 * (0 Suitable / 1 NotSuitable), persists the reviewer's notes into
 * `dnx_outcome_notes`, and bumps version. A snapshot with reason "Approved"
 * captures the moment so a downstream audit view can show the reviewer's
 * sign-off state.
 *
 * Caller should confirm via dialog before invoking.
 *
 * NOTE: This action is currently visible to any signed-in user. Role-gating
 * (Reviewer / Admin only) is a follow-up — server-side enforcement via
 * Dataverse security roles is the real barrier.
 */
export function useApproveAssessment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      /** 0 = Suitable, 1 = NotSuitable */
      outcome: 0 | 1;
      notes?: string;
    }): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;
      const changes = {
        statuscode: 778540004, // Complete
        dnx_outcome: input.outcome,
        // Always overwrite — sending '' clears any stale rejection notes left
        // over from a previous Reject → Reopen → Approve cycle. Using
        // `undefined` here lets PATCH skip the field, so the old notes would
        // survive and the green "Approved" banner would render reject text.
        dnx_outcome_notes: input.notes?.trim() ?? '',
        dnx_version: nextVersion,
      };
      const r = await Dnx_assessment_instancesService.update(
        instanceId,
        changes as unknown as Partial<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>,
      );
      if (!r.success || !r.data) {
        console.error('[approve assessment] failed', r.error, changes);
        throw new Error(r.error?.message ?? 'Failed to approve');
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
      void snapshotAssessment(qc, instanceId, data.dnx_version ?? 0, 'Approved');
    },
  });
}

/**
 * Reviewer action: reject a PendingReview assessment with required notes.
 *
 * Sets statuscode → InProgress (778540002) so the assessor can pick it back
 * up; outcome stays Pending (no final determination has been made). The
 * rejection notes go into `dnx_outcome_notes` — the assessor sees these on
 * the instance page so they know what to fix. Bumps version and snapshots
 * with reason "Rejected".
 *
 * Notes are required at the call site (the dialog enforces it) so this
 * mutation does NOT validate — caller's responsibility.
 */
export function useRejectAssessment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { notes: string }): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;
      const changes = {
        statuscode: 778540002, // InProgress
        dnx_outcome_notes: input.notes.trim(),
        dnx_version: nextVersion,
      };
      const r = await Dnx_assessment_instancesService.update(
        instanceId,
        changes as unknown as Partial<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>,
      );
      if (!r.success || !r.data) {
        console.error('[reject assessment] failed', r.error, changes);
        throw new Error(r.error?.message ?? 'Failed to reject');
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
      void snapshotAssessment(qc, instanceId, data.dnx_version ?? 0, 'Rejected');
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Reviewer comments (per-level flags attached to an assessment instance)     */
/* -------------------------------------------------------------------------- */

/** All reviewer comments attached to this instance, oldest first. */
export function useReviewerComments(instanceId: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.comments(instanceId ?? ''),
    enabled: !!instanceId,
    queryFn: async (): Promise<Dnx_reviewer_comments[]> => {
      const r = await Dnx_reviewer_commentsService.getAll({
        filter: `_dnx_assessment_value eq ${instanceId}`,
        orderBy: ['createdon asc'],
        top: 500,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load comments');
      return r.data ?? [];
    },
  });
}

/** Mark a single flag as resolved (assessor has addressed it). */
export function useResolveReviewerComment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string): Promise<void> => {
      const r = await Dnx_reviewer_commentsService.update(commentId, {
        dnx_is_resolved: true,
      } as unknown as Partial<Omit<Dnx_reviewer_commentsBase, 'dnx_reviewer_commentid'>>);
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Failed to mark resolved');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.comments(instanceId) });
    },
  });
}

/** Delete a single reviewer flag (cleanup before re-submitting, etc.). */
export function useDeleteReviewerComment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string): Promise<void> => {
      await Dnx_reviewer_commentsService.delete(commentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.comments(instanceId) });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* General comments (instance-scoped, not tied to a question)                  */
/* -------------------------------------------------------------------------- */

/**
 * Add a comment to an assessment instance — either a new thread (parentId
 * omitted) or a reply (parentId points to an existing comment). General
 * comments are distinguished from per-question reviewer flags by NOT
 * binding `dnx_Assessment_Level`. The flag-render path filters by the
 * presence of a level lookup; this hook deliberately leaves it null.
 */
export function useAddComment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      text: string;
      parentCommentId?: string;
    }): Promise<void> => {
      const body: Record<string, unknown> = {
        // Primary name field — clamp the comment text into it so the row has
        // something searchable in the maker portal. Real text lives in
        // `dnx_comment_text`.
        dnx_name: input.text.slice(0, 100),
        dnx_comment_text: input.text,
        dnx_is_resolved: false,
        'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
        statecode: 0,
        statuscode: 1,
      };
      if (input.parentCommentId) {
        body['dnx_Parent_Comment@odata.bind'] = `/dnx_reviewer_comments(${input.parentCommentId})`;
      }
      const r = await Dnx_reviewer_commentsService.create(
        body as unknown as Omit<Dnx_reviewer_commentsBase, 'dnx_reviewer_commentid'>,
      );
      if (!r.success) {
        throw new Error(r.error?.message ?? 'Failed to add comment');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.comments(instanceId) });
    },
  });
}

/** Delete a general comment. Caller is responsible for cascading replies. */
export function useDeleteComment(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string): Promise<void> => {
      await Dnx_reviewer_commentsService.delete(commentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.comments(instanceId) });
    },
  });
}

/**
 * Create one reviewer-comment row per flagged level in a single fire.
 *
 * Used by the Reject dialog so the reviewer can pinpoint which questions
 * need fixing in the same submit. All creates fire in parallel because they
 * don't depend on each other; if any individual row create fails its error
 * is collected and the rest still go through.
 */
export function useCreateReviewerComments(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      flags: Array<{ levelId: string; levelName: string; commentText: string }>,
    ): Promise<void> => {
      if (flags.length === 0) return;
      const results = await Promise.allSettled(
        flags.map((f) =>
          Dnx_reviewer_commentsService.create({
            dnx_name: f.levelName.slice(0, 100), // primary name; clamp to safe length
            dnx_comment_text: f.commentText,
            dnx_is_resolved: false,
            'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
            'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${f.levelId})`,
            statecode: 0,
            statuscode: 1,
          } as unknown as Omit<Dnx_reviewer_commentsBase, 'dnx_reviewer_commentid'>),
        ),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn('[create flags] some failed', failures);
        // Throw the first error so the dialog surfaces something to the user.
        throw (failures[0] as PromiseRejectedResult).reason;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assessmentKeys.comments(instanceId) });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Version history (snapshots written by snapshotAssessment)                  */
/* -------------------------------------------------------------------------- */

/**
 * Every `dnx_assessment_versions` row attached to this instance, newest first.
 * The snapshot JSON itself lives in the `dnx_snapsho_tjson` file column —
 * not loaded by this query, fetch on demand via `downloadSnapshotFile`.
 */
export function useVersionHistory(instanceId: string | undefined) {
  return useQuery({
    queryKey: assessmentKeys.versions(instanceId ?? ''),
    enabled: !!instanceId,
    queryFn: async (): Promise<Dnx_assessment_versions[]> => {
      const r = await Dnx_assessment_versionsService.getAll({
        filter: `_dnx_assessment_value eq ${instanceId}`,
        orderBy: ['createdon desc'],
        top: 200,
      });
      if (!r.success) throw new Error(r.error?.message ?? 'Failed to load history');
      return r.data ?? [];
    },
  });
}

/**
 * Shape of the JSON written by `snapshotAssessment`. Kept here so consumers
 * (download, diff, future revert) share one source of truth.
 */
export interface AssessmentSnapshot {
  capturedAt: string;
  reason: string;
  version: number;
  instance: {
    id: string;
    name: string;
    statuscode?: number;
    outcome?: number | null;
    outcomeNotes?: string | null;
    dueDate?: string | null;
    submittedOn?: string | null;
    projectId?: string | null;
    templateId?: string | null;
  };
  responses: Array<{
    levelId: string | null;
    questionName?: string;
    boolean?: boolean | null;
    option?: string | null;
    multi?: string | null;
    text?: string | null;
    date?: string | null;
  }>;
}

/** Pull a snapshot row's file column as a `Uint8Array`. Shared internal step. */
async function fetchSnapshotBytes(versionRowId: string): Promise<Uint8Array> {
  const client = getClient(dataSourcesInfo);
  const r = await client.downloadFileFromRecord(
    'dnx_assessment_versions',
    versionRowId,
    'dnx_snapsho_tjson',
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? 'Failed to load snapshot');
  }
  // Clone into a fresh Uint8Array — some SDK return types tag the buffer as
  // SharedArrayBuffer-backed, which Blob's constructor refuses.
  return new Uint8Array(r.data);
}

/**
 * Download a snapshot's `dnx_snapsho_tjson` file and save it as a JSON file
 * via a synthesised anchor click. The SDK returns bytes; we wrap them in a
 * Blob so the browser handles the download dialog. Used by the history
 * drawer's per-row Download button.
 */
export async function downloadSnapshotFile(
  versionRowId: string,
  fileName: string,
): Promise<void> {
  const bytes = await fetchSnapshotBytes(versionRowId);
  // Cast to BlobPart — Uint8Array's buffer type narrows wider than DOM types
  // accept; runtime is unaffected, this is a TS-only widening.
  const blob = new Blob([bytes as BlobPart], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick — Safari needs the URL to outlive the click event.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetch + parse a snapshot's JSON for in-memory consumption (diff view). */
export async function fetchSnapshotJson(versionRowId: string): Promise<AssessmentSnapshot> {
  const bytes = await fetchSnapshotBytes(versionRowId);
  const text = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(text) as AssessmentSnapshot;
}

/* -------------------------------------------------------------------------- */
/* Revert to snapshot — full restore of instance fields + responses           */
/* -------------------------------------------------------------------------- */

/**
 * Replay a snapshot back onto the live instance.
 *
 * Restore steps, in order:
 *   1. Patch the instance row with the snapshot's `instance` fields
 *      (statuscode, outcome, outcomeNotes, dueDate, submittedOn, name).
 *      Version bumps by 1 — the revert is itself a state change.
 *   2. Reconcile responses against the snapshot:
 *        - update if the same level exists today
 *        - create if the snapshot has it but the instance doesn't
 *        - delete if today has it but the snapshot does not
 *   3. Snapshot the post-revert state with reason `'Reverted'` so the audit
 *      log records what was restored and at what version (fire-and-forget,
 *      matching the rest of the snapshot path).
 *
 * Caller is responsible for the destructive-action confirmation UX — this
 * mutation just does the writes.
 */
export function useRevertToVersion(instanceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      snapshot: AssessmentSnapshot,
    ): Promise<Dnx_assessment_instances> => {
      const cached = qc.getQueryData<Dnx_assessment_instances>(
        assessmentKeys.detail(instanceId),
      );
      const nextVersion = (cached?.dnx_version ?? 0) + 1;

      // --- Step 1: patch the instance row -----------------------------------
      const instanceChanges: Record<string, unknown> = {
        dnx_assessment_name: snapshot.instance.name,
        dnx_version: nextVersion,
        dnx_outcome:
          snapshot.instance.outcome === null || snapshot.instance.outcome === undefined
            ? ASSESSMENT_OUTCOME.Pending
            : snapshot.instance.outcome,
        dnx_outcome_notes: snapshot.instance.outcomeNotes ?? '',
        dnx_duedate: snapshot.instance.dueDate ?? null,
        dnx_submittedon: snapshot.instance.submittedOn ?? null,
      };
      if (snapshot.instance.statuscode !== undefined) {
        instanceChanges.statuscode = snapshot.instance.statuscode;
      }
      const patched = await Dnx_assessment_instancesService.update(
        instanceId,
        instanceChanges as unknown as Partial<
          Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>
        >,
      );
      if (!patched.success || !patched.data) {
        throw new Error(patched.error?.message ?? 'Failed to restore instance fields');
      }

      // --- Step 2: reconcile responses --------------------------------------
      // Refetch current responses so we don't operate on a stale cache.
      const currentReq = await Dnx_assessment_responsesService.getAll({
        filter: `_dnx_assessment_value eq ${instanceId}`,
        top: 500,
      });
      if (!currentReq.success) {
        throw new Error(
          currentReq.error?.message ?? 'Failed to load current responses for revert',
        );
      }
      const currentRows = currentReq.data ?? [];
      const currentByLevel = new Map<string, Dnx_assessment_responses>();
      for (const r of currentRows) {
        const lid = lookupId(r, 'dnx_assessment_level');
        if (lid) currentByLevel.set(lid, r);
      }

      const snapshotLevelIds = new Set<string>();

      // Updates + creates from the snapshot's response list. Sequential so a
      // single failure surfaces clearly; the volume is bounded by the
      // template question count (typically ≤ 200).
      for (const snap of snapshot.responses) {
        if (!snap.levelId) continue;
        snapshotLevelIds.add(snap.levelId);
        const columns = snapshotResponseToColumns(snap);
        const existing = currentByLevel.get(snap.levelId);
        if (existing) {
          const r = await Dnx_assessment_responsesService.update(
            existing.dnx_assessment_responseid,
            columns as Partial<
              Omit<Dnx_assessment_responsesBase, 'dnx_assessment_responseid'>
            >,
          );
          if (!r.success) {
            throw new Error(
              r.error?.message ?? 'Failed to restore a response during revert',
            );
          }
        } else {
          const record: Record<string, unknown> = {
            dnx_name: snap.questionName ?? 'Response',
            'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
            'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${snap.levelId})`,
            statecode: 0,
            statuscode: 1,
            ...columns,
          };
          const r = await Dnx_assessment_responsesService.create(
            record as unknown as Omit<
              Dnx_assessment_responsesBase,
              'dnx_assessment_responseid'
            >,
          );
          if (!r.success) {
            throw new Error(
              r.error?.message ?? 'Failed to restore a response during revert',
            );
          }
        }
      }

      // Deletes for responses that exist today but didn't at snapshot time.
      for (const [levelId, row] of currentByLevel.entries()) {
        if (snapshotLevelIds.has(levelId)) continue;
        await Dnx_assessment_responsesService.delete(row.dnx_assessment_responseid);
      }

      return patched.data;
    },
    onSuccess: (data) => {
      // Push the patched instance into the cache so the AssessmentPage hero
      // updates without waiting for the refetch.
      qc.setQueryData(assessmentKeys.detail(instanceId), data);
      qc.invalidateQueries({ queryKey: assessmentKeys.list() });
      qc.invalidateQueries({ queryKey: assessmentKeys.responses(instanceId) });
      qc.invalidateQueries({ queryKey: assessmentKeys.versions(instanceId) });
      const projectId = (data as unknown as Record<string, unknown>)
        ._dnx_project_value as string | undefined;
      if (projectId) {
        qc.invalidateQueries({ queryKey: assessmentKeys.byProject(projectId) });
      }
      // Audit snapshot for the revert event itself. Fire-and-forget so a
      // snapshot failure can't undo the successful restore.
      void snapshotAssessment(qc, instanceId, data.dnx_version ?? 0, 'Reverted');
    },
  });
}

/**
 * Turn a serialised snapshot response into the per-column write payload.
 * Inverse of the projection inside `snapshotAssessment`; lives next to that
 * function so both stay in sync if either side adds a column.
 */
function snapshotResponseToColumns(
  snap: AssessmentSnapshot['responses'][number],
): Partial<Dnx_assessment_responsesBase> {
  return {
    dnx_response_boolean: snap.boolean ?? undefined,
    dnx_response_option: snap.option ?? undefined,
    dnx_response_multi: snap.multi ?? undefined,
    dnx_response_text: snap.text ?? undefined,
    dnx_response_date: snap.date ? snap.date.slice(0, 10) : undefined,
  };
}
