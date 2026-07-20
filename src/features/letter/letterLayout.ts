/**
 * Custom letter layout model (M8b).
 *
 * The outcome letter is authored as an ordered list of **blocks** in the
 * template editor's Letter tab and persisted as JSON in the template's
 * `dnx_letter_template_json` column. The renderer (`LetterPreview`) walks this
 * list; when a template has no layout yet, it falls back to `DEFAULT_LAYOUT`
 * (the original fixed letter expressed as blocks) so existing templates and
 * the PDF export keep working unchanged.
 *
 * Text blocks + the heading + signature support `{placeholders}` that merge in
 * assessment data at render time — see `PLACEHOLDERS` / `resolvePlaceholders`.
 */

export type LetterBlockType =
  | 'heading'
  | 'text'
  | 'meta'
  | 'outcome'
  | 'reviewerNotes'
  | 'responses'
  | 'groupedSubsections'
  | 'signature'
  | 'spacer';

/** Which meta rows a `meta` block renders (the header key/value grid). */
export type MetaFieldKey =
  | 'candidate'
  | 'assessment'
  | 'project'
  | 'template'
  | 'submittedOn'
  | 'today'
  | 'version';

export const META_FIELD_LABEL: Record<MetaFieldKey, string> = {
  candidate: 'Candidate',
  assessment: 'Assessment',
  project: 'Project',
  template: 'Template',
  submittedOn: 'Submitted',
  today: 'Letter issued',
  version: 'Version',
};

export type TextAlign = 'left' | 'center' | 'right';

export interface HeadingBlock {
  id: string;
  type: 'heading';
  text: string;
  align: TextAlign;
}
export interface TextBlock {
  id: string;
  type: 'text';
  /** Plain text with {placeholder} tokens; newlines preserved. */
  text: string;
}
export interface MetaBlock {
  id: string;
  type: 'meta';
  fields: MetaFieldKey[];
}
export interface OutcomeBlock {
  id: string;
  type: 'outcome';
}
export interface ReviewerNotesBlock {
  id: string;
  type: 'reviewerNotes';
}
export interface ResponsesBlock {
  id: string;
  type: 'responses';
}
export interface GroupedSubsectionsBlock {
  id: string;
  type: 'groupedSubsections';
  /** Optional heading above the grouped subsections. */
  heading: string;
  /** Which Section's direct subsections to group. Empty = not configured yet. */
  sectionLevelId: string;
  /**
   * Name of the question (present in each of that section's subsections)
   * whose answer is the value to group by. Matched by NAME across sibling
   * subsections — each has its own same-named instance of the question (e.g.
   * every "Qualification N" subsection has its own "Reason" question).
   */
  groupByQuestionName: string;
}
export interface SignatureBlock {
  id: string;
  type: 'signature';
  text: string;
}
export interface SpacerBlock {
  id: string;
  type: 'spacer';
  /** Vertical space in px. */
  size: number;
}

export type LetterBlock =
  | HeadingBlock
  | TextBlock
  | MetaBlock
  | OutcomeBlock
  | ReviewerNotesBlock
  | ResponsesBlock
  | GroupedSubsectionsBlock
  | SignatureBlock
  | SpacerBlock;

export interface LetterLayout {
  version: 1;
  blocks: LetterBlock[];
}

export const LETTER_BLOCK_LABEL: Record<LetterBlockType, string> = {
  heading: 'Heading',
  text: 'Text',
  meta: 'Details grid',
  outcome: 'Outcome',
  reviewerNotes: 'Reviewer notes',
  responses: 'Responses',
  groupedSubsections: 'Grouped subsections',
  signature: 'Signature',
  spacer: 'Spacer',
};

/**
 * Blocks that may only appear once — the palette disables them when present.
 * `groupedSubsections` is excluded: a letter may want several of these, one
 * per section, each scoped + grouped differently.
 */
export const SINGLETON_BLOCKS: ReadonlySet<LetterBlockType> = new Set([
  'meta',
  'outcome',
  'reviewerNotes',
  'responses',
]);

/** Placeholder tokens available in heading / text / signature blocks. */
export const PLACEHOLDERS = [
  '{candidate}',
  '{assessment}',
  '{project}',
  '{template}',
  '{outcome}',
  '{submittedOn}',
  '{today}',
  '{version}',
] as const;

export type PlaceholderValues = Record<string, string>;

/**
 * Answer-reference token: `{{q:<levelId>|<display name>}}`.
 *
 * Lets an author drop a single question's answer inline in a heading / text /
 * signature block. Inserted from a question picker in the builder (the author
 * never types the GUID), resolved to the assessment's answer at render time.
 * Double-brace so it never collides with the single-brace `{placeholder}`
 * tokens. Empty / hidden answers resolve to an em-dash.
 */
const ANSWER_TOKEN_REGEX = /\{\{q:([^|}]+)\|([^}]*)\}\}/g;

export function makeAnswerToken(levelId: string, name: string): string {
  // Strip the delimiters from the name so a question titled "A|B}" can't break
  // the token; the name is cosmetic (the levelId is what resolves).
  const safe = name.replace(/[|}]/g, ' ').trim();
  return `{{q:${levelId}|${safe}}}`;
}

/** Replace every answer token with the level's formatted answer (— when blank). */
export function resolveAnswerTokens(
  text: string,
  answerByLevelId: Record<string, string>,
): string {
  return text.replace(ANSWER_TOKEN_REGEX, (_whole, levelId: string) => {
    const v = answerByLevelId[levelId];
    return v && v.trim() ? v : '—';
  });
}

/**
 * Substitute both token families in `text`:
 *   - `{{q:<levelId>|name}}` → the assessment's answer for that question,
 *   - `{placeholder}`        → a merge value (candidate, outcome, …).
 * Answer tokens resolve first so a `{placeholder}` inside a rendered answer is
 * left untouched. Unknown single-brace tokens are left as-is.
 *
 * Used for the plain-text path; rich HTML blocks go through `resolveLetterHtml`.
 */
export function resolvePlaceholders(
  text: string,
  values: PlaceholderValues,
  answerByLevelId: Record<string, string> = {},
): string {
  const withAnswers = resolveAnswerTokens(text, answerByLevelId);
  return withAnswers.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Turn a block's stored value into final, sanitized letter HTML with all
 * references resolved. Handles both storage shapes:
 *   - **rich HTML** (the current editor output): answer references live as
 *     `<span class="tok-chip" data-level="…">` — swap each for the level's
 *     answer value; also expand `{placeholder}` and any legacy `{{q:}}` tokens
 *     that slipped into text nodes.
 *   - **legacy plain text**: escape it, expand tokens, convert newlines to
 *     `<br>`.
 * The result is sanitized so it's safe for `dangerouslySetInnerHTML`.
 *
 * Requires a DOM (browser) — matches every call site (preview/PDF render).
 */
export function resolveLetterHtml(
  stored: string,
  values: PlaceholderValues,
  answerByLevelId: Record<string, string>,
  sanitize: (html: string) => string,
): string {
  const expandPlaceholders = (s: string) =>
    resolveAnswerTokens(s, answerByLevelId).replace(/\{(\w+)\}/g, (whole, key: string) =>
      key in values ? values[key] : whole,
    );

  const hasTag = /<[a-z][\s\S]*>/i.test(stored);
  if (!hasTag) {
    // Legacy plain text — escape, expand tokens, newlines → <br>.
    const expanded = expandPlaceholders(escapeHtml(stored));
    return sanitize(expanded.replace(/\n/g, '<br>'));
  }

  // Rich HTML: parse, replace chip spans with the resolved answer text, and
  // expand tokens inside remaining text nodes.
  const doc = new DOMParser().parseFromString(`<body>${stored}</body>`, 'text/html');
  doc.body.querySelectorAll('span.tok-chip').forEach((chip) => {
    const levelId = chip.getAttribute('data-level') ?? '';
    const v = answerByLevelId[levelId];
    const text = v && v.trim() ? v : '—';
    // Preserve a colour the author applied to the chip (its inline `color`);
    // otherwise emit a bare text node so the value reads as plain prose.
    const color = (chip as HTMLElement).style.color;
    if (color) {
      const span = doc.createElement('span');
      span.style.color = color;
      span.textContent = text;
      chip.replaceWith(span);
    } else {
      chip.replaceWith(doc.createTextNode(text));
    }
  });
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }
  for (const t of textNodes) {
    const replaced = expandPlaceholders(t.textContent ?? '');
    if (replaced !== t.textContent) t.textContent = replaced;
  }
  return sanitize(doc.body.innerHTML);
}

let idCounter = 0;
/** Stable-enough unique id for a new block (client-only; not persisted-critical). */
function newId(): string {
  idCounter += 1;
  return `blk-${Date.now().toString(36)}-${idCounter}`;
}

/** Construct a fresh block of the given type with sensible defaults. */
export function makeBlock(type: LetterBlockType): LetterBlock {
  const id = newId();
  switch (type) {
    case 'heading':
      return { id, type, text: 'Assessment outcome', align: 'left' };
    case 'text':
      return { id, type, text: 'Dear {candidate},' };
    case 'meta':
      return {
        id,
        type,
        fields: ['candidate', 'assessment', 'project', 'template', 'submittedOn', 'today'],
      };
    case 'outcome':
      return { id, type };
    case 'reviewerNotes':
      return { id, type };
    case 'responses':
      return { id, type };
    case 'groupedSubsections':
      return { id, type, heading: 'Grouped subsections', sectionLevelId: '', groupByQuestionName: '' };
    case 'signature':
      return { id, type, text: 'Issued by IntelliAssessment' };
    case 'spacer':
      return { id, type, size: 16 };
  }
}

/**
 * The original fixed letter expressed as blocks. Used as the fallback when a
 * template hasn't authored a custom layout, so behaviour is unchanged for
 * existing templates.
 */
export const DEFAULT_LAYOUT: LetterLayout = {
  version: 1,
  blocks: [
    { id: 'default-heading', type: 'heading', text: 'Assessment outcome', align: 'left' },
    {
      id: 'default-meta',
      type: 'meta',
      fields: ['candidate', 'assessment', 'project', 'template', 'submittedOn', 'today'],
    },
    { id: 'default-outcome', type: 'outcome' },
    { id: 'default-notes', type: 'reviewerNotes' },
    { id: 'default-responses', type: 'responses' },
  ],
};

const VALID_TYPES: ReadonlySet<string> = new Set<LetterBlockType>([
  'heading',
  'text',
  'meta',
  'outcome',
  'reviewerNotes',
  'responses',
  'groupedSubsections',
  'signature',
  'spacer',
]);


/**
 * Parse the stored JSON into a LetterLayout. Tolerant: bad JSON, missing
 * blocks, or unknown block types collapse to `undefined` so the caller can
 * fall back to `DEFAULT_LAYOUT`. Individual malformed blocks are dropped
 * rather than sinking the whole layout.
 */
export function parseLetterLayout(stored: string | undefined | null): LetterLayout | undefined {
  if (!stored) return undefined;
  const trimmed = stored.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : null;
    if (!rawBlocks) return undefined;
    const blocks: LetterBlock[] = [];
    for (const raw of rawBlocks) {
      if (!raw || typeof raw !== 'object') continue;
      const b = raw as Record<string, unknown>;
      const type = typeof b.type === 'string' ? b.type : '';
      if (!VALID_TYPES.has(type)) continue;
      const id = typeof b.id === 'string' && b.id ? b.id : newId();
      blocks.push(coerceBlock(id, type as LetterBlockType, b));
    }
    if (blocks.length === 0) return undefined;
    return { version: 1, blocks };
  } catch {
    return undefined;
  }
}

/** Fill in a block's fields from raw JSON, defaulting anything missing. */
function coerceBlock(id: string, type: LetterBlockType, b: Record<string, unknown>): LetterBlock {
  const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
  switch (type) {
    case 'heading':
      return {
        id,
        type,
        text: str(b.text, 'Assessment outcome'),
        align: b.align === 'center' || b.align === 'right' ? b.align : 'left',
      };
    case 'text':
      return { id, type, text: str(b.text, '') };
    case 'meta': {
      const fields = Array.isArray(b.fields)
        ? (b.fields.filter(
            (f): f is MetaFieldKey => typeof f === 'string' && f in META_FIELD_LABEL,
          ))
        : (makeBlock('meta') as MetaBlock).fields;
      return { id, type, fields };
    }
    case 'signature':
      return { id, type, text: str(b.text, 'Issued by IntelliAssessment') };
    case 'spacer':
      return { id, type, size: typeof b.size === 'number' ? b.size : 16 };
    case 'groupedSubsections':
      return {
        id,
        type,
        heading: str(b.heading, 'Grouped subsections'),
        sectionLevelId: str(b.sectionLevelId, ''),
        groupByQuestionName: str(b.groupByQuestionName, ''),
      };
    case 'outcome':
    case 'reviewerNotes':
    case 'responses':
      return { id, type };
  }
}

export function serializeLetterLayout(layout: LetterLayout): string {
  return JSON.stringify({ version: 1, blocks: layout.blocks });
}
