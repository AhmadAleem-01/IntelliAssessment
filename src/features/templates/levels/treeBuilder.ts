import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';
import { lookupId } from '../../../lib/dataverse';

export interface LevelNode {
  level: Dnx_assessment_levels;
  children: LevelNode[];
}

/**
 * Build a sorted tree of top-level Sections and their descendants.
 *
 * The flat list comes back ordered by `dnx_assessment_level_order` already, but
 * we re-sort within each parent bucket to be defensive in case of holes.
 *
 * Root-typed levels (type === 0) are filtered out — they're a metadata container
 * not authored in the tree editor.
 */
export function buildTree(levels: Dnx_assessment_levels[] | undefined): LevelNode[] {
  if (!levels || levels.length === 0) return [];

  // Index every authored level (skip implicit root if present).
  const byId = new Map<string, LevelNode>();
  for (const level of levels) {
    if (level.dnx_assessment_level_type === 0) continue;
    byId.set(level.dnx_assessment_levelid, { level, children: [] });
  }

  const roots: LevelNode[] = [];
  for (const node of byId.values()) {
    const parentId = lookupId(node.level, 'dnx_parent_assessment_level');
    // Treat null-parent OR parent that's the implicit Root as a top-level Section.
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort each bucket by order (numeric) then by createdon as tiebreaker.
  const sortBucket = (arr: LevelNode[]) => {
    arr.sort((a, b) => {
      const oa = a.level.dnx_assessment_level_order ?? 0;
      const ob = b.level.dnx_assessment_level_order ?? 0;
      if (oa !== ob) return oa - ob;
      const ca = a.level.createdon ?? '';
      const cb = b.level.createdon ?? '';
      return ca.localeCompare(cb);
    });
    arr.forEach((n) => sortBucket(n.children));
  };
  sortBucket(roots);

  return roots;
}

/** Flatten a subtree into an array of GUIDs (used to cascade-delete). */
export function descendantIds(node: LevelNode): string[] {
  const ids: string[] = [];
  const walk = (n: LevelNode) => {
    for (const c of n.children) {
      ids.push(c.level.dnx_assessment_levelid);
      walk(c);
    }
  };
  walk(node);
  return ids;
}

/** Highest order value among a sibling bucket, plus 1. Used when adding new levels. */
export function nextOrder(siblings: LevelNode[]): number {
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((s) => s.level.dnx_assessment_level_order ?? 0)) + 1;
}

/**
 * The 0-based position of a question's enclosing **subsection** among its
 * same-typed siblings — e.g. the 3rd "Qualification N" subsection returns 2.
 *
 * Used by the AI-conditioning "use this subsection's position" binding: a
 * repeating attribute path (`qualifications[]`) is resolved at this index so
 * the question reads its own array item rather than always the first.
 *
 * Resolution is by **structure order** (sibling position), not by parsing the
 * name — robust if a subsection is renamed. Returns 0 when the question isn't
 * under a subsection (no repeating context), so callers fall back to item 0.
 */
export function subsectionIndexOf(
  levels: Dnx_assessment_levels[] | undefined,
  questionLevelId: string,
): number {
  if (!levels) return 0;
  const byId = new Map(levels.map((l) => [l.dnx_assessment_levelid, l] as const));
  // Walk up to the nearest Subsection (type 2) ancestor.
  let cur = byId.get(questionLevelId);
  let subsection: Dnx_assessment_levels | undefined;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur.dnx_assessment_level_type === 2) {
      subsection = cur;
      break;
    }
    const pid = lookupId(cur, 'dnx_parent_assessment_level');
    cur = pid ? byId.get(pid) : undefined;
  }
  if (!subsection) return 0;
  // Position among Subsection siblings sharing the same parent, ordered.
  const parentId = lookupId(subsection, 'dnx_parent_assessment_level') ?? null;
  const siblings = levels
    .filter(
      (l) =>
        l.dnx_assessment_level_type === 2 &&
        (lookupId(l, 'dnx_parent_assessment_level') ?? null) === parentId,
    )
    .sort(
      (a, b) =>
        (a.dnx_assessment_level_order ?? 0) - (b.dnx_assessment_level_order ?? 0) ||
        (a.createdon ?? '').localeCompare(b.createdon ?? ''),
    );
  const idx = siblings.findIndex(
    (l) => l.dnx_assessment_levelid === subsection!.dnx_assessment_levelid,
  );
  return idx < 0 ? 0 : idx;
}

/**
 * Locate the sibling bucket (parent's children) that contains a given level id,
 * along with that level's index within the bucket. Returns `undefined` if not
 * found anywhere in the tree. The bucket is returned by reference so callers
 * can compute reorder operations without re-walking the tree.
 *
 * `parent` is the LevelNode whose `children` array IS this bucket — null when
 * the bucket is the top-level `tree` array (i.e. a Section sitting under the
 * template root). Used by cross-parent drag-and-drop to discover the
 * destination parent's GUID.
 */
export function findBucket(
  tree: LevelNode[],
  id: string,
  parent: LevelNode | null = null,
): { bucket: LevelNode[]; index: number; parent: LevelNode | null } | undefined {
  const idx = tree.findIndex((n) => n.level.dnx_assessment_levelid === id);
  if (idx >= 0) return { bucket: tree, index: idx, parent };
  for (const node of tree) {
    const found = findBucket(node.children, id, node);
    if (found) return found;
  }
  return undefined;
}
