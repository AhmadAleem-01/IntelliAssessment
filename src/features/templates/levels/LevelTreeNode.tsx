import { useState } from 'react';
import { makeStyles, Menu, MenuList, MenuPopover, MenuTrigger, MenuItem } from '@fluentui/react-components';
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  MoreVertical16Regular,
  Add16Regular,
  Edit16Regular,
  Delete16Regular,
} from '@fluentui/react-icons';
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
}

export function LevelTreeNode({ node, onAddChild, onEdit, onDelete }: Props) {
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

  return (
    <div className={styles.node}>
      <div className={styles.row}>
        {hasChildren ? (
          <button
            type="button"
            className={styles.chevronBtn}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
          </button>
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
                <button type="button" className={styles.iconBtn} aria-label="Add child">
                  <Add16Regular />
                </button>
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
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Edit"
            onClick={() => onEdit(node)}
          >
            <Edit16Regular />
          </button>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <button type="button" className={styles.iconBtn} aria-label="More actions">
                <MoreVertical16Regular />
              </button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  onClick={() => onDelete(node)}
                  style={{ color: 'var(--color-red-text)' }}
                >
                  <Delete16Regular /> &nbsp;Delete
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className={styles.children}>
          {node.children.map((child) => (
            <LevelTreeNode
              key={child.level.dnx_assessment_levelid}
              node={child}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
