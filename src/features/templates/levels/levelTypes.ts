/**
 * Level type + data type maps. The schema enums use numeric codes; this file
 * gives us friendly labels and the icon/color mapping for each.
 */

export type LevelType = 1 | 2 | 3; // Section / Subsection / Question (Root=0 is implicit metadata)

export const LEVEL_TYPE_CODE = {
  Section: 1,
  Subsection: 2,
  Question: 3,
} as const satisfies Record<string, LevelType>;

export const LEVEL_TYPE_LABEL: Record<LevelType, string> = {
  1: 'Section',
  2: 'Subsection',
  3: 'Question',
};

export type DataType = 0 | 1 | 2 | 3 | 4; // Boolean / OptionSet / Multiselect / Text / Date

export const DATA_TYPE_CODE = {
  Boolean: 0,
  OptionSet: 1,
  Multiselect: 2,
  Text: 3,
  Date: 4,
} as const satisfies Record<string, DataType>;

export const DATA_TYPE_LABEL: Record<DataType, string> = {
  0: 'Boolean',
  1: 'Option set (single)',
  2: 'Option set (multi)',
  3: 'Text',
  4: 'Date',
};

/** What child types are allowed under a given parent level type. */
export function allowedChildren(parent: LevelType): LevelType[] {
  switch (parent) {
    case 1: // Section can hold Subsections OR Questions directly
      return [2, 3];
    case 2: // Subsection can only hold Questions
      return [3];
    case 3: // Question is a leaf
      return [];
  }
}

/** Per the PRD: only Question levels carry a data type. */
export function hasDataType(levelType: LevelType): boolean {
  return levelType === 3;
}

/** Soft background + text colors for each level type chip (matches design palette). */
export const LEVEL_TYPE_PALETTE: Record<
  LevelType,
  { bg: string; color: string; border: string }
> = {
  1: {
    bg: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    border: 'var(--color-purple)',
  },
  2: {
    bg: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
    border: 'var(--color-blue)',
  },
  3: {
    bg: 'var(--color-teal-soft)',
    color: 'var(--color-teal-text)',
    border: 'var(--color-teal)',
  },
};
