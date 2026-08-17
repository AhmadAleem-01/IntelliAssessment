import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
import { Dnx_projectsService } from '../../generated/services/Dnx_projectsService';
import { Dnx_assessment_templatesService } from '../../generated/services/Dnx_assessment_templatesService';
import { Dnx_assessment_levelsService } from '../../generated/services/Dnx_assessment_levelsService';
import { Dnx_assessment_instancesService } from '../../generated/services/Dnx_assessment_instancesService';
import type { Dnx_projectsBase } from '../../generated/models/Dnx_projectsModel';
import type { Dnx_assessment_templatesBase } from '../../generated/models/Dnx_assessment_templatesModel';
import type { Dnx_assessment_levelsBase } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_instancesBase } from '../../generated/models/Dnx_assessment_instancesModel';
import type { SeedStep } from './seedDemo';
import { makeDetailsField, serializeDetailsLayout } from '../applicationDetails/detailsLayout';

/**
 * Application-details (JSON) demo seeder (M10 showcase).
 *
 * Builds one Project + one Template that exercises all three consumers of the
 * application-details JSON:
 *   1. a **sample JSON** on the template (`dnx_application_schema`);
 *   2. **details layouts** on a Section + a Subsection (drag-drop attributes);
 *   3. **AI bindings** that reference JSON attributes — including a JSON-only
 *      question (no evidence file) so the "judge from application data" path is
 *      demoable end to end, PLUS per-subsection questions that read their own
 *      array item via `useSubsectionIndex` (Qualification 3 → qualifications[2]).
 * Then an assessment whose `dnx_application_details` File column is pre-loaded
 * with a JSON that matches the sample shape, so the detail panels resolve and
 * AI auto-fill has data to ground on immediately.
 *
 * Strictly sequential; not idempotent (re-running makes a fresh copy).
 */

export type { SeedStep, StepStatus } from './seedDemo';

type ProgressFn = (steps: SeedStep[]) => void;

export interface AppDetailsSeedResult {
  projectId: string;
  templateId: string;
  instanceId: string;
  /** The sample JSON authored on the template (also what the presenter can copy). */
  sampleJson: string;
  /** The per-assessment JSON uploaded to the instance's File column. */
  instanceJson: string;
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
const OUTCOME_INSTANCE = { Pending: 2 } as const;

/**
 * The demo's **template sample JSON** — the shape the author maps against. A
 * single applicant with nested identity + address, a scalar, and a repeating
 * array (`qualifications[]`) so the flatten/`[]` path handling is on show.
 */
const SAMPLE_APPLICATION: Record<string, unknown> = {
  applicant: {
    fullName: 'Jane Sample',
    dateOfBirth: '1990-01-01',
    nationality: 'Australian',
  },
  address: {
    city: 'Melbourne',
    country: 'Australia',
  },
  yearsExperience: 5,
  priorAssessment: false,
  qualifications: [
    { title: 'Sample Degree', institution: 'Sample University', year: 2012 },
  ],
};

/**
 * The demo's **per-assessment JSON** — same shape as the sample, real values
 * for the seeded candidate "Priya Raman". This is uploaded to the instance's
 * File column so the detail panels + AI bindings resolve immediately.
 */
const INSTANCE_APPLICATION: Record<string, unknown> = {
  applicant: {
    fullName: 'Priya Raman',
    dateOfBirth: '1991-07-14',
    nationality: 'Indian',
  },
  address: {
    city: 'Sydney',
    country: 'Australia',
  },
  yearsExperience: 7,
  priorAssessment: true,
  qualifications: [
    { title: 'BSc Computer Science', institution: 'University of Pune', year: 2013 },
    { title: 'MSc Data Science', institution: 'UNSW', year: 2019 },
    { title: 'Grad Cert Cloud Architecture', institution: 'RMIT', year: 2022 },
  ],
};

interface CreateLevelOpts {
  templateId: string;
  name: string;
  type: number;
  order: number;
  parentLevelId?: string;
  dataType?: number;
  hintText?: string;
  includeInLetter?: boolean;
  optionSetReference?: string;
  /** Serialised `{ fileVariable, query, applicationDataPaths }` → dnx_document_type_reference. */
  evidenceBinding?: {
    fileVariable?: string;
    query?: string;
    applicationDataPaths?: string[];
    /**
     * When true, repeating (`[]`) paths resolve at THIS question's subsection
     * position — e.g. a question in "Qualification 3" reads qualifications[2].
     * Demonstrates the AI-conditioning "use this subsection's position" option.
     */
    useSubsectionIndex?: boolean;
  };
  /** Serialised details layout (attribute paths to show) → dnx_details_layout. */
  detailsPaths?: string[];
  /** Pin the details panel's repeating paths to a fixed 0-based array index. */
  detailsArrayIndex?: number;
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
  if (opts.includeInLetter) record.dnx_include_in_letter = true;
  if (opts.optionSetReference) record.dnx_option_set_reference = opts.optionSetReference;
  if (opts.evidenceBinding) {
    // Only include keys that carry something (matches serializeEvidenceBinding).
    const b = opts.evidenceBinding;
    record.dnx_document_type_reference = JSON.stringify({
      fileVariable: b.fileVariable ?? '',
      query: b.query ?? '',
      ...(b.applicationDataPaths?.length ? { applicationDataPaths: b.applicationDataPaths } : {}),
      ...(b.useSubsectionIndex ? { useSubsectionIndex: true } : {}),
    });
  }
  if (opts.detailsPaths?.length) {
    record.dnx_details_layout = serializeDetailsLayout({
      version: 1,
      fields: opts.detailsPaths.map((p) => makeDetailsField(p)),
      ...(opts.detailsArrayIndex !== undefined ? { arrayIndex: opts.detailsArrayIndex } : {}),
    });
  }

  const r = await Dnx_assessment_levelsService.create(
    cast<Omit<Dnx_assessment_levelsBase, 'dnx_assessment_levelid'>>(record),
  );
  if (!r.success || !r.data) {
    throw new Error(r.error?.message ?? `Failed to create level "${opts.name}"`);
  }
  return r.data.dnx_assessment_levelid;
}

export async function seedApplicationDetailsDemo(
  onProgress: ProgressFn,
): Promise<AppDetailsSeedResult> {
  const steps: SeedStep[] = [
    { key: 'project', label: 'Create application-details demo project', status: 'pending' },
    { key: 'template', label: 'Create template + author the sample JSON schema', status: 'pending' },
    { key: 'levels', label: 'Build sections with details panels + JSON-referencing AI bindings', status: 'pending' },
    { key: 'instance', label: 'Create an assessment', status: 'pending' },
    { key: 'upload', label: 'Upload the matching application-details JSON file', status: 'pending' },
  ];
  const update = (key: string, patch: Partial<SeedStep>) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) {
      steps[idx] = { ...steps[idx], ...patch };
      onProgress([...steps]);
    }
  };
  onProgress([...steps]);

  const sampleJson = JSON.stringify(SAMPLE_APPLICATION, null, 2);
  const instanceJson = JSON.stringify(INSTANCE_APPLICATION, null, 2);

  // --- Project --------------------------------------------------------------
  const projectR = await Dnx_projectsService.create(
    cast<Omit<Dnx_projectsBase, 'dnx_projectid'>>({
      dnx_project_name: 'RPL — Application Details (Demo)',
      dnx_project_code: 'DEMO-APPDATA-001',
      dnx_description:
        'Showcase for the application-details JSON feature: detail panels on sections + AI judgements grounded in JSON attributes.',
      statecode: 0,
      statuscode: 1,
    }),
  );
  if (!projectR.success || !projectR.data) {
    throw new Error(projectR.error?.message ?? 'Failed to create project');
  }
  const projectId = projectR.data.dnx_projectid;
  update('project', { status: 'done', message: projectId });

  // --- Template (with the sample JSON authored in one shot) -----------------
  const templateR = await Dnx_assessment_templatesService.create(
    cast<Omit<Dnx_assessment_templatesBase, 'dnx_assessment_templateid'>>({
      dnx_template_name: 'RPL — Application Details Demo',
      dnx_description:
        'Template whose questions read structured application-details JSON: a details panel per section + AI bindings that reference JSON attributes (including a JSON-only judgement).',
      dnx_template_version: 1,
      dnx_application_schema: sampleJson,
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
  await createLevel({ templateId, name: '_root_', type: LEVEL_TYPE.Root, order: -1 });

  // Section 1 — Applicant: a DETAILS PANEL showing identity + a JSON-ONLY AI question.
  const secApplicant = await createLevel({
    templateId,
    name: 'Applicant',
    type: LEVEL_TYPE.Section,
    order: 0,
    // Details panel: show these attributes resolved from the instance JSON.
    detailsPaths: ['applicant.fullName', 'applicant.dateOfBirth', 'applicant.nationality', 'address.city'],
  });
  // JSON-only AI question (no file variable) — judged purely from application data.
  await createLevel({
    templateId,
    name: 'Applicant is based in Australia?',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: secApplicant,
    dataType: DATA_TYPE.Boolean,
    hintText: 'Auto-fillable from application data alone (no evidence file needed).',
    evidenceBinding: {
      query: 'Set true if the applicant\'s country is Australia, otherwise false.',
      applicationDataPaths: ['address.country'],
    },
  });
  // Text question also judged from JSON only.
  await createLevel({
    templateId,
    name: 'Nationality',
    type: LEVEL_TYPE.Question,
    order: 1,
    parentLevelId: secApplicant,
    dataType: DATA_TYPE.Text,
    includeInLetter: true,
    evidenceBinding: {
      query: 'Copy the applicant\'s nationality from the application data.',
      applicationDataPaths: ['applicant.nationality'],
    },
  });

  // Section 2 — Experience: an AI question that combines JSON + (optional) evidence.
  const secExperience = await createLevel({
    templateId,
    name: 'Experience',
    type: LEVEL_TYPE.Section,
    order: 1,
    detailsPaths: ['yearsExperience', 'priorAssessment'],
  });
  await createLevel({
    templateId,
    name: 'Meets the 5-year experience bar?',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: secExperience,
    dataType: DATA_TYPE.Boolean,
    hintText: 'Uses the yearsExperience application-data attribute.',
    evidenceBinding: {
      query: 'Set true if yearsExperience is 5 or more, otherwise false.',
      applicationDataPaths: ['yearsExperience'],
    },
  });

  // Subsection under Experience — a details panel showing ALL qualifications
  // (repeating array, one block per item — no arrayIndex pin).
  const subQuals = await createLevel({
    templateId,
    name: 'Qualifications (all)',
    type: LEVEL_TYPE.Subsection,
    order: 1,
    parentLevelId: secExperience,
    detailsPaths: ['qualifications[].title', 'qualifications[].institution', 'qualifications[].year'],
  });
  await createLevel({
    templateId,
    name: 'Primary qualification title',
    type: LEVEL_TYPE.Question,
    order: 0,
    parentLevelId: subQuals,
    dataType: DATA_TYPE.Text,
    includeInLetter: true,
    evidenceBinding: {
      query: 'Copy the title of the first qualification from the application data.',
      applicationDataPaths: ['qualifications[].title'],
    },
  });

  // Three FIXED subsections, each pinned to one array element via arrayIndex —
  // the "3 Qualification subsections ↔ one JSON array" pattern. Each panel
  // resolves qualifications[i] (title/institution/year) for its own index, AND
  // each carries AI-bound questions that read THAT subsection's own array item
  // via `useSubsectionIndex` (so Qualification 3's questions read
  // qualifications[2]). This is the subsection-mapped AI-answer showcase.
  for (let i = 0; i < 3; i += 1) {
    const subQual = await createLevel({
      templateId,
      name: `Qualification ${i + 1}`,
      type: LEVEL_TYPE.Subsection,
      order: 2 + i,
      parentLevelId: secExperience,
      detailsPaths: [
        'qualifications[].title',
        'qualifications[].institution',
        'qualifications[].year',
      ],
      detailsArrayIndex: i,
    });
    // Q1 — copy this qualification's title from its own array slot.
    await createLevel({
      templateId,
      name: 'Qualification title',
      type: LEVEL_TYPE.Question,
      order: 0,
      parentLevelId: subQual,
      dataType: DATA_TYPE.Text,
      includeInLetter: true,
      hintText: 'Reads this subsection’s own qualification from application data.',
      evidenceBinding: {
        query:
          "Copy this qualification's title from the application data (the item matching this subsection's position).",
        applicationDataPaths: ['qualifications[].title'],
        useSubsectionIndex: true,
      },
    });
    // Q2 — issuing institution from the same slot.
    await createLevel({
      templateId,
      name: 'Issuing institution',
      type: LEVEL_TYPE.Question,
      order: 1,
      parentLevelId: subQual,
      dataType: DATA_TYPE.Text,
      evidenceBinding: {
        query:
          "Copy the issuing institution of this subsection's qualification from the application data.",
        applicationDataPaths: ['qualifications[].institution'],
        useSubsectionIndex: true,
      },
    });
    // Q3 — a boolean judged from the year in the same slot.
    await createLevel({
      templateId,
      name: 'Completed in the last 15 years?',
      type: LEVEL_TYPE.Question,
      order: 2,
      parentLevelId: subQual,
      dataType: DATA_TYPE.Boolean,
      evidenceBinding: {
        query:
          "Using this subsection's qualification year from the application data, set true if it is 2011 or later, otherwise false.",
        applicationDataPaths: ['qualifications[].year'],
        useSubsectionIndex: true,
      },
    });
  }
  update('levels', { status: 'done' });

  // --- Assessment instance --------------------------------------------------
  const dueIn30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const instanceR = await Dnx_assessment_instancesService.create(
    cast<Omit<Dnx_assessment_instancesBase, 'dnx_assessment_instanceid'>>({
      dnx_assessment_name: 'Application Details Demo — Priya Raman',
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

  // --- Upload the per-assessment JSON to the File column (gotcha O) ----------
  const client = getClient(dataSourcesInfo);
  const up = await client.uploadFileToRecord(
    'dnx_assessment_instances',
    instanceId,
    'dnx_application_details',
    'application-details.json',
    instanceJson,
  );
  if (up && typeof up === 'object' && 'success' in up && (up as { success: boolean }).success === false) {
    throw new Error('Failed to upload the application-details JSON to the instance.');
  }
  update('upload', { status: 'done' });

  return { projectId, templateId, instanceId, sampleJson, instanceJson };
}
