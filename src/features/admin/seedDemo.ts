import { Dnx_projectsService } from '../../generated/services/Dnx_projectsService';
import { Dnx_assessment_templatesService } from '../../generated/services/Dnx_assessment_templatesService';
import { Dnx_assessment_levelsService } from '../../generated/services/Dnx_assessment_levelsService';
import { Dnx_evaluationcriteriasService } from '../../generated/services/Dnx_evaluationcriteriasService';
import { Dnx_assessment_instancesService } from '../../generated/services/Dnx_assessment_instancesService';
import { Dnx_assessment_responsesService } from '../../generated/services/Dnx_assessment_responsesService';
import { Dnx_reviewer_commentsService } from '../../generated/services/Dnx_reviewer_commentsService';
import type { Dnx_projectsBase } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_assessment_templatesBase } from '../../generated/models/Dnx_assessment_templatesModel';
import type { Dnx_assessment_levelsBase } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_evaluationcriteriasBase } from '../../generated/models/Dnx_evaluationcriteriasModel';
import type { Dnx_assessment_instancesBase } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_responsesBase } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_reviewer_commentsBase } from '../../generated/models/Dnx_reviewer_commentsModel';

/**
 * End-to-end demo data seeder.
 *
 * Creates one Project, one rich Template (Sections / Subsections / Questions
 * with criteria at every cascade tier — Question / Subsection-threshold /
 * Section-Every-child / Assessment-root + Grouped + per-question Importance),
 * and three Assessments at varied states (Draft, InProgress with answers +
 * reviewer flag, Complete + Suitable).
 *
 * Strictly sequential — each step depends on IDs returned by the previous
 * one. Progress is reported via `onProgress` so the UI can render a live log.
 * Idempotency is NOT guaranteed — re-running creates a fresh second copy.
 */

export type StepStatus = 'pending' | 'done' | 'error';
export interface SeedStep {
  key: string;
  label: string;
  status: StepStatus;
  message?: string;
}

type ProgressFn = (steps: SeedStep[]) => void;

export interface SeedResult {
  projectId: string;
  templateId: string;
  instanceIds: string[];
}

/** Helper for casting create payloads through unknown (matches feature pattern). */
function cast<T>(value: unknown): T {
  return value as T;
}

// Picklist constants (mirror the IDs sprinkled across the app — kept local
// here so the seed file doesn't reach across feature folders).
const LEVEL_TYPE = { Root: 0, Section: 1, Subsection: 2, Question: 3 } as const;
const DATA_TYPE = {
  Boolean: 0,
  OptionSetSingle: 1,
  Multiselect: 2,
  Text: 3,
  Date: 4,
} as const;
const STATUS_INSTANCE = {
  Draft: 778540001,
  InProgress: 778540002,
  PendingReview: 778540003,
  Complete: 778540004,
} as const;
const STATUS_TEMPLATE = {
  Draft: 778540001,
  Published: 778540002,
  Deprecated: 778540003,
} as const;
const OPERATOR = {
  Equals: 0,
  GreaterThan: 1,
  LessThan: 2,
  Contains: 3,
  IsTrue: 4,
  IsFalse: 5,
} as const;
const OUTCOME_PASS = { Met: 0, Suitable: 1, Pass: 2 } as const;
const OUTCOME_FAIL = { NotMet: 0, NotSuitable: 1, Fail: 2 } as const;
const SCORING_TYPE = { Weighted: 0, Grouped: 1, Boolean: 2 } as const;
const SOURCE_TYPE = {
  QuestionValue: 0,
  SubsectionOutcome: 1,
  SectionOutcome: 2,
} as const;
const OUTCOME_INSTANCE = { Suitable: 0, NotSuitable: 1, Pending: 2 } as const;

async function createProject(): Promise<string> {
  const r = await Dnx_projectsService.create(
    cast<Omit<Dnx_projectsBase, 'dnx_projectid'>>({
      dnx_project_name: 'RPL — Carpentry Cert III (Demo)',
      dnx_project_code: 'DEMO-RPL-001',
      dnx_description:
        'Recognition of Prior Learning intake for Certificate III in Carpentry. Seed data for showcasing the assessment module.',
      statecode: 0,
      statuscode: 1,
    }),
  );
  if (!r.success || !r.data) throw new Error(r.error?.message ?? 'Failed to create project');
  return r.data.dnx_projectid;
}

async function createTemplate(): Promise<string> {
  const r = await Dnx_assessment_templatesService.create(
    cast<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>({
      dnx_template_name: 'Carpentry Certificate III RPL — 2026 (Demo)',
      dnx_description:
        'Two sections + subsections demonstrating question rules, subsection threshold, section Every-child, grouped scoring, and the assessment-level outcome rule.',
      dnx_template_version: 1,
      statecode: 0,
      statuscode: STATUS_TEMPLATE.Published,
    }),
  );
  if (!r.success || !r.data) throw new Error(r.error?.message ?? 'Failed to create template');
  return r.data.dnx_assessment_templateid;
}

interface CreateLevelOpts {
  templateId: string;
  name: string;
  type: number;
  order: number;
  parentLevelId?: string;
  dataType?: number;
  hintText?: string;
  isRequired?: boolean;
  includeInLetter?: boolean;
  optionSetReference?: string;
}

async function createLevel(opts: CreateLevelOpts): Promise<string> {
  const record: Record<string, unknown> = {
    dnx_name: opts.name,
    dnx_assessment_level_type: opts.type,
    dnx_assessment_level_order: opts.order,
    'dnx_Assessment_Template@odata.bind': `/dnx_assessment_templates(${opts.templateId})`,
  };
  if (opts.parentLevelId) {
    record['dnx_Parent_Assessment_Level@odata.bind'] = `/dnx_assessment_levels(${opts.parentLevelId})`;
  }
  if (opts.dataType !== undefined) record.dnx_data_type = opts.dataType;
  if (opts.hintText) record.dnx_hint_text = opts.hintText;
  if (opts.isRequired) record.dnx_is_required = true;
  if (opts.includeInLetter) record.dnx_include_in_letter = true;
  if (opts.optionSetReference) record.dnx_option_set_reference = opts.optionSetReference;

  const r = await Dnx_assessment_levelsService.create(
    cast<Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>>(record),
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? `Failed to create level "${opts.name}"`);
  }
  return r.data.dnx_assessment_levelid;
}

interface CreateCriteriaOpts {
  levelId: string;
  name: string;
  operator?: number;
  targetValue?: string;
  scoringType: number;
  sourceType: number;
  passThreshold?: number; // 0..1
  weight?: number;
}

async function createCriteria(opts: CreateCriteriaOpts): Promise<string> {
  const record: Record<string, unknown> = {
    dnx_criteria_name: opts.name,
    dnx_operator: opts.operator ?? OPERATOR.Equals,
    dnx_target_value: opts.targetValue ?? '',
    dnx_outcome_if_pass: OUTCOME_PASS.Suitable,
    dnx_outcome_if_fail: OUTCOME_FAIL.NotSuitable,
    dnx_scoring_type: opts.scoringType,
    dnx_source_type: opts.sourceType,
    dnx_pass_threshold: opts.passThreshold ?? 1,
    dnx_weight: opts.weight ?? 1,
    'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${opts.levelId})`,
    'dnx_Source_Assessment_Level@odata.bind': `/dnx_assessment_levels(${opts.levelId})`,
    statecode: 0,
    statuscode: 1,
  };
  const r = await Dnx_evaluationcriteriasService.create(
    cast<Omit<Dnx_evaluationcriteriasBase, 'dnx_evaluationcriteriaid'>>(record),
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? `Failed to create criteria "${opts.name}"`);
  }
  return r.data.dnx_evaluationcriteriaid;
}

interface CreateInstanceOpts {
  projectId: string;
  templateId: string;
  name: string;
  statuscode: number;
  outcome?: number;
  outcomeNotes?: string;
  submittedOn?: string; // YYYY-MM-DD
  version?: number;
  dueDate?: string; // YYYY-MM-DD
}

async function createInstance(opts: CreateInstanceOpts): Promise<string> {
  const record: Record<string, unknown> = {
    dnx_assessment_name: opts.name,
    'dnx_Project@odata.bind': `/dnx_projects(${opts.projectId})`,
    'dnx_AssessmentTemplate@odata.bind': `/dnx_assessment_templates(${opts.templateId})`,
    statecode: 0,
    statuscode: opts.statuscode,
    dnx_version: opts.version ?? 1,
    dnx_outcome: opts.outcome ?? OUTCOME_INSTANCE.Pending,
  };
  if (opts.outcomeNotes) record.dnx_outcome_notes = opts.outcomeNotes;
  if (opts.submittedOn) record.dnx_submittedon = opts.submittedOn;
  if (opts.dueDate) record.dnx_duedate = opts.dueDate;

  const r = await Dnx_assessment_instancesService.create(
    cast<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>(record),
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? `Failed to create instance "${opts.name}"`);
  }
  return r.data.dnx_assessment_instanceid;
}

interface CreateResponseOpts {
  instanceId: string;
  levelId: string;
  questionName: string;
  dataType: number;
  value: boolean | string | string[] | null;
}

async function createResponse(opts: CreateResponseOpts): Promise<void> {
  const record: Record<string, unknown> = {
    dnx_name: opts.questionName,
    'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${opts.instanceId})`,
    'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${opts.levelId})`,
    statecode: 0,
    statuscode: 1,
  };
  switch (opts.dataType) {
    case DATA_TYPE.Boolean:
      if (typeof opts.value === 'boolean') record.dnx_response_boolean = opts.value;
      break;
    case DATA_TYPE.OptionSetSingle:
      if (typeof opts.value === 'string') record.dnx_response_option = opts.value;
      break;
    case DATA_TYPE.Multiselect:
      record.dnx_response_multi = JSON.stringify(
        Array.isArray(opts.value) ? opts.value : [],
      );
      break;
    case DATA_TYPE.Text:
      if (typeof opts.value === 'string') record.dnx_response_text = opts.value;
      break;
    case DATA_TYPE.Date:
      if (typeof opts.value === 'string') record.dnx_response_date = opts.value.slice(0, 10);
      break;
  }
  const r = await Dnx_assessment_responsesService.create(
    cast<Omit<Dnx_assessment_responsesBase, 'dnx_assessment_responseid'>>(record),
  );
  if (!r.success) {
    throw new Error(r.error?.message ?? `Failed to create response for "${opts.questionName}"`);
  }
}

interface CreateCommentOpts {
  instanceId: string;
  /** When set, the row renders as an inline per-question reviewer flag (gated by
   *  CommentsDrawer's level-presence filter). Leave undefined for a general
   *  thread that shows up in the drawer. */
  levelId?: string;
  /** Parent thread id for a reply. Top-level comments leave this undefined. */
  parentCommentId?: string;
  name: string;
  text: string;
}

async function createReviewerComment(opts: CreateCommentOpts): Promise<string> {
  const record: Record<string, unknown> = {
    dnx_name: opts.name.slice(0, 100),
    dnx_comment_text: opts.text,
    dnx_is_resolved: false,
    'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${opts.instanceId})`,
    statecode: 0,
    statuscode: 1,
  };
  if (opts.levelId) {
    record['dnx_Assessment_Level@odata.bind'] = `/dnx_assessment_levels(${opts.levelId})`;
  }
  if (opts.parentCommentId) {
    record['dnx_Parent_Comment@odata.bind'] = `/dnx_reviewer_comments(${opts.parentCommentId})`;
  }
  const r = await Dnx_reviewer_commentsService.create(
    cast<Omit<Dnx_reviewer_commentsBase, 'dnx_reviewer_commentid'>>(record),
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? 'Failed to create reviewer comment');
  }
  return r.data.dnx_reviewer_commentid;
}

/**
 * Build the in-band tag token used by the CommentsDrawer to surface a
 * question reference. Kept inline here so the seed file doesn't need to
 * reach into the assessments feature folder for one helper.
 */
function withTag(levelId: string, name: string, body: string): string {
  const safe = name.replace(/]/g, '\\]').replace(/\|/g, '\\|');
  return `[Q:${levelId}|${safe}] ${body}`;
}

/**
 * Run the full seed, reporting progress via `onProgress` after each step
 * transitions. Returns the top-level IDs so callers can deep-link the user
 * straight to the demo instance afterwards.
 */
export async function seedDemo(onProgress: ProgressFn): Promise<SeedResult> {
  const steps: SeedStep[] = [
    { key: 'project', label: 'Create demo project', status: 'pending' },
    { key: 'template', label: 'Create demo template', status: 'pending' },
    { key: 'levels', label: 'Build sections / subsections / questions', status: 'pending' },
    { key: 'criteria', label: 'Author evaluation rules at every tier', status: 'pending' },
    { key: 'instance-draft', label: 'Create Draft assessment', status: 'pending' },
    {
      key: 'instance-inprogress',
      label: 'Create InProgress assessment + responses + reviewer flag',
      status: 'pending',
    },
    {
      key: 'instance-complete',
      label: 'Create Complete + Suitable assessment',
      status: 'pending',
    },
    {
      key: 'comments',
      label: 'Seed general comment threads (with one tagged question)',
      status: 'pending',
    },
  ];
  const update = (key: string, patch: Partial<SeedStep>) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) {
      steps[idx] = { ...steps[idx], ...patch };
      onProgress([...steps]);
    }
  };
  onProgress([...steps]);

  // --- Project + template ----------------------------------------------------
  const projectId = await createProject();
  update('project', { status: 'done', message: projectId });

  const templateId = await createTemplate();
  update('template', { status: 'done', message: templateId });

  // --- Level tree -----------------------------------------------------------
  // Root carries the assessment-level criteria (hidden — see context.md gotcha Q).
  const rootId = await createLevel({
    templateId,
    name: '_root_',
    type: LEVEL_TYPE.Root,
    order: -1,
  });

  // Section 1 — Identity & eligibility ---------------------------------------
  const sec1Id = await createLevel({
    templateId,
    name: 'Identity & eligibility',
    type: LEVEL_TYPE.Section,
    order: 0,
  });
  const qFullNameId = await createLevel({
    templateId,
    name: 'Full name',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: sec1Id,
    dataType: DATA_TYPE.Text,
    isRequired: true,
    includeInLetter: true,
  });
  const qDOBId = await createLevel({
    templateId,
    name: 'Date of birth',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: sec1Id,
    dataType: DATA_TYPE.Date,
    isRequired: true,
  });
  const qIdTypeId = await createLevel({
    templateId,
    name: 'ID document type',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: sec1Id,
    dataType: DATA_TYPE.OptionSetSingle,
    isRequired: true,
    includeInLetter: true,
    optionSetReference: JSON.stringify(['Passport', 'Driver Licence', 'National ID']),
  });
  const qIdValidId = await createLevel({
    templateId,
    name: 'ID number valid?',
    type: LEVEL_TYPE.Question,
    order: 3,
    parentLevelId: sec1Id,
    dataType: DATA_TYPE.Boolean,
    isRequired: true,
    hintText: 'Verified against the issuing authority.',
  });

  // Section 2 — Qualifications & experience ----------------------------------
  const sec2Id = await createLevel({
    templateId,
    name: 'Qualifications & experience',
    type: LEVEL_TYPE.Section,
    order: 1,
  });

  // Subsection: Prior qualifications
  const subPriorId = await createLevel({
    templateId,
    name: 'Prior qualifications',
    type: LEVEL_TYPE.Subsection,
    order: 0,
    parentLevelId: sec2Id,
  });
  const qCertIIId = await createLevel({
    templateId,
    name: 'Has Certificate II Construction?',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: subPriorId,
    dataType: DATA_TYPE.Boolean,
  });
  const qWhiteCardId = await createLevel({
    templateId,
    name: 'Has White Card?',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: subPriorId,
    dataType: DATA_TYPE.Boolean,
  });
  const qFirstAidId = await createLevel({
    templateId,
    name: 'Has First Aid certificate?',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: subPriorId,
    dataType: DATA_TYPE.Boolean,
  });

  // Subsection: Work experience
  const subWorkId = await createLevel({
    templateId,
    name: 'Work experience',
    type: LEVEL_TYPE.Subsection,
    order: 1,
    parentLevelId: sec2Id,
  });
  const qYearsId = await createLevel({
    templateId,
    name: 'Years of carpentry experience',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: subWorkId,
    dataType: DATA_TYPE.OptionSetSingle,
    isRequired: true,
    includeInLetter: true,
    optionSetReference: JSON.stringify(['<2 years', '2-5 years', '5+ years']),
  });
  const qRefId = await createLevel({
    templateId,
    name: 'Has supervisor reference?',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: subWorkId,
    dataType: DATA_TYPE.Boolean,
  });
  const qPortfolioId = await createLevel({
    templateId,
    name: 'Has portfolio submitted?',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: subWorkId,
    dataType: DATA_TYPE.Boolean,
  });

  update('levels', { status: 'done' });

  // --- Criteria -------------------------------------------------------------
  // Question rules
  await createCriteria({
    levelId: qIdValidId,
    name: 'ID valid rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
    weight: 1,
  });
  // Cert II carries higher importance — demonstrates the amber ×2 badge.
  await createCriteria({
    levelId: qCertIIId,
    name: 'Cert II rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
    weight: 2,
  });
  await createCriteria({
    levelId: qWhiteCardId,
    name: 'White Card rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: qFirstAidId,
    name: 'First Aid rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: qYearsId,
    name: 'Years of experience rule',
    operator: OPERATOR.Equals,
    targetValue: '5+ years',
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: qRefId,
    name: 'Reference rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: qPortfolioId,
    name: 'Portfolio rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });

  // Subsection rules
  // Prior qualifications — Weighted, at least 50% must pass (Cert II ×2 weight tilts this)
  await createCriteria({
    levelId: subPriorId,
    name: 'Prior qualifications roll-up',
    scoringType: SCORING_TYPE.Weighted,
    sourceType: SOURCE_TYPE.SubsectionOutcome,
    passThreshold: 0.5,
  });
  // Work experience — Grouped: a "Verification" group requires 1 of 2 from {ref, portfolio}
  await createCriteria({
    levelId: subWorkId,
    name: 'Work experience roll-up',
    scoringType: SCORING_TYPE.Grouped,
    sourceType: SOURCE_TYPE.SubsectionOutcome,
    targetValue: JSON.stringify([
      {
        name: 'Verification',
        minToPass: 1,
        memberLevelIds: [qRefId, qPortfolioId],
      },
    ]),
  });

  // Section rules
  await createCriteria({
    levelId: sec2Id,
    name: 'Qualifications & experience roll-up',
    scoringType: SCORING_TYPE.Boolean, // Every subsection must pass
    sourceType: SOURCE_TYPE.SectionOutcome,
  });

  // Assessment-level rule (binds to root)
  await createCriteria({
    levelId: rootId,
    name: 'Assessment outcome rule',
    scoringType: SCORING_TYPE.Boolean, // Every section must pass
    sourceType: SOURCE_TYPE.SectionOutcome,
  });

  update('criteria', { status: 'done' });

  // --- Assessment instances -------------------------------------------------
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const dueIn30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  // 1) Draft — empty, just opened
  const draftId = await createInstance({
    projectId,
    templateId,
    name: 'Demo — Jane Doe (Draft)',
    statuscode: STATUS_INSTANCE.Draft,
    version: 1,
    dueDate: dueIn30,
  });
  update('instance-draft', { status: 'done', message: draftId });

  // 2) InProgress — partially filled, one reviewer flag pending
  const inProgId = await createInstance({
    projectId,
    templateId,
    name: 'Demo — Maria Garcia (In progress)',
    statuscode: STATUS_INSTANCE.InProgress,
    version: 4,
    dueDate: dueIn30,
  });
  // Identity section — fully answered
  await createResponse({
    instanceId: inProgId,
    levelId: qFullNameId,
    questionName: 'Full name',
    dataType: DATA_TYPE.Text,
    value: 'Maria Garcia',
  });
  await createResponse({
    instanceId: inProgId,
    levelId: qDOBId,
    questionName: 'Date of birth',
    dataType: DATA_TYPE.Date,
    value: '1992-04-18',
  });
  await createResponse({
    instanceId: inProgId,
    levelId: qIdTypeId,
    questionName: 'ID document type',
    dataType: DATA_TYPE.OptionSetSingle,
    value: 'Passport',
  });
  await createResponse({
    instanceId: inProgId,
    levelId: qIdValidId,
    questionName: 'ID number valid?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  // Qualifications — partial
  await createResponse({
    instanceId: inProgId,
    levelId: qCertIIId,
    questionName: 'Has Certificate II Construction?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: inProgId,
    levelId: qWhiteCardId,
    questionName: 'Has White Card?',
    dataType: DATA_TYPE.Boolean,
    value: false,
  });
  await createResponse({
    instanceId: inProgId,
    levelId: qFirstAidId,
    questionName: 'Has First Aid certificate?',
    dataType: DATA_TYPE.Boolean,
    value: false,
  });
  // Work experience — leaves the required Years question unanswered so Submit
  // dialog has something to surface. Reference + portfolio filled.
  await createResponse({
    instanceId: inProgId,
    levelId: qRefId,
    questionName: 'Has supervisor reference?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  // One open reviewer flag on the unanswered Years question
  await createReviewerComment({
    instanceId: inProgId,
    levelId: qYearsId,
    name: 'Years of carpentry experience',
    text: 'Candidate needs to provide a precise count — earlier conversation suggested it might be exactly at the 5-year boundary.',
  });
  update('instance-inprogress', { status: 'done', message: inProgId });

  // 3) Complete + Suitable — every answer passing, with reviewer notes
  const completeId = await createInstance({
    projectId,
    templateId,
    name: 'Demo — John Smith (Complete · Suitable)',
    statuscode: STATUS_INSTANCE.Complete,
    outcome: OUTCOME_INSTANCE.Suitable,
    outcomeNotes:
      'All criteria met. Strong portfolio + 8 years of experience documented. Recommended for certification.',
    submittedOn: yesterday,
    version: 12,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qFullNameId,
    questionName: 'Full name',
    dataType: DATA_TYPE.Text,
    value: 'John Smith',
  });
  await createResponse({
    instanceId: completeId,
    levelId: qDOBId,
    questionName: 'Date of birth',
    dataType: DATA_TYPE.Date,
    value: '1985-09-03',
  });
  await createResponse({
    instanceId: completeId,
    levelId: qIdTypeId,
    questionName: 'ID document type',
    dataType: DATA_TYPE.OptionSetSingle,
    value: 'Driver Licence',
  });
  await createResponse({
    instanceId: completeId,
    levelId: qIdValidId,
    questionName: 'ID number valid?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qCertIIId,
    questionName: 'Has Certificate II Construction?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qWhiteCardId,
    questionName: 'Has White Card?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qFirstAidId,
    questionName: 'Has First Aid certificate?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qYearsId,
    questionName: 'Years of carpentry experience',
    dataType: DATA_TYPE.OptionSetSingle,
    value: '5+ years',
  });
  await createResponse({
    instanceId: completeId,
    levelId: qRefId,
    questionName: 'Has supervisor reference?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  await createResponse({
    instanceId: completeId,
    levelId: qPortfolioId,
    questionName: 'Has portfolio submitted?',
    dataType: DATA_TYPE.Boolean,
    value: true,
  });
  update('instance-complete', { status: 'done', message: completeId });

  // --- General comment threads (visible in the Comments drawer) -------------
  // InProgress instance: one tagged thread (question reference chip) with a
  // reply, plus a plain top-level comment. Mirrors what an assessor + reviewer
  // would build up during a real review cycle.
  const thread1Id = await createReviewerComment({
    instanceId: inProgId,
    name: 'Need to confirm experience claim',
    text: withTag(
      qYearsId,
      'Years of carpentry experience',
      'Candidate said over the phone they have ~5 years, but I want a confirmed count before signing this off. Can we get a CV update?',
    ),
  });
  await createReviewerComment({
    instanceId: inProgId,
    parentCommentId: thread1Id,
    name: 'Re: experience claim',
    text: 'CV requested by email this morning — expecting it back tomorrow. Will update the answer once it lands.',
  });
  await createReviewerComment({
    instanceId: inProgId,
    name: 'General note — White Card',
    text: 'White Card expired last year per the database lookup. They mentioned renewal is in progress; not a blocker for the rest of the review.',
  });

  // Complete instance: short summary comment from the reviewer for context.
  await createReviewerComment({
    instanceId: completeId,
    name: 'Approval summary',
    text: 'Approved after reviewing the portfolio. All criteria comfortably met. Filed for certification.',
  });
  update('comments', { status: 'done' });

  return {
    projectId,
    templateId,
    instanceIds: [draftId, inProgId, completeId],
  };
}
