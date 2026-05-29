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
} from '@fluentui/react-icons';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LevelNode } from './treeBuilder';
import {
  LEVEL_TYPE_LABEL,
  LEVEL_TYPE_PALETTE,
  DATA_TYPE_LABEL,
  allowedChildren,
  type LevelType,
  type DataType,
} from './levelTypes';
import { parseOptions } from './options';
import { parseVisibility } from './visibility';

const useStyles = makeStyles({
  node: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    transition: 'background-color 0.12s ease, border 0.12s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      border: '0.5px solid var(--color-border-secondary)',
    },
    ':hover .level-actions': {
      opacity: 1,
    },
    ':hover .level-drag-handle': {
      opacity: 1,
    },
  },
  rowDragging: {
    /* While the row is being dragged it floats above the rest. */
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-purple)',
    boxShadow: '0 4px 12px rgba(127, 119, 221, 0.2)',
    zIndex: 10,
    position: 'relative',
  },
  dragHandle: {
    width: '20px',
    height: '24px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-tertiary)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'grab',
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.1s ease, color 0.1s ease, background-color 0.1s ease',
    touchAction: 'none',
    ':hover': {
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-background-tertiary)',
    },
    ':active': {
      cursor: 'grabbing',
    },
  },
  chevronBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
    ':hover': {
      backgroundColor: 'var(--color-background-tertiary)',
      color: 'var(--color-text-primary)',
    },
  },
  chevronSpacer: { width: '20px', height: '20px', flexShrink: 0 },
  typePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  name: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  metaDot: {
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-text-tertiary)',
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
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    ':hover': {
      backgroundColor: 'var(--color-background-tertiary)',
      color: 'var(--color-text-primary)',
    },
  },
  children: {
    marginLeft: '24px',
    marginTop: '6px',
    paddingLeft: '12px',
    borderLeft: '0.5px dashed var(--color-border-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  letterDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-purple)',
    flexShrink: 0,
  },
  conditionalPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '1px 6px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '10px',
    fontWeight: 500,
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  requiredAsterisk: {
    color: 'var(--color-red)',
    fontWeight: 500,
  },
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
}

export function LevelTreeNode({
  node,
  onAddChild,
  onEdit,
  onDelete,
  onDuplicate,
  duplicatingId,
}: Props) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);
  const { level } = node;
  const levelType = (level.dnx_assessment_level_type ?? 1) as LevelType;
  const palette = LEVEL_TYPE_PALETTE[levelType];
  const dataType = level.dnx_data_type;
  const allowChildren = allowedChildren(levelType);
  const hasChildren = node.children.length > 0;
  const optionCount =
    levelType === 3 && (dataType === 1 || dataType === 2)
      ? parseOptions(level.dnx_option_set_reference).length
      : 0;
  const visibility =
    levelType === 3 ? parseVisibility(level.dnx_visibility_condition) : undefined;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level.dnx_assessment_levelid });

  // Use Translate (not Transform) so the dragged row only moves — never scales.
  // Variable-height siblings (an expanded section next to a tiny question) would
  // otherwise squish/stretch as dnd-kit tries to size the drag image to its
  // over-target.
  const rowStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} className={styles.node} style={rowStyle}>
      <div className={`${styles.row} ${isDragging ? styles.rowDragging : ''}`}>
        <Tooltip
          content="Drag to reorder"
          relationship="label"
          positioning="below"
          withArrow
        >
          <button
            type="button"
            className={`${styles.dragHandle} level-drag-handle`}
            {...attributes}
            {...listeners}
          >
            <ReOrderDotsVertical16Regular />
          </button>
        </Tooltip>
        {hasChildren ? (
          <Tooltip
            content={expanded ? 'Collapse' : 'Expand'}
            relationship="label"
            positioning="below"
            withArrow
          >
            <button
              type="button"
              className={styles.chevronBtn}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
            </button>
          </Tooltip>
        ) : (
          <span className={styles.chevronSpacer} />
        )}

        <span
          className={styles.typePill}
          style={{ backgroundColor: palette.bg, color: palette.color }}
        >
          {LEVEL_TYPE_LABEL[levelType]}
        </span>

        <div className={styles.textCol}>
          <div className={styles.name}>
            {level.dnx_name}
            {level.dnx_is_required && (
              <span className={styles.requiredAsterisk} title="Required">
                {' *'}
              </span>
            )}
            {level.dnx_include_in_letter && (
              <span
                title="Included in outcome letter"
                style={{ display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}
              >
                <span className={styles.letterDot} />
              </span>
            )}
          </div>
          <div className={styles.meta}>
            {dataType !== undefined && dataType !== null && levelType === 3 && (
              <span>{DATA_TYPE_LABEL[dataType as DataType]}</span>
            )}
            {optionCount > 0 && (
              <>
                <span className={styles.metaDot} />
                <span>
                  {optionCount} {optionCount === 1 ? 'option' : 'options'}
                </span>
              </>
            )}
            {visibility && (
              <>
                <span className={styles.metaDot} />
                <span
                  className={styles.conditionalPill}
                  title={`Shown when "${visibility.showWhen.questionLabel ?? 'a parent question'}" ${visibility.showWhen.operator === 'equals' ? '=' : '≠'} "${visibility.showWhen.value}"`}
                >
                  Conditional
                </span>
              </>
            )}
            {level.dnx_hint_text && (
              <>
                {(dataType !== undefined && dataType !== null && levelType === 3) ||
                optionCount > 0 ? (
                  <span className={styles.metaDot} />
                ) : null}
                <span>{level.dnx_hint_text}</span>
              </>
            )}
            {hasChildren && (
              <>
                <span className={styles.metaDot} />
                <span>
                  {node.children.length} {node.children.length === 1 ? 'item' : 'items'}
                </span>
              </>
            )}
          </div>
        </div>

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
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => onEdit(node)}
            >
              <Edit16Regular />
            </button>
          </Tooltip>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Tooltip
                content="More actions"
                relationship="label"
                positioning="below"
                withArrow
              >
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
                  style={{ color: 'var(--color-red-text)' }}
                  icon={<Delete16Regular />}
                >
                  Delete
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </div>

      {hasChildren && expanded && (
        <SortableContext
          items={node.children.map((c) => c.level.dnx_assessment_levelid)}
          strategy={verticalListSortingStrategy}
        >
          <div className={styles.children}>
            {node.children.map((child) => (
              <LevelTreeNode
                key={child.level.dnx_assessment_levelid}
                node={child}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                duplicatingId={duplicatingId}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
