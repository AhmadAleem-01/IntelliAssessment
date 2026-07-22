import { Dnx_projectsService } from '../../generated/services/Dnx_projectsService';
import { Dnx_assessment_templatesService } from '../../generated/services/Dnx_assessment_templatesService';
import { Dnx_assessment_levelsService } from '../../generated/services/Dnx_assessment_levelsService';
import { Dnx_assessment_instancesService } from '../../generated/services/Dnx_assessment_instancesService';
import { Dnx_assessment_responsesService } from '../../generated/services/Dnx_assessment_responsesService';
import type { Dnx_projectsBase } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_assessment_templatesBase } from '../../generated/models/Dnx_assessment_templatesModel';
import type { Dnx_assessment_levelsBase } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_instancesBase } from '../../generated/models/Dnx_assessment_instancesModel';
import type { Dnx_assessment_responsesBase } from '../../generated/models/Dnx_assessment_responsesModel';
import type { SeedStep } from './seedDemo';
import { serializeLetterLayout, type LetterLayout } from '../letter/letterLayout';

/**
 * Letter-builder / grouped-subsections demo seeder (M8b showcase).
 *
 * Builds a template shaped like the scenario the feature was designed for:
 * one Section ("Qualifications") containing FIVE sibling subsections
 * (Qualification 1..5), each with its own "Reason" option-set question plus a
 * couple of fields flagged `include_in_letter`. One assessment answers all
 * five with a deliberately varied mix of Reason values so the grouping is
 * visually obvious the moment you open the letter.
 *
 * The template's letter layout is pre-authored (Heading / Meta / Outcome /
 * **Grouped subsections** — pointed at the Qualifications section + the
 * "Reason" question / Reviewer notes) so the presenter can jump straight to
 * "View letter" without building the layout live — the Letter tab is still
 * there to show off the authoring side if wanted.
 *
 * Deliberately lean: no rule cascade, no reviewer flow — the star here is the
 * grouped-subsections block. Strictly sequential; progress via `onProgress`.
 * Not idempotent — re-running creates a fresh copy.
 */

type ProgressFn = (steps: SeedStep[]) => void;

export interface LetterSeedResult {
  projectId: string;
  templateId: string;
  instanceId: string;
  /** The section name to pick in the Letter tab's block editor (for the live-authoring part of the demo). */
  sectionName: string;
  /** The question name to pick in the block editor's second dropdown. */
  groupByQuestionName: string;
}

function cast<T>(value: unknown): T {
  return value as T;
}

const LEVEL_TYPE = { Section: 1, Subsection: 2, Question: 3 } as const;
const DATA_TYPE = { Boolean: 0, OptionSetSingle: 1, Text: 3 } as const;
const STATUS_INSTANCE = { InProgress: 778540002 } as const;
const STATUS_TEMPLATE = { Published: 778540002 } as const;
const OUTCOME_INSTANCE = { Pending: 2 } as const;

const SECTION_NAME = 'Qualifications';
const REASON_QUESTION_NAME = 'Reason';
const REASON_OPTIONS = [
  'Formal study',
  'Relevant work experience',
  'Industry certification',
];

/** Five qualifications with a deliberately varied Reason mix + letter detail. */
const QUALIFICATIONS: {
  name: string;
  reason: string;
  qualificationName: string;
  meetsRequirement: boolean;
}[] = [
  {
    name: 'Qualification 1',
    reason: 'Formal study',
    qualificationName: 'Bachelor of Software Engineering',
    meetsRequirement: true,
  },
  {
    name: 'Qualification 2',
    reason: 'Relevant work experience',
    qualificationName: '4 years as a backend developer, Datanox Pty Ltd',
    meetsRequirement: true,
  },
  {
    name: 'Qualification 3',
    reason: 'Formal study',
    qualificationName: 'Graduate Certificate in Cloud Architecture',
    meetsRequirement: true,
  },
  {
    name: 'Qualification 4',
    reason: 'Industry certification',
    qualificationName: 'AWS Certified Solutions Architect',
    meetsRequirement: false,
  },
  {
    name: 'Qualification 5',
    reason: 'Relevant work experience',
    qualificationName: '2 years leading a DevOps team, Brightwave Solutions',
    meetsRequirement: true,
  },
];

interface CreateLevelOpts {
  templateId: string;
  name: string;
  type: number;
  order: number;
  parentLevelId?: string;
  dataType?: number;
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

async function createResponse(
  instanceId: string,
  levelId: string,
  questionName: string,
  dataType: number,
  value: boolean | string,
): Promise<void> {
  const record: Record<string, unknown> = {
    dnx_name: questionName,
    'dnx_Assessment@odata.bind': `/dnx_assessment_instances(${instanceId})`,
    'dnx_Assessment_Level@odata.bind': `/dnx_assessment_levels(${levelId})`,
    statecode: 0,
    statuscode: 1,
  };
  if (dataType === DATA_TYPE.Boolean && typeof value === 'boolean') {
    record.dnx_response_boolean = value;
  } else if (dataType === DATA_TYPE.OptionSetSingle && typeof value === 'string') {
    record.dnx_response_option = value;
  } else if (dataType === DATA_TYPE.Text && typeof value === 'string') {
    record.dnx_response_text = value;
  }
  const r = await Dnx_assessment_responsesService.create(
    cast<Omit<Dnx_assessment_responsesBase, 'dnx_assessment_responseid'>>(record),
  );
  if (!r.success) {
    throw new Error(r.error?.message ?? `Failed to create response for "${questionName}"`);
  }
}

export async function seedLetterDemo(onProgress: ProgressFn): Promise<LetterSeedResult> {
  const steps: SeedStep[] = [
    { key: 'project', label: 'Create letter demo project', status: 'pending' },
    { key: 'template', label: 'Create letter demo template', status: 'pending' },
    {
      key: 'levels',
      label: 'Build 5 qualifications, each with its own Reason question',
      status: 'pending',
    },
    {
      key: 'layout',
      label: 'Pre-author the letter layout (Grouped subsections block)',
      status: 'pending',
    },
    {
      key: 'instance',
      label: 'Create an assessment answered with varied reasons',
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
      dnx_project_name: 'RPL — Letter Grouping (Demo)',
      dnx_project_code: 'DEMO-LETTER-001',
      dnx_description:
        'Showcase project for the letter builder\'s "Grouped subsections" block: five qualifications grouped by their own Reason answer in the outcome letter.',
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
      dnx_template_name: 'RPL Qualifications — Letter Demo',
      dnx_description:
        'One "Qualifications" section with 5 subsections, each carrying its own Reason question. Demonstrates the Grouped subsections letter block.',
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

  // --- Level tree: one Section, 5 Subsections, each with Reason + detail ----
  const sectionId = await createLevel({
    templateId,
    name: SECTION_NAME,
    type: LEVEL_TYPE.Section,
    order: 0,
  });

  const qualLevelIds: {
    subId: string;
    reasonId: string;
    nameId: string;
    meetsId: string;
  }[] = [];

  for (let i = 0; i < QUALIFICATIONS.length; i++) {
    const q = QUALIFICATIONS[i];
    const subId = await createLevel({
      templateId,
      name: q.name,
      type: LEVEL_TYPE.Subsection,
      order: i,
      parentLevelId: sectionId,
    });
    const reasonId = await createLevel({
      templateId,
      name: REASON_QUESTION_NAME,
      type: LEVEL_TYPE.Question,
      order: 0,
      parentLevelId: subId,
      dataType: DATA_TYPE.OptionSetSingle,
      optionSetReference: JSON.stringify(REASON_OPTIONS),
    });
    const nameId = await createLevel({
      templateId,
      name: 'Qualification name',
      type: LEVEL_TYPE.Question,
      order: 1,
      parentLevelId: subId,
      dataType: DATA_TYPE.Text,
      includeInLetter: true,
    });
    const meetsId = await createLevel({
      templateId,
      name: 'Meets requirement?',
      type: LEVEL_TYPE.Question,
      order: 2,
      parentLevelId: subId,
      dataType: DATA_TYPE.Boolean,
      includeInLetter: true,
    });
    qualLevelIds.push({ subId, reasonId, nameId, meetsId });
  }
  update('levels', { status: 'done' });

  // --- Pre-author the letter layout -----------------------------------------
  const layout: LetterLayout = {
    version: 1,
    blocks: [
      { id: 'h1', type: 'heading', text: 'Assessment outcome', align: 'left' },
      {
        id: 'm1',
        type: 'meta',
        fields: ['candidate', 'assessment', 'project', 'template', 'submittedOn', 'today'],
      },
      { id: 'o1', type: 'outcome' },
      {
        id: 'g1',
        type: 'groupedSubsections',
        heading: 'Qualifications by reason',
        sectionLevelId: sectionId,
        groupByQuestionName: REASON_QUESTION_NAME,
      },
      { id: 'rn1', type: 'reviewerNotes' },
    ],
  };
  const layoutR = await Dnx_assessment_templatesService.update(
    templateId,
    cast<Partial<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>>({
      dnx_letter_template_json: serializeLetterLayout(layout),
    }),
  );
  if (!layoutR.success) {
    throw new Error(layoutR.error?.message ?? 'Failed to save letter layout');
  }
  update('layout', { status: 'done' });

  // --- Assessment instance, fully answered -----------------------------------
  const dueIn30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const instanceR = await Dnx_assessment_instancesService.create(
    cast<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>({
      dnx_assessment_name: 'Letter Demo — Priya Nair',
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

  for (let i = 0; i < QUALIFICATIONS.length; i++) {
    const q = QUALIFICATIONS[i];
    const ids = qualLevelIds[i];
    await createResponse(instanceId, ids.reasonId, REASON_QUESTION_NAME, DATA_TYPE.OptionSetSingle, q.reason);
    await createResponse(instanceId, ids.nameId, 'Qualification name', DATA_TYPE.Text, q.qualificationName);
    await createResponse(instanceId, ids.meetsId, 'Meets requirement?', DATA_TYPE.Boolean, q.meetsRequirement);
  }
  update('instance', { status: 'done', message: instanceId });

  return {
    projectId,
    templateId,
    instanceId,
    sectionName: SECTION_NAME,
    groupByQuestionName: REASON_QUESTION_NAME,
  };
}
