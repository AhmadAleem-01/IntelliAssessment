import { useMemo } from 'react';
import {
  Button,
  Input,
  Checkbox,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import { lookupId } from '../../lib/dataverse';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { ScoringGroup } from './types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  empty: {
    fontSize: '11px',
    color: 'var(--ds-text-body)',
    padding: '8px 10px',
    border: '0.5px dashed var(--ds-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-surface-card)',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '10px 12px',
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-surface-card)',
  },
  groupHeader: {
    display: 'grid',
    // Min to pass needs ~130px to fit the number + spinner without Fluent's
    // intrinsic min-width pushing the cell past its declared track.
    gridTemplateColumns: '1fr 130px auto',
    gap: '10px',
    alignItems: 'center',
    '> *': { minWidth: 0 },
  },
  fluidInput: {
    width: '100%',
    minWidth: 0,
  },
  groupHeaderLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '4px',
  },
  membersLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  members: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '160px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  memberRow: {
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  memberPath: {
    fontSize: '10px',
    color: 'var(--ds-text-muted)',
    fontStyle: 'italic',
  },
  addBtn: {
    alignSelf: 'flex-start',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  validationHint: {
    fontSize: '10px',
    color: '#b45309',
  },
});

interface Props {
  /** The parent level whose groups are being authored. */
  level: Dnx_assessment_levels;
  groups: ScoringGroup[];
  onChange: (groups: ScoringGroup[]) => void;
}

interface EligibleMember {
  levelId: string;
  name: string;
  path: string;
}

/**
 * Flatten a subtree to descendant Question levels. Only Questions can be
 * group members (subsection-as-member is a future variant). Path string
 * is the breadcrumb above the question so duplicate question names are
 * disambiguated in the picker.
 */
function descendantQuestions(node: LevelNode, prefix: string[]): EligibleMember[] {
  const out: EligibleMember[] = [];
  for (const child of node.children) {
    const childType = child.level.dnx_assessment_level_type ?? 1;
    if (childType === 3) {
      out.push({
        levelId: child.level.dnx_assessment_levelid,
        name: child.level.dnx_name,
        path: prefix.join(' › '),
      });
    } else {
      out.push(...descendantQuestions(child, [...prefix, child.level.dnx_name]));
    }
  }
  return out;
}

export function GroupListEditor({ level, groups, onChange }: Props) {
  const styles = useStyles();
  const templateId = lookupId(level, 'dnx_assessment_template');
  const { data: levels } = useTemplateLevels(templateId);

  // Walk the template tree, find this level's node, then enumerate its
  // descendant Questions. Done in a memo because the template's flat level
  // list rarely changes during editing but flattening isn't free.
  const eligible: EligibleMember[] = useMemo(() => {
    if (!levels) return [];
    const tree = buildTree(levels);
    const find = (nodes: LevelNode[]): LevelNode | undefined => {
      for (const n of nodes) {
        if (n.level.dnx_assessment_levelid === level.dnx_assessment_levelid) return n;
        const found = find(n.children);
        if (found) return found;
      }
      return undefined;
    };
    const node = find(tree);
    if (!node) {
      // Root level — descend over all top-level sections.
      if (level.dnx_assessment_level_type === 0) {
        return tree.flatMap((sec) => descendantQuestions(sec, [sec.level.dnx_name]));
      }
      return [];
    }
    return descendantQuestions(node, []);
  }, [levels, level]);

  function patchGroup(index: number, patch: Partial<ScoringGroup>) {
    const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
    onChange(next);
  }

  function removeGroup(index: number) {
    onChange(groups.filter((_, i) => i !== index));
  }

  function addGroup() {
    onChange([
      ...groups,
      {
        name: `Group ${groups.length + 1}`,
        minToPass: 1,
        memberLevelIds: [],
      },
    ]);
  }

  function toggleMember(groupIndex: number, memberLevelId: string, checked: boolean) {
    const group = groups[groupIndex];
    const next = checked
      ? Array.from(new Set([...group.memberLevelIds, memberLevelId]))
      : group.memberLevelIds.filter((id) => id !== memberLevelId);
    patchGroup(groupIndex, { memberLevelIds: next });
  }

  return (
    <div className={styles.root}>
      {groups.length === 0 && (
        <div className={styles.empty}>
          No groups yet. Add one to define a "minimum N of M questions" rule.
          Ungrouped questions on this level still need to pass individually.
        </div>
      )}

      {groups.map((group, idx) => {
        const memberCount = group.memberLevelIds.length;
        const minInvalid = group.minToPass > memberCount;
        return (
          <div key={idx} className={styles.group}>
            <div className={styles.groupHeader}>
              <div>
                <div className={styles.groupHeaderLabel}>Group name</div>
                <Input
                  className={styles.fluidInput}
                  value={group.name}
                  onChange={(_, d) => patchGroup(idx, { name: d.value })}
                  placeholder="e.g. Identity documents"
                />
              </div>
              <div>
                <div className={styles.groupHeaderLabel}>Min to pass</div>
                <Input
                  className={styles.fluidInput}
                  type="number"
                  value={String(group.minToPass)}
                  onChange={(_, d) => {
                    const n = parseInt(d.value, 10);
                    patchGroup(idx, {
                      minToPass: Number.isFinite(n) && n > 0 ? n : 1,
                    });
                  }}
                  min={1}
                />
              </div>
              <Button
                appearance="subtle"
                icon={<Delete16Regular />}
                onClick={() => removeGroup(idx)}
                title="Remove group"
              />
            </div>

            <div>
              <div className={styles.membersLabel}>Members</div>
              <div className={styles.members}>
                {eligible.length === 0 && (
                  <div className={styles.empty}>
                    No descendant questions to pick from. Add questions under this level first.
                  </div>
                )}
                {eligible.map((m) => (
                  <label key={m.levelId} className={styles.memberRow}>
                    <Checkbox
                      checked={group.memberLevelIds.includes(m.levelId)}
                      onChange={(_, d) =>
                        toggleMember(idx, m.levelId, Boolean(d.checked))
                      }
                    />
                    <span>
                      {m.name}{' '}
                      {m.path && <span className={styles.memberPath}>· {m.path}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {minInvalid && (
              <div className={styles.validationHint}>
                Min to pass ({group.minToPass}) is greater than member count ({memberCount}).
                This group can never pass.
              </div>
            )}
          </div>
        );
      })}

      <div className={styles.toolbar}>
        <Button
          appearance="secondary"
          icon={<Add16Regular />}
          onClick={addGroup}
          className={styles.addBtn}
        >
          Add group
        </Button>
      </div>
    </div>
  );
}
