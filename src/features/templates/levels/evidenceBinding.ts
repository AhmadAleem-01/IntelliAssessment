/**
 * Evidence binding — author-time configuration that tells the AI auto-fill
 * pipeline (M6b) HOW to answer a Question from uploaded evidence.
 *
 * Stored as JSON in `dnx_document_type_reference`. We reuse that existing
 * column (same trick as options + visibility) so this ships without a Dataverse
 * schema change. The column historically held a loose "document type refs"
 * string; this supersedes that with a structured shape.
 *
 * ## Model
 *
 * The template author does NOT know the real uploaded file names — those only
 * exist at assessment time. Instead each Question declares a **file variable**:
 * a stable placeholder (e.g. `q1-resume`) that the assessor maps to a real
 * uploaded file when they run the assessment. Alongside it the author writes a
 * **query**: a natural-language instruction describing what to extract and how
 * to turn it into this question's answer.
 *
 *   fileVariable: "q1-resume"
 *   query:        "If the extracted text contains a bachelor's degree, set true."
 *
 * v1 supports a single file variable per question. The shape is forward-
 * compatible — a future version can widen `fileVariable` to an array, or add an
 * `applicationDataQuery` field for the JSON-application-details scenario, without
 * breaking this parser.
 *
 * ## Back-compat
 *
 * A legacy plain-string value (old document-type-reference content, or a stray
 * non-JSON string) is preserved as the `query` so authored intent is never
 * silently dropped. It re-serialises into the new JSON shape on next save.
 */

export interface EvidenceBinding {
  /** Placeholder file name the assessor maps to a real upload at runtime. */
  fileVariable: string;
  /** Natural-language extraction + answer instruction for the AI. */
  query: string;
}

/** True when a binding carries anything worth persisting. */
export function isEmptyBinding(b: EvidenceBinding | undefined): boolean {
  if (!b) return true;
  return !b.fileVariable.trim() && !b.query.trim();
}

export function parseEvidenceBinding(
  stored: string | undefined | null,
): EvidenceBinding | undefined {
  if (!stored) return undefined;
  const trimmed = stored.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        const fileVariable =
          typeof parsed.fileVariable === 'string' ? parsed.fileVariable : '';
        const query = typeof parsed.query === 'string' ? parsed.query : '';
        if (fileVariable || query) return { fileVariable, query };
      }
    } catch {
      /* fall through — treat as legacy plain text */
    }
  }

  // Legacy / non-JSON content: keep it as the query so intent survives.
  return { fileVariable: '', query: trimmed };
}

export function serializeEvidenceBinding(
  binding: EvidenceBinding | undefined,
): string | undefined {
  if (isEmptyBinding(binding)) return undefined;
  const clean: EvidenceBinding = {
    fileVariable: binding!.fileVariable.trim(),
    query: binding!.query.trim(),
  };
  return JSON.stringify(clean);
}
