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
