import { useState } from 'react';
import {
  makeStyles,
  Menu,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuItem,
  Tooltip,
} from '@fluentui/react-components';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  MoreVertical16Regular,
  Add16Regular,
  Edit16Regular,
  Delete16Regular,
  Copy16Regular,
  ReOrderDotsVertical16Regular,
  DocumentText16Regular,
} from '@fluentui/react-icons';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LevelNode } from './treeBuilder';
import {
  LEVEL_TYPE_LABEL,
  allowedChildren,
  type LevelType,
  type DataType,
} from './levelTypes';
import { parseOptions } from './options';
import { parseVisibility } from './visibility';
import { parseEvidenceBinding } from './evidenceBinding';

/*
 * A single row in the template structure tree — Design System v1.0.
 *
 * Three row shapes (design.md / template-editor mockup):
 *   Section     → dark navy "S" square badge + name + "N items" subtitle.
 *   Subsection  → light-violet chevron chip + name + "N items" subtitle.
 *   Question    → small grey dot + name + REQUIRED/AI badges + hint subtitle,
 *                 with the data type as a right-aligned monospace label.
 * Rows are full-width and separated by hairlines (the parent card owns the
 * outer border); nesting is by left indentation. Drag handle sits far right.
 */

// Short, assessment-time-friendly type labels (the mockup uses these, not the
// verbose "Option set (single)" form).
const TYPE_LABEL_SHORT: Record<DataType, string> = {
  0: 'Boolean',
  1: 'Single select',
  2: 'Multi select',
  3: 'Text',
  4: 'Date',
};

const useStyles = makeStyles({
  node: { display: 'flex', flexDirection: 'column' },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderBottom: '1px solid var(--ds-border)',
    transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':hover .level-actions': { opacity: 1 },
    ':hover .level-drag-handle': { opacity: 1 },
  },
  rowSection: { backgroundColor: 'var(--ds-surface-base)' },
  rowDragging: {
    backgroundColor: 'var(--ds-surface-card)',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--ds-ai-primary, #8B5CF6)',
    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.18)',
    zIndex: 10,
    position: 'relative',
  },

  chevronBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ds-text-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    ':hover': { color: 'var(--ds-text-strong)' },
  },
  chevronSpacer: { width: '20px', height: '20px', flexShrink: 0 },

  /* Section "S" badge — dark navy square */
  sectionBadge: {
    width: '26px',
    height: '26px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: 'var(--ds-brand-primary)',
    flexShrink: 0,
  },
  /* Subsection chevron chip — light violet rounded square */
  subChip: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    ':hover': { backgroundColor: '#ece7fe' },
  },
  /* Question leaf marker — small grey dot */
  qDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--ds-border-strong, #cbd5e1)',
    flexShrink: 0,
    marginLeft: '9px',
    marginRight: '9px',
  },

  textCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  nameRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 },
  sectionName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  questionName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  /* Badges */
  reqBadge: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-pending-text, #b45309)',
    flexShrink: 0,
  },
  aiBadge: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.03em',
    color: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    borderRadius: 'var(--ds-radius-pill)',
    padding: '2px 8px',
    flexShrink: 0,
  },
  conditionalPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1px 7px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '10px',
    fontWeight: 600,
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    color: 'var(--ds-pending-text, #b45309)',
    flexShrink: 0,
  },
  letterIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--ds-brand-accent)',
    flexShrink: 0,
    '& svg': { width: '15px', height: '15px' },
  },

  /* Right-aligned monospace data type label */
  typeLabel: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '12px',
    color: 'var(--ds-text-muted)',
    flexShrink: 0,
    marginLeft: 'auto',
    whiteSpace: 'nowrap',
  },

  actions: {
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.1s ease',
    flexShrink: 0,
  },
  iconBtn: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--ds-text-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    ':hover': { backgroundColor: 'var(--ds-surface-card)', color: 'var(--ds-text-strong)' },
  },
  dragHandle: {
    width: '22px',
    height: '24px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ds-text-muted)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'grab',
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.1s ease, color 0.1s ease',
    touchAction: 'none',
    ':hover': { color: 'var(--ds-text-strong)' },
    ':active': { cursor: 'grabbing' },
  },

  /* Children indent — no dashed rule, just left padding (matches mockup) */
  children: { display: 'flex', flexDirection: 'column' },
  indent1: { paddingLeft: '20px' },
});

interface Props {
  node: LevelNode;
  /** Add a child to this node. */
  onAddChild: (parent: LevelNode, childType: LevelType) => void;
  onEdit: (node: LevelNode) => void;
  onDelete: (node: LevelNode) => void;
  onDuplicate: (node: LevelNode) => void;
  /**
   * Marker so all nodes know a duplicate is in flight (disables the menu item
   * everywhere). Set to '*' while pending, null otherwise.
   */
  duplicatingId: string | null;
  /** Nesting depth — drives the left indent of child buckets. Root = 0. */
  depth?: number;
  /**
   * Counter bumped by the parent's "Collapse all / Expand all". When it
   * changes, this node applies `foldTo`. Threaded down so the whole tree
   * folds/unfolds at once.
   */
  foldSignal?: number;
  /** Target state to apply when `foldSignal` advances. */
  foldTo?: 'expanded' | 'collapsed';
}

export function LevelTreeNode({
  node,
  onAddChild,
  onEdit,
  onDelete,
  onDuplicate,
  duplicatingId,
  depth = 0,
  foldSignal = 0,
  foldTo = 'expanded',
}: Props) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  // Render-time adjust-on-change: fold/unfold when the signal advances,
  // without an effect (keeps us clear of the set-state-in-effect lint rule).
  const [prevSignal, setPrevSignal] = useState(foldSignal);
  if (foldSignal !== prevSignal) {
    setPrevSignal(foldSignal);
    const target = foldTo === 'expanded';
    if (expanded !== target) setExpanded(target);
  }
  const { level } = node;
  const levelType = (level.dnx_assessment_level_type ?? 1) as LevelType;
  const isSection = levelType === 1;
  const isSubsection = levelType === 2;
  const isQuestion = levelType === 3;
  const dataType = level.dnx_data_type;
  const allowChildren = allowedChildren(levelType);
  const hasChildren = node.children.length > 0;
  const childCount = node.children.length;

  const optionCount =
    isQuestion && (dataType === 1 || dataType === 2)
      ? parseOptions(level.dnx_option_set_reference).length
      : 0;
  const visibility = isQuestion ? parseVisibility(level.dnx_visibility_condition) : undefined;
  // "AI" pill when the question carries an evidence query or application-data
  // binding — the same signal the AI-coverage rail counts.
  const binding = isQuestion ? parseEvidenceBinding(level.dnx_document_type_reference) : undefined;
  const isAiBound = !!binding && (binding.query.trim().length > 0 || (binding.applicationDataPaths?.length ?? 0) > 0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.dnx_assessment_levelid });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  // Question subtitle — hint text, else a compact "N options" summary.
  const questionSub =
    level.dnx_hint_text ||
    (optionCount > 0 ? `${optionCount} ${optionCount === 1 ? 'option' : 'options'}` : '');

  return (
    <div ref={setNodeRef} className={styles.node} style={rowStyle}>
      <div
        className={`${styles.row} ${isSection ? styles.rowSection : ''} ${isDragging ? styles.rowDragging : ''}`}
      >
        {/* Leading control: chevron for sections, chevron-chip for subsections,
            grey dot for questions. */}
        {isSection ? (
          <>
            {hasChildren ? (
              <Tooltip content={expanded ? 'Collapse' : 'Expand'} relationship="label" positioning="below" withArrow>
                <button type="button" className={styles.chevronBtn} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                </button>
              </Tooltip>
            ) : (
              <span className={styles.chevronSpacer} />
            )}
            <span className={styles.sectionBadge}>S</span>
          </>
        ) : isSubsection ? (
          <button
            type="button"
            className={styles.subChip}
            onClick={() => hasChildren && setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded && hasChildren ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
          </button>
        ) : (
          <span className={styles.qDot} />
        )}

        <div className={styles.textCol}>
          <div className={styles.nameRow}>
            <span className={isSection || isSubsection ? styles.sectionName : styles.questionName}>
              {level.dnx_name}
            </span>
            {isQuestion && level.dnx_is_required && <span className={styles.reqBadge}>Required</span>}
            {isAiBound && <span className={styles.aiBadge}>AI</span>}
            {visibility && (
              <span
                className={styles.conditionalPill}
                title={`Shown when "${visibility.showWhen.questionLabel ?? 'a parent question'}" ${visibility.showWhen.operator === 'equals' ? '=' : '≠'} "${visibility.showWhen.value}"`}
              >
                Conditional
              </span>
            )}
            {level.dnx_include_in_letter && (
              <Tooltip content="Included in outcome letter" relationship="label" positioning="above" withArrow>
                <span className={styles.letterIcon}>
                  <DocumentText16Regular />
                </span>
              </Tooltip>
            )}
          </div>
          {/* Subtitle */}
          {isQuestion
            ? questionSub && <div className={styles.subtitle}>{questionSub}</div>
            : (hasChildren || childCount === 0) && (
                <div className={styles.subtitle}>
                  {childCount} {childCount === 1 ? 'item' : 'items'}
                </div>
              )}
        </div>

        {/* Right-aligned monospace data type for questions */}
        {isQuestion && dataType !== undefined && dataType !== null && (
          <span className={styles.typeLabel}>{TYPE_LABEL_SHORT[dataType as DataType]}</span>
        )}

        <div className={`${styles.actions} level-actions`}>
          {allowChildren.length > 0 && (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Tooltip
                  content={
                    allowChildren.length === 1
                      ? `Add ${LEVEL_TYPE_LABEL[allowChildren[0]].toLowerCase()}`
                      : `Add ${LEVEL_TYPE_LABEL[allowChildren[0]].toLowerCase()} or ${LEVEL_TYPE_LABEL[allowChildren[1]].toLowerCase()}`
                  }
                  relationship="label"
                  positioning="below"
                  withArrow
                >
                  <button type="button" className={styles.iconBtn}>
                    <Add16Regular />
                  </button>
                </Tooltip>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {allowChildren.map((t) => (
                    <MenuItem key={t} onClick={() => onAddChild(node, t)}>
                      Add {LEVEL_TYPE_LABEL[t].toLowerCase()}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          )}
          <Tooltip
            content={`Edit ${LEVEL_TYPE_LABEL[levelType].toLowerCase()}`}
            relationship="label"
            positioning="below"
            withArrow
          >
            <button type="button" className={styles.iconBtn} onClick={() => onEdit(node)}>
              <Edit16Regular />
            </button>
          </Tooltip>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Tooltip content="More actions" relationship="label" positioning="below" withArrow>
                <button type="button" className={styles.iconBtn}>
                  <MoreVertical16Regular />
                </button>
              </Tooltip>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  onClick={() => onDuplicate(node)}
                  disabled={duplicatingId !== null}
                  icon={<Copy16Regular />}
                >
                  {duplicatingId !== null ? 'Duplicating...' : 'Duplicate'}
                </MenuItem>
                <MenuItem
                  onClick={() => onDelete(node)}
                  style={{ color: 'var(--ds-not-suitable, #EF4444)' }}
                  icon={<Delete16Regular />}
                >
                  Delete
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>

        {/* Drag handle — far right on every row */}
        <Tooltip content="Drag to reorder" relationship="label" positioning="below" withArrow>
          <button
            type="button"
            className={`${styles.dragHandle} level-drag-handle`}
            {...attributes}
            {...listeners}
          >
            <ReOrderDotsVertical16Regular />
          </button>
        </Tooltip>
      </div>

      {hasChildren && expanded && (
        <SortableContext
          items={node.children.map((c) => c.level.dnx_assessment_levelid)}
          strategy={verticalListSortingStrategy}
        >
          <div className={`${styles.children} ${styles.indent1}`}>
            {node.children.map((child) => (
              <LevelTreeNode
                key={child.level.dnx_assessment_levelid}
                node={child}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                duplicatingId={duplicatingId}
                depth={depth + 1}
                foldSignal={foldSignal}
                foldTo={foldTo}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
