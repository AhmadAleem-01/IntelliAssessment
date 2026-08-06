/**
 * Per-level "details layout" model.
 *
 * A Section or Subsection can carry an ordered list of application-details JSON
 * attributes to surface at assessment time (a read-only reference panel). The
 * author builds this list by drag-drop in the Details tab; it persists as JSON
 * in the level's `dnx_details_layout` text column. Same tolerant parse/serialize
 * shape as `letterLayout.ts` — bad JSON or malformed entries collapse to an
 * empty layout so a level with no/garbage config just shows no panel.
 */

import type { AppDataPath } from './appData';

export interface DetailsField {
  /** Client-only stable id for drag-drop keying (not persistence-critical). */
  id: string;
  /** The application-details path to resolve + show, e.g. `applicant.name`. */
  path: AppDataPath;
  /** Optional label override; falls back to the flattened field's label. */
  label?: string;
}

export interface DetailsLayout {
  version: 1;
  fields: DetailsField[];
  /**
   * Fixed **0-based array index** this panel's repeating (`[]`) paths resolve
   * at. Use when a fixed subsection maps to one element of a JSON array — e.g.
   * three "Qualification N" subsections each pinned to `qualifications[0/1/2]`.
   * Undefined = default behaviour: repeating paths render *one block per item*.
   * (Authored 1-based in the UI; stored 0-based.)
   */
  arrayIndex?: number;
}

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `df-${Date.now().toString(36)}-${idCounter}`;
}

export function makeDetailsField(path: AppDataPath, label?: string): DetailsField {
  return { id: newId(), path, label };
}

/**
 * Parse the stored JSON into a DetailsLayout. Tolerant: bad JSON, wrong shape,
 * or malformed entries yield `undefined` (caller treats as "no panel"); good
 * entries with a string `path` survive, others are dropped.
 */
export function parseDetailsLayout(stored: string | null | undefined): DetailsLayout | undefined {
  if (!stored) return undefined;
  const trimmed = stored.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const rawFields = Array.isArray(parsed.fields) ? parsed.fields : null;
    if (!rawFields) return undefined;
    const fields: DetailsField[] = [];
    for (const raw of rawFields) {
      if (!raw || typeof raw !== 'object') continue;
      const f = raw as Record<string, unknown>;
      const path = typeof f.path === 'string' ? f.path.trim() : '';
      if (!path) continue;
      fields.push({
        id: typeof f.id === 'string' && f.id ? f.id : newId(),
        path,
        label: typeof f.label === 'string' && f.label ? f.label : undefined,
      });
    }
    if (fields.length === 0) return undefined;
    const arrayIndex =
      typeof parsed.arrayIndex === 'number' &&
      Number.isInteger(parsed.arrayIndex) &&
      parsed.arrayIndex >= 0
        ? parsed.arrayIndex
        : undefined;
    return { version: 1, fields, arrayIndex };
  } catch {
    return undefined;
  }
}

export function serializeDetailsLayout(layout: DetailsLayout): string {
  return JSON.stringify({
    version: 1,
    fields: layout.fields.map((f) => ({ id: f.id, path: f.path, label: f.label })),
    ...(layout.arrayIndex !== undefined ? { arrayIndex: layout.arrayIndex } : {}),
  });
}
