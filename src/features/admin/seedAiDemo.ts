import { Dnx_projectsService } from '../../generated/services/Dnx_projectsService';
import { Dnx_assessment_templatesService } from '../../generated/services/Dnx_assessment_templatesService';
import { Dnx_assessment_levelsService } from '../../generated/services/Dnx_assessment_levelsService';
import { Dnx_evaluationcriteriasService } from '../../generated/services/Dnx_evaluationcriteriasService';
import { Dnx_assessment_instancesService } from '../../generated/services/Dnx_assessment_instancesService';
import type { Dnx_projectsBase } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_assessment_templatesBase } from '../../generated/models/Dnx_assessment_templatesModel';
import type { Dnx_assessment_levelsBase } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_evaluationcriteriasBase } from '../../generated/models/Dnx_evaluationcriteriasModel';
import type { Dnx_assessment_instancesBase } from '../../generated/models/Dnx_assessment_instancesModel';
import type { SeedStep } from './seedDemo';

/**
 * AI auto-fill demo seeder (M6b showcase).
 *
 * Builds a small, purpose-shaped dataset for demoing the AI feature end to end:
 *   - one Project,
 *   - one Template whose questions each carry an **evidence binding**
 *     (file variable + extraction query) authored in the AI conditioning tab,
 *   - one **blank InProgress assessment** so auto-fill has open questions to fill.
 *
 * The file variables here (`candidate-resume`, `academic-transcript`,
 * `id-document`) match the filenames in the repo's `demo-files/` folder — the
 * presenter uploads those to the assessment's SharePoint folder, then runs
 * AI auto-fill and maps each variable to its uploaded file.
 *
 * Deliberately leaner than the full `seedDemo`: no multi-state instances, no
 * comments, minimal rules — the star here is the binding → mapping → suggestion
 * flow, not the scoring cascade.
 *
 * Strictly sequential; progress reported via `onProgress`. Not idempotent —
 * re-running creates a fresh copy.
 */

export type { SeedStep, StepStatus } from './seedDemo';

type ProgressFn = (steps: SeedStep[]) => void;

export interface AiSeedResult {
  projectId: string;
  templateId: string;
  instanceId: string;
  /** Echo of the file variables so the UI can remind the presenter what to upload. */
  fileVariables: string[];
}

function cast<T>(value: unknown): T {
  return value as T;
}

const LEVEL_TYPE = { Root: 0, Section: 1, Subsection: 2, Question: 3 } as const;
const DATA_TYPE = {
  Boolean: 0,
  OptionSetSingle: 1,
  Multiselect: 2,
  Text: 3,
  Date: 4,
} as const;
const STATUS_INSTANCE = { InProgress: 778540002 } as const;
const STATUS_TEMPLATE = { Published: 778540002 } as const;
const OPERATOR = { Equals: 0, IsTrue: 4 } as const;
const OUTCOME_PASS = { Suitable: 1 } as const;
const OUTCOME_FAIL = { NotSuitable: 1 } as const;
const SCORING_TYPE = { Weighted: 0, Boolean: 2 } as const;
const SOURCE_TYPE = {
  QuestionValue: 0,
  SubsectionOutcome: 1,
  SectionOutcome: 2,
} as const;
const OUTCOME_INSTANCE = { Pending: 2 } as const;

/** The file variables the template's questions are bound to. Keep in sync with
 *  the filenames under `demo-files/`. */
export const AI_DEMO_FILE_VARIABLES = [
  'id-document',
  'academic-transcript',
  'candidate-resume',
] as const;

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
  /** Serialised `{ fileVariable, query }` JSON → dnx_document_type_reference. */
  evidenceBinding?: { fileVariable: string; query: string };
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
  // The evidence binding lives in the same column the AI conditioning tab uses
  // (see context.md gotcha V).
  if (opts.evidenceBinding) {
    record.dnx_document_type_reference = JSON.stringify(opts.evidenceBinding);
  }

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
  passThreshold?: number;
}

async function createCriteria(opts: CreateCriteriaOpts): Promise<void> {
  const record: Record<string, unknown> = {
    dnx_criteria_name: opts.name,
    dnx_operator: opts.operator ?? OPERATOR.Equals,
    dnx_target_value: opts.targetValue ?? '',
    dnx_outcome_if_pass: OUTCOME_PASS.Suitable,
    dnx_outcome_if_fail: OUTCOME_FAIL.NotSuitable,
    dnx_scoring_type: opts.scoringType,
    dnx_source_type: opts.sourceType,
    dnx_pass_threshold: opts.passThreshold ?? 1,
    dnx_weight: 1,
    'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${opts.levelId})`,
    'dnx_Source_Assessment_Level@odata.bind': `/dnx_assessment_levels(${opts.levelId})`,
    statecode: 0,
    statuscode: 1,
  };
  const r = await Dnx_evaluationcriteriasService.create(
    cast<Omit<Dnx_evaluationcriteriasBase, 'dnx_evaluationcriteriaid'>>(record),
  );
  if (!r.success) {
    throw new Error(r.error?.message ?? `Failed to create criteria "${opts.name}"`);
  }
}

export async function seedAiDemo(onProgress: ProgressFn): Promise<AiSeedResult> {
  const steps: SeedStep[] = [
    { key: 'project', label: 'Create AI demo project', status: 'pending' },
    { key: 'template', label: 'Create AI demo template', status: 'pending' },
    {
      key: 'levels',
      label: 'Build questions with evidence bindings (file variable + query)',
      status: 'pending',
    },
    { key: 'criteria', label: 'Author a light rule set', status: 'pending' },
    {
      key: 'instance',
      label: 'Create a blank In-progress assessment to auto-fill',
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

  // --- Project + template ---------------------------------------------------
  const projectR = await Dnx_projectsService.create(
    cast<Omit<Dnx_projectsBase, 'dnx_projectid'>>({
      dnx_project_name: 'RPL — AI Auto-fill (Demo)',
      dnx_project_code: 'DEMO-AI-001',
      dnx_description:
        'Showcase project for the AI auto-fill feature. Questions are bound to evidence file variables; upload the demo files and let the assistant draft the answers.',
      statecode: 0,
      statuscode: 1,
    }),
  );
  if (!projectR.success || !projectR.data) {
    throw new Error(projectR.error?.message ?? 'Failed to create project');
  }
  const projectId = projectR.data.dnx_projectid;
  update('project', { status: 'done', message: projectId });

  const templateR = await Dnx_assessment_templatesService.create(
    cast<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>({
      dnx_template_name: 'Software Engineer RPL — AI Demo',
      dnx_description:
        'Every question carries an AI evidence binding (file variable + extraction query). Demonstrates assessment-time file mapping + batched AI auto-fill.',
      dnx_template_version: 1,
      statecode: 0,
      statuscode: STATUS_TEMPLATE.Published,
    }),
  );
  if (!templateR.success || !templateR.data) {
    throw new Error(templateR.error?.message ?? 'Failed to create template');
  }
  const templateId = templateR.data.dnx_assessment_templateid;
  update('template', { status: 'done', message: templateId });

  // --- Level tree -----------------------------------------------------------
  const rootId = await createLevel({
    templateId,
    name: '_root_',
    type: LEVEL_TYPE.Root,
    order: -1,
  });

  // Section 1 — Identity (bound to id-document)
  const secIdentity = await createLevel({
    templateId,
    name: 'Identity',
    type: LEVEL_TYPE.Section,
    order: 0,
  });
  const qFullName = await createLevel({
    templateId,
    name: 'Full name',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: secIdentity,
    dataType: DATA_TYPE.Text,
    includeInLetter: true,
    evidenceBinding: {
      fileVariable: 'id-document',
      query: "Extract the person's full legal name exactly as printed.",
    },
  });
  const qDob = await createLevel({
    templateId,
    name: 'Date of birth',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: secIdentity,
    dataType: DATA_TYPE.Date,
    evidenceBinding: {
      fileVariable: 'id-document',
      query: 'Extract the date of birth and return it as YYYY-MM-DD.',
    },
  });
  const qIdType = await createLevel({
    templateId,
    name: 'ID document type',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: secIdentity,
    dataType: DATA_TYPE.OptionSetSingle,
    optionSetReference: JSON.stringify(['Passport', 'Driver Licence', 'National ID']),
    evidenceBinding: {
      fileVariable: 'id-document',
      query:
        'Which kind of identity document is this? Answer with one of the allowed options.',
    },
  });

  // Section 2 — Qualification (bound to academic-transcript)
  const secQual = await createLevel({
    templateId,
    name: 'Qualification',
    type: LEVEL_TYPE.Section,
    order: 1,
  });
  const qDegree = await createLevel({
    templateId,
    name: 'Holds a bachelor’s degree?',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: secQual,
    dataType: DATA_TYPE.Boolean,
    evidenceBinding: {
      fileVariable: 'academic-transcript',
      query:
        "If the transcript shows a completed bachelor's degree, set this to true; otherwise false.",
    },
  });
  const qField = await createLevel({
    templateId,
    name: 'Field of study',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: secQual,
    dataType: DATA_TYPE.Text,
    includeInLetter: true,
    evidenceBinding: {
      fileVariable: 'academic-transcript',
      query: 'Extract the primary field of study / major from the transcript.',
    },
  });
  const qGradDate = await createLevel({
    templateId,
    name: 'Graduation date',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: secQual,
    dataType: DATA_TYPE.Date,
    evidenceBinding: {
      fileVariable: 'academic-transcript',
      query: 'Extract the graduation / conferral date as YYYY-MM-DD.',
    },
  });

  // Section 3 — Experience (bound to candidate-resume)
  const secExp = await createLevel({
    templateId,
    name: 'Experience',
    type: LEVEL_TYPE.Section,
    order: 2,
  });
  const qYears = await createLevel({
    templateId,
    name: 'Years of professional experience',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: secExp,
    dataType: DATA_TYPE.OptionSetSingle,
    includeInLetter: true,
    optionSetReference: JSON.stringify(['<2 years', '2-5 years', '5+ years']),
    evidenceBinding: {
      fileVariable: 'candidate-resume',
      query:
        'Estimate total years of professional software experience from the work history. Answer with one of the allowed options.',
    },
  });
  const qCurrentRole = await createLevel({
    templateId,
    name: 'Most recent job title',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: secExp,
    dataType: DATA_TYPE.Text,
    evidenceBinding: {
      fileVariable: 'candidate-resume',
      query: 'Extract the most recent job title from the work history.',
    },
  });
  const qStartDate = await createLevel({
    templateId,
    name: 'Latest role start date',
    type: LEVEL_TYPE.Question,
    order: 2,
    parentLevelId: secExp,
    dataType: DATA_TYPE.Date,
    evidenceBinding: {
      fileVariable: 'candidate-resume',
      query: 'Extract the start date of the most recent role as YYYY-MM-DD.',
    },
  });
  update('levels', { status: 'done' });

  // --- A light rule set so the outcome chips have something to show ---------
  await createCriteria({
    levelId: qDegree,
    name: 'Degree rule',
    operator: OPERATOR.IsTrue,
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: qYears,
    name: 'Experience rule',
    operator: OPERATOR.Equals,
    targetValue: '5+ years',
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.QuestionValue,
  });
  await createCriteria({
    levelId: secQual,
    name: 'Qualification roll-up',
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.SectionOutcome,
  });
  await createCriteria({
    levelId: secExp,
    name: 'Experience roll-up',
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.SectionOutcome,
  });
  await createCriteria({
    levelId: rootId,
    name: 'Assessment outcome rule',
    scoringType: SCORING_TYPE.Boolean,
    sourceType: SOURCE_TYPE.SectionOutcome,
  });
  update('criteria', { status: 'done' });

  // --- Blank In-progress instance ------------------------------------------
  // No responses seeded — every bound question is open so the auto-fill mapping
  // step has the full set to offer.
  const dueIn30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const instanceR = await Dnx_assessment_instancesService.create(
    cast<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>({
      dnx_assessment_name: 'AI Demo — Alex Carter',
      'dnx_Project@odata.bind': `/dnx_projects(${projectId})`,
      'dnx_AssessmentTemplate@odata.bind': `/dnx_assessment_templates(${templateId})`,
      statecode: 0,
      statuscode: STATUS_INSTANCE.InProgress,
      dnx_version: 1,
      dnx_outcome: OUTCOME_INSTANCE.Pending,
      dnx_duedate: dueIn30,
    }),
  );
  if (!instanceR.success || !instanceR.data) {
    throw new Error(instanceR.error?.message ?? 'Failed to create instance');
  }
  const instanceId = instanceR.data.dnx_assessment_instanceid;
  update('instance', { status: 'done', message: instanceId });

  // Touch the unused IDs so the linter doesn't complain about levels we created
  // purely for structure (they're real rows, just not referenced again here).
  void [qFullName, qDob, qIdType, qField, qGradDate, qCurrentRole, qStartDate];

  return {
    projectId,
    templateId,
    instanceId,
    fileVariables: [...AI_DEMO_FILE_VARIABLES],
  };
}
