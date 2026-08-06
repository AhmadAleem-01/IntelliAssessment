/**
 * Application-details JSON core (shared, pure — no React/network).
 *
 * An assessment carries a structured "application details" JSON object whose
 * shape is fixed per template (the template stores a *sample* of it). This
 * module turns that sample into a pickable, flattened field catalog (so authors
 * never type paths by hand), and resolves those paths against a real instance's
 * JSON at render / AI time.
 *
 * Path syntax (a readable dot-path, not RFC-6901):
 *   applicant.name          object property
 *   quals[].title           "each item" of an array — REPEATING (display shows
 *                           the first; AI/read can resolve per index)
 *   quals[0].title          a specific array index
 *
 * Kept dependency-free and deterministic so it's easy to unit-test and reuse
 * from the template builder, the AI prompt assembly, and the assessment render.
 */

/** A dot-path into the application-details JSON. */
export type AppDataPath = string;

/** One selectable field derived from the template's sample JSON. */
export interface AppDataField {
  /** Canonical path, e.g. `applicant.name` or `quals[].title`. */
  path: AppDataPath;
  /** Human label — the leaf key, title-cased (e.g. "Title" for quals[].title). */
  label: string;
  /** A sample value from the template's sample JSON, for preview. */
  sampleValue: string;
  /** True when the path crosses an array (contains `[]`) — repeats per item. */
  isRepeating: boolean;
}

/** Tolerant JSON.parse for a stored application-details / sample string. */
export function parseAppData(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const MAX_DEPTH = 8; // guard against pathological / cyclic-looking sample data

/**
 * Flatten a sample JSON object into a de-duplicated list of leaf fields. Arrays
 * collapse to a single `[]` "each item" path (we only need the shape, not every
 * element) — the first element drives the discovered sub-shape and the sample
 * value. Scalars and empty arrays/objects become leaves themselves.
 */
export function flattenSchema(sample: Record<string, unknown> | null): AppDataField[] {
  if (!sample) return [];
  const out: AppDataField[] = [];
  const seen = new Set<AppDataPath>();

  const push = (path: string, value: unknown, repeating: boolean) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({
      path,
      label: labelForPath(path),
      sampleValue: formatValue(value),
      isRepeating: repeating,
    });
  };

  const walk = (node: unknown, path: string, repeating: boolean, depth: number) => {
    if (depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      // Represent the array as "each item": recurse into the first element under
      // a `[]` segment. An empty array is a leaf (nothing to show).
      if (node.length === 0) {
        push(path, node, repeating);
        return;
      }
      walk(node[0], `${path}[]`, true, depth + 1);
      return;
    }
    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      if (entries.length === 0) {
        push(path, node, repeating);
        return;
      }
      for (const [key, val] of entries) {
        walk(val, path ? `${path}.${key}` : key, repeating, depth + 1);
      }
      return;
    }
    // Scalar leaf.
    push(path, node, repeating);
  };

  walk(sample, '', false, 0);
  return out;
}

/** Split a path into segments, treating `[]`/`[n]` as their own tokens. */
function splitPath(path: string): string[] {
  // "quals[0].title" → ["quals", "[0]", "title"]; "quals[].title" → ["quals","[]","title"]
  return path
    .replace(/\[(\d*)\]/g, '.[$1]')
    .split('.')
    .filter(Boolean);
}

/**
 * Resolve a path against a real instance's JSON.
 *
 * `[]` means "the first item" (used for display of a repeating field in a
 * non-repeating context); `[n]` selects an explicit index. Returns `undefined`
 * for any miss so callers can render an em-dash / skip the attribute.
 */
export function resolvePath(root: unknown, path: AppDataPath): unknown {
  let cur: unknown = root;
  for (const seg of splitPath(path)) {
    if (cur == null) return undefined;
    const idxMatch = /^\[(\d*)\]$/.exec(seg);
    if (idxMatch) {
      if (!Array.isArray(cur)) return undefined;
      const idx = idxMatch[1] === '' ? 0 : Number(idxMatch[1]);
      cur = cur[idx];
    } else {
      if (typeof cur !== 'object' || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

/** True when a path iterates an array (contains an empty `[]` segment). */
export function isRepeatingPath(path: AppDataPath): boolean {
  return /\[\]/.test(path);
}

/**
 * Length of the array a repeating (`[]`) path iterates — i.e. how many items a
 * repeating details panel should render. Resolves the prefix up to (and
 * including) the FIRST `[]` array, and returns its length. 0 for a
 * non-repeating path, a missing prefix, or a non-array.
 */
export function arrayLengthForPath(root: unknown, path: AppDataPath): number {
  const first = path.indexOf('[]');
  if (first < 0) return 0;
  // The array itself is at the prefix before `[]` (strip the trailing dot).
  const prefix = path.slice(0, first).replace(/\.$/, '');
  const arr = prefix ? resolvePath(root, prefix) : root;
  return Array.isArray(arr) ? arr.length : 0;
}

/**
 * Resolve a repeating path at a specific array index by substituting the FIRST
 * empty `[]` with `[index]`. A non-repeating path ignores `index` and resolves
 * as-is (so mixed scalar/repeating fields both work through one call).
 */
export function resolvePathAt(root: unknown, path: AppDataPath, index: number): unknown {
  const concrete = path.replace('[]', `[${index}]`);
  return resolvePath(root, concrete);
}

/** Resolve several paths into a `{ path: displayString }` map, skipping misses. */
export function resolvePaths(
  root: unknown,
  paths: AppDataPath[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of paths) {
    const v = resolvePath(root, p);
    if (v !== undefined) out[p] = formatValue(v);
  }
  return out;
}

/**
 * Of the given paths, which do NOT resolve to a value in `root` (i.e. would
 * render as an em-dash / be skipped by the AI). Used to warn an assessor that
 * their uploaded application-details file is missing attributes the template
 * actually relies on. De-duplicated, original order preserved.
 */
export function missingPaths(root: unknown, paths: AppDataPath[]): AppDataPath[] {
  const seen = new Set<AppDataPath>();
  const out: AppDataPath[] = [];
  for (const p of paths) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (resolvePath(root, p) === undefined) out.push(p);
  }
  return out;
}

/** Display coercion for a resolved value. Objects/arrays are JSON-compacted. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    // Array of scalars → comma list; otherwise compact JSON.
    return v.every((x) => typeof x !== 'object' || x === null)
      ? v.map((x) => formatValue(x)).join(', ')
      : JSON.stringify(v);
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Title-case the leaf segment of a path for a friendly label. */
function labelForPath(path: string): string {
  const segs = splitPath(path).filter((s) => !/^\[\d*\]$/.test(s));
  const leaf = segs[segs.length - 1] ?? path;
  return leaf
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
