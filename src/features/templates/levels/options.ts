/**
 * Custom option-set storage helpers.
 *
 * Inline option lists are stored in the existing `dnx_option_set_reference`
 * text column as a JSON-encoded array of label strings. Example:
 *
 *   `["Yes","No","Not applicable"]`
 *
 * Storing JSON in the existing column avoids a Dataverse schema change. A
 * legacy plain-text value (e.g. a Dataverse choice logical name) is parsed
 * as a single-entry list so we never lose data.
 */

export function parseOptions(stored: string | undefined | null): string[] {
  if (!stored) return [];
  const trimmed = stored.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === 'string' ? v : String(v)))
          .filter((v) => v.length > 0);
      }
    } catch {
      // Fall through and treat as a single legacy value.
    }
  }
  return [trimmed];
}

export function serializeOptions(options: string[]): string | undefined {
  const cleaned = options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (cleaned.length === 0) return undefined;
  return JSON.stringify(cleaned);
}
