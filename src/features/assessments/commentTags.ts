/**
 * Question-tagging helpers for general comments.
 *
 * A comment that references a specific question prepends a tag token to its
 * `dnx_comment_text` payload:
 *   `[Q:<levelId>|<displayName>] Actual comment body…`
 *
 * Schema stays unchanged — we deliberately avoid binding the comment's
 * `dnx_Assessment_Level` lookup because that field already distinguishes
 * per-question reviewer flags from general comments in the existing UI.
 * Storing the tag in-band keeps the two flows independent.
 *
 * The token format is intentionally bracket-delimited and starts at index 0
 * so a single regex round-trip is enough to round-trip it. Newlines in the
 * comment body are preserved via the `s` flag on the parse regex.
 */

export interface ParsedCommentText {
  /** Tagged level id, if any. */
  taggedLevelId?: string;
  /** Tagged level display name captured at compose time. */
  taggedName?: string;
  /** The user-typed comment body, tag stripped. */
  body: string;
}

const TAG_REGEX = /^\[Q:([^|\]]+)\|([^\]]+)\]\s*([\s\S]*)$/;

export function parseCommentText(text: string | undefined): ParsedCommentText {
  if (!text) return { body: '' };
  const m = TAG_REGEX.exec(text);
  if (!m) return { body: text };
  return {
    taggedLevelId: m[1],
    taggedName: m[2],
    body: m[3] ?? '',
  };
}

/** Serialize a body + optional tag back into the storage token format. */
export function serializeCommentText(body: string, tag?: { id: string; name: string }): string {
  if (!tag) return body;
  // Escape the closing-bracket and pipe in the display name so a question
  // titled "What [is] it?" doesn't break the parser. Safe replacements,
  // assessor never sees them rendered (we re-decode on parse).
  const safeName = tag.name.replace(/]/g, '\\]').replace(/\|/g, '\\|');
  return `[Q:${tag.id}|${safeName}] ${body}`;
}
