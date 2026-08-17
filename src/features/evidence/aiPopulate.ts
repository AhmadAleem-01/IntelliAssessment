import { useMutation } from '@tanstack/react-query';
import { AIAgentFlowService } from '../../generated/services/AIAgentFlowService';
import { DocumentTextExtractionFlowService } from '../../generated/services/DocumentTextExtractionFlowService';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { DataType } from '../templates/levels/levelTypes';
import { parseOptions } from '../templates/levels/options';
import { parseEvidenceBinding } from '../templates/levels/evidenceBinding';
import { subsectionIndexOf } from '../templates/levels/treeBuilder';
import { resolvePaths, resolvePathAt, formatValue } from '../applicationDetails/appData';

/**
 * M6b — AI-assisted answer auto-population.
 *
 * One file's extracted text + the template's unanswered questions are folded
 * into a SINGLE prompt (cost guardrail from the plan — one LLM round-trip per
 * fill, not one per question). The model returns a JSON array of proposed
 * answers with a confidence score; the assessor reviews and accepts them
 * one-by-one or in bulk. Nothing is written to Dataverse without a human in
 * the loop — this module only proposes.
 *
 * The flow contract (`AIAgentFlow`) is a single free-form `text` in →
 * `response` text out, so all structure lives in the prompt we build and the
 * JSON we coax back. `buildPrompt` and `parseAiResponse` are pure so the
 * fragile bits (prompt shape, lenient JSON parsing) are unit-testable without
 * a live flow.
 */

/** A question the AI is being asked to answer, distilled from a level row. */
export interface AiQuestion {
  levelId: string;
  label: string;
  dataType: DataType;
  /** Allowed labels for OptionSet / Multiselect — empty for other types. */
  options: string[];
  hint?: string;
  /**
   * Author's extraction query for this question (from the template's evidence
   * binding). When present it's the primary instruction the model follows;
   * without it the model falls back to inferring an answer from the label.
   */
  query?: string;
  /** The file variable this question's evidence is expected to come from. */
  fileVariable?: string;
  /**
   * Application-details attribute paths the author bound to this question (from
   * the evidence binding). Resolved against the instance JSON into
   * `applicationData` before the prompt is built.
   */
  applicationDataPaths?: string[];
  /**
   * When true, repeating (`[]`) attribute paths resolve at `subsectionIndex`
   * (the question's own repeating-subsection slot) rather than the first item.
   */
  useSubsectionIndex?: boolean;
  /** 0-based slot of the question's repeating subsection (Qual 3 → 2). */
  subsectionIndex?: number;
  /**
   * Resolved `{ path: displayValue }` for this question's bound attributes,
   * injected into the prompt as structured facts. Populated at runtime.
   */
  applicationData?: Record<string, string>;
}

/**
 * Collect the distinct evidence file variables declared across a set of
 * questions, each paired with the questions that reference it. This is the
 * catalog the assessment-time mapping UI iterates: one row per variable, the
 * assessor binds it to a real uploaded file.
 *
 * Questions without a file variable are returned separately so the caller can
 * decide whether to offer them a manual file pick (they can't be auto-grouped).
 */
export interface FileVariableGroup {
  fileVariable: string;
  questions: AiQuestion[];
}

export function groupByFileVariable(questions: AiQuestion[]): {
  groups: FileVariableGroup[];
  unbound: AiQuestion[];
} {
  const byVar = new Map<string, AiQuestion[]>();
  const unbound: AiQuestion[] = [];
  for (const q of questions) {
    const v = q.fileVariable?.trim();
    if (!v) {
      unbound.push(q);
      continue;
    }
    const list = byVar.get(v);
    if (list) list.push(q);
    else byVar.set(v, [q]);
  }
  const groups = Array.from(byVar.entries()).map(([fileVariable, qs]) => ({
    fileVariable,
    questions: qs,
  }));
  return { groups, unbound };
}

/** A proposed answer parsed out of the model's JSON response. */
export interface AiSuggestion {
  levelId: string;
  /** Natural in-memory value, shape matches the question's dataType. */
  value: boolean | string | string[] | null;
  /** 0–1. Clamped on parse; defaults to 0 when the model omits it. */
  confidence: number;
  /** One-line justification the model gives — surfaced as the source summary. */
  rationale: string;
  /**
   * Which of the question's bound application-data attribute paths the model
   * said it relied on (echoed back + validated against the offered paths).
   * Empty when the judgement was evidence-only.
   */
  usedAttributes?: string[];
}

const DATA_TYPE_NAME: Record<DataType, string> = {
  0: 'boolean (answer true or false)',
  1: 'single-choice (answer with exactly one of the allowed options)',
  2: 'multi-choice (answer with an array of zero or more allowed options)',
  3: 'free text',
  4: 'date (answer as YYYY-MM-DD)',
};

/**
 * Turn a list of template Question levels into the lean shape the prompt needs.
 * Only Question-type levels (data type present) make sense to auto-fill.
 */
export function toAiQuestions(levels: Dnx_assessment_levels[]): AiQuestion[] {
  return levels
    .filter((l) => l.dnx_assessment_level_type === 3)
    .map((l) => {
      const dataType = (l.dnx_data_type ?? 3) as DataType;
      const binding = parseEvidenceBinding(l.dnx_document_type_reference);
      return {
        levelId: l.dnx_assessment_levelid,
        label: l.dnx_name,
        dataType,
        options:
          dataType === 1 || dataType === 2
            ? parseOptions(l.dnx_option_set_reference)
            : [],
        hint: l.dnx_hint_text ?? undefined,
        query: binding?.query || undefined,
        fileVariable: binding?.fileVariable || undefined,
        applicationDataPaths: binding?.applicationDataPaths?.length
          ? binding.applicationDataPaths
          : undefined,
        useSubsectionIndex: binding?.useSubsectionIndex || undefined,
        subsectionIndex: binding?.useSubsectionIndex
          ? subsectionIndexOf(levels, l.dnx_assessment_levelid)
          : undefined,
      };
    });
}

/**
 * Build the single batched prompt. The evidence text is bounded so a large
 * OCR dump can't blow the context window — we keep the head, which is where
 * qualification/identity documents put the salient fields.
 */
const MAX_EVIDENCE_CHARS = 12_000;

export function buildPrompt(evidenceText: string, questions: AiQuestion[]): string {
  const clipped =
    evidenceText.length > MAX_EVIDENCE_CHARS
      ? evidenceText.slice(0, MAX_EVIDENCE_CHARS) + '\n…[truncated]'
      : evidenceText;

  const manifest = questions.map((q) => ({
    id: q.levelId,
    question: q.label,
    type: DATA_TYPE_NAME[q.dataType],
    ...(q.query ? { instruction: q.query } : {}),
    ...(q.options.length ? { allowedOptions: q.options } : {}),
    ...(q.hint ? { hint: q.hint } : {}),
    ...(q.applicationData && Object.keys(q.applicationData).length
      ? { applicationData: q.applicationData }
      : {}),
  }));

  return [
    'You are an assessment assistant for Recognition of Prior Learning. You are given',
    'the text extracted from a piece of evidence and a list of questions. For each',
    'question you can confidently answer, propose an answer.',
    '',
    'Rules:',
    '- When a question carries an "instruction", follow it exactly — it is the',
    '  author\'s rule for how to derive the answer.',
    '- Some questions include "applicationData": structured facts about the applicant',
    '  (drawn from their application). Treat these as trusted inputs and use them',
    '  together with the evidence text to answer that question.',
    '- Only answer questions the evidence and/or applicationData actually support. Skip',
    '  anything you cannot ground — do NOT guess.',
    '- Respect each question\'s type. For single/multi choice, use ONLY the allowed',
    '  options, copied verbatim. For boolean, use true/false. For date, use YYYY-MM-DD.',
    '- confidence is your certainty from 0 to 1 (1 = a source states it explicitly).',
    '- rationale is one short sentence pointing to the supporting evidence or fact.',
    '- usedAttributes is an array of the applicationData keys you actually relied on for',
    '  that question (copy the keys verbatim); use [] if you used none.',
    '',
    'Respond with ONLY a JSON array (no markdown fences, no prose). Each element:',
    '{ "id": "<question id>", "value": <answer>, "confidence": <0-1>, "rationale": "<why>",',
    '  "usedAttributes": ["<applicationData key>", …] }',
    'Return [] if nothing can be answered.',
    '',
    '--- EVIDENCE TEXT ---',
    clipped,
    '--- END EVIDENCE ---',
    '',
    '--- QUESTIONS (JSON) ---',
    JSON.stringify(manifest, null, 2),
  ].join('\n');
}

/**
 * Pull a JSON array out of the model's raw response and coerce each element
 * into an AiSuggestion. Tolerant by design — models wrap JSON in ```fences```,
 * add a preamble, or emit a single object instead of an array. We:
 *   1. strip markdown fences,
 *   2. slice from the first `[` to the last `]` (or `{`/`}` for a lone object),
 *   3. JSON.parse, then validate + clamp each row.
 * Rows that don't reference a known question id, or whose value can't be made
 * to fit the question type, are dropped rather than surfaced as garbage.
 */
export function parseAiResponse(
  raw: string,
  questions: AiQuestion[],
): AiSuggestion[] {
  const byId = new Map(questions.map((q) => [q.levelId, q] as const));

  const jsonText = extractJsonBlob(raw);
  if (!jsonText) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? [parsed]
      : [];

  const out: AiSuggestion[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const levelId = typeof r.id === 'string' ? r.id : undefined;
    if (!levelId) continue;
    const q = byId.get(levelId);
    if (!q) continue;

    const value = coerceValue(r.value, q);
    if (value === null) continue; // model proposed nothing usable for this one

    // Keep only echoed attribute keys the question actually offered — the model
    // sometimes invents or reformats keys.
    const offered = new Set(q.applicationDataPaths ?? []);
    const usedAttributes = Array.isArray(r.usedAttributes)
      ? r.usedAttributes.filter((a): a is string => typeof a === 'string' && offered.has(a))
      : [];

    out.push({
      levelId,
      value,
      confidence: clampConfidence(r.confidence),
      rationale:
        typeof r.rationale === 'string' && r.rationale.trim()
          ? r.rationale.trim()
          : 'Proposed from evidence text.',
      ...(usedAttributes.length ? { usedAttributes } : {}),
    });
  }
  return out;
}

/** Strip ```fences``` and isolate the outermost JSON array/object substring. */
function extractJsonBlob(raw: string): string | null {
  const noFences = raw.replace(/```(?:json)?/gi, '').trim();
  const firstArr = noFences.indexOf('[');
  const lastArr = noFences.lastIndexOf(']');
  if (firstArr >= 0 && lastArr > firstArr) {
    return noFences.slice(firstArr, lastArr + 1);
  }
  const firstObj = noFences.indexOf('{');
  const lastObj = noFences.lastIndexOf('}');
  if (firstObj >= 0 && lastObj > firstObj) {
    return noFences.slice(firstObj, lastObj + 1);
  }
  return null;
}

function clampConfidence(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return n > 1 && n <= 100 ? n / 100 : 1; // tolerate 0-100 scale
  return n;
}

/**
 * Coerce a raw model value into the natural shape the question's data type
 * expects, enforcing allowed-option membership. Returns null when the value
 * can't be salvaged so the caller drops the suggestion.
 */
function coerceValue(
  raw: unknown,
  q: AiQuestion,
): boolean | string | string[] | null {
  switch (q.dataType) {
    case 0: {
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase();
        if (['true', 'yes', 'y'].includes(s)) return true;
        if (['false', 'no', 'n'].includes(s)) return false;
      }
      return null;
    }
    case 1: {
      const s = typeof raw === 'string' ? raw.trim() : '';
      if (!s) return null;
      const match = matchOption(s, q.options);
      return match ?? null;
    }
    case 2: {
      const arr = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw.split(/[,;]/).map((x) => x.trim())
          : [];
      const matched = arr
        .map((x) => matchOption(String(x).trim(), q.options))
        .filter((x): x is string => !!x);
      return matched.length ? Array.from(new Set(matched)) : null;
    }
    case 3: {
      const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
      return s.trim() ? s.trim() : null;
    }
    case 4: {
      const s = typeof raw === 'string' ? raw.trim() : '';
      // Accept anything Date can parse; normalise to YYYY-MM-DD.
      const d = new Date(s);
      if (s && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return null;
    }
  }
}

/** Case-insensitive match of a proposed option against the allowed set. */
function matchOption(candidate: string, options: string[]): string | undefined {
  const lc = candidate.toLowerCase();
  return options.find((o) => o.toLowerCase() === lc);
}

/* --- auto-fill orchestration ---------------------------------------------- */

/** Extract one file's text via the OCR flow. Throws on flow failure. */
async function extractFileText(
  assessmentName: string,
  fileName: string,
): Promise<string> {
  const ex = await DocumentTextExtractionFlowService.Run({
    text: fileName,
    text_1: assessmentName,
  });
  if (!ex.success) {
    throw new Error(
      ex.error?.message ?? `Could not read the evidence file "${fileName}"`,
    );
  }
  return ex.data?.content ?? '';
}

/**
 * Build + send one AI call for a set of questions over already-extracted text.
 * Runs as long as there's *some* grounding — evidence text OR at least one
 * question carrying resolved `applicationData` — so JSON-only questions (no
 * evidence file) are still answered.
 */
async function askForGroup(
  evidenceText: string,
  questions: AiQuestion[],
): Promise<AiSuggestion[]> {
  if (questions.length === 0) return [];
  const hasEvidence = evidenceText.trim().length > 0;
  const hasAppData = questions.some(
    (q) => q.applicationData && Object.keys(q.applicationData).length > 0,
  );
  if (!hasEvidence && !hasAppData) return [];
  const prompt = buildPrompt(evidenceText, questions);
  const ai = await AIAgentFlowService.Run({ text: prompt });
  if (!ai.success) {
    throw new Error(ai.error?.message ?? 'The AI assistant could not be reached');
  }
  return parseAiResponse(ai.data?.response ?? '', questions);
}

/**
 * Assessment-time mapped auto-fill.
 *
 * The assessor has bound each declared file variable to a real uploaded file.
 * This runs one extraction per DISTINCT mapped file (deduped — two variables
 * may point at the same upload, and we never OCR the same file twice), then one
 * AI call per file variable group carrying only that group's questions. The
 * author's per-question `instruction` already rides along in the prompt.
 *
 * Results from all groups are flattened into a single suggestion list for the
 * review step. Per-group errors are collected so one unreadable file doesn't
 * sink the whole run — the dialog surfaces what failed.
 */
export interface MappedPopulateResult {
  suggestions: AiSuggestion[];
  /** Variables whose file could not be read / returned no text. */
  warnings: string[];
  /** Total questions across all mapped groups (for the summary line). */
  questionsConsidered: number;
}

export function useAiPopulateMapped(assessmentName: string) {
  return useMutation({
    mutationFn: async (input: {
      groups: FileVariableGroup[];
      /** fileVariable → real uploaded file name. Unmapped variables are skipped. */
      mapping: Record<string, string>;
      /**
       * The assessment's application-details JSON (parsed). When present, each
       * question's bound `applicationDataPaths` are resolved against it and
       * injected into the prompt as `applicationData`.
       */
      applicationData?: Record<string, unknown> | null;
      /**
       * Questions with NO evidence file variable but WITH bound application-data
       * attributes — judged from the JSON alone (no OCR). Sent as one extra AI
       * call with no evidence text.
       */
      applicationOnlyQuestions?: AiQuestion[];
    }): Promise<MappedPopulateResult> => {
      const appData = input.applicationData ?? null;
      // Resolve each question's bound attribute paths against the instance JSON,
      // producing the `applicationData` map the prompt injects. When the question
      // opted into its subsection's position, repeating (`[]`) paths resolve at
      // that index (Qual 3 → item 2) and are keyed by the concrete indexed path
      // so the model + provenance see the exact source.
      const resolveForQuestion = (q: AiQuestion): Record<string, string> => {
        if (!appData || !q.applicationDataPaths?.length) return {};
        if (!q.useSubsectionIndex) return resolvePaths(appData, q.applicationDataPaths);
        const idx = q.subsectionIndex ?? 0;
        const out: Record<string, string> = {};
        for (const path of q.applicationDataPaths) {
          const concrete = path.includes('[]') ? path.replace('[]', `[${idx}]`) : path;
          const value = path.includes('[]')
            ? resolvePathAt(appData, path, idx)
            : resolvePaths(appData, [path])[path];
          if (value !== undefined && value !== null && value !== '') {
            out[concrete] = path.includes('[]') ? formatValue(value) : String(value);
          }
        }
        return out;
      };
      const withAppData = (qs: AiQuestion[]): AiQuestion[] =>
        qs.map((q) =>
          appData && q.applicationDataPaths?.length
            ? { ...q, applicationData: resolveForQuestion(q) }
            : q,
        );

      const mapped = input.groups.filter((g) => input.mapping[g.fileVariable]);
      // JSON-only questions run whenever we actually have application data to
      // ground them; otherwise there'd be nothing to judge from.
      const appOnly = appData ? input.applicationOnlyQuestions ?? [] : [];
      const questionsConsidered =
        mapped.reduce((n, g) => n + g.questions.length, 0) + appOnly.length;
      if (mapped.length === 0 && appOnly.length === 0) {
        return { suggestions: [], warnings: [], questionsConsidered: 0 };
      }

      // Dedupe extraction by real file name — a file may back several variables.
      const distinctFiles = Array.from(
        new Set(mapped.map((g) => input.mapping[g.fileVariable])),
      );
      const textByFile = new Map<string, string>();
      const warnings: string[] = [];
      await Promise.all(
        distinctFiles.map(async (file) => {
          try {
            textByFile.set(file, await extractFileText(assessmentName, file));
          } catch (e) {
            warnings.push((e as Error).message);
            textByFile.set(file, '');
          }
        }),
      );

      // One AI call per file group, plus (if any) one call for the JSON-only
      // questions with no evidence text — all in parallel.
      const groupCalls = mapped.map(async (g) => {
        const file = input.mapping[g.fileVariable];
        const text = textByFile.get(file) ?? '';
        if (!text.trim()) {
          // Only warn if extraction didn't already warn for this file.
          return [] as AiSuggestion[];
        }
        try {
          return await askForGroup(text, withAppData(g.questions));
        } catch (e) {
          warnings.push(`${g.fileVariable}: ${(e as Error).message}`);
          return [] as AiSuggestion[];
        }
      });
      const appOnlyCall =
        appOnly.length > 0
          ? [
              (async () => {
                try {
                  return await askForGroup('', withAppData(appOnly));
                } catch (e) {
                  warnings.push(`application data: ${(e as Error).message}`);
                  return [] as AiSuggestion[];
                }
              })(),
            ]
          : [];
      const perGroup = await Promise.all([...groupCalls, ...appOnlyCall]);

      // Flatten, de-duping by level id (a question can only live in one group,
      // so collisions shouldn't happen — but guard anyway, last write wins).
      const byLevel = new Map<string, AiSuggestion>();
      for (const list of perGroup) {
        for (const s of list) byLevel.set(s.levelId, s);
      }
      return {
        suggestions: Array.from(byLevel.values()),
        warnings,
        questionsConsidered,
      };
    },
  });
}
