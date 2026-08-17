import { useMemo, useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  Switch,
  makeStyles,
} from '@fluentui/react-components';
import { ChevronRight16Regular } from '@fluentui/react-icons';
import { useTemplateLevels, useEnsureRootLevel } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import { lookupId } from '../../lib/dataverse';
import type { LevelType } from '../templates/levels/levelTypes';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import {
  useCriteriaForLevels,
  useUpsertCriteria,
  useDeleteCriteria,
} from './api';
import { GroupListEditor } from './GroupListEditor';
import { parseOptions } from '../templates/levels/options';
import type { DataType } from '../templates/levels/levelTypes';
import {
  OPERATOR_LABEL,
  operatorsForDataType,
  operatorNeedsTarget,
  parseGroups,
  serializeGroups,
  type Criteria,
  type OperatorKey,
  type ScoringGroup,
  type ScoringTypeKey,
} from './types';

/*
 * Scoring & evaluation — Design System v1.0. A master/detail:
 *   Left  — "Pass rules": Overall outcome + every level, each showing its own
 *           rule pill or a muted "Inherits" tag. Questions are hidden behind a
 *           "Show questions" toggle so the parent roll-up rules stay the focus.
 *   Right — the rule editor for the selected level: radio-card modes (every
 *           child / percentage / groups / no rule), a live "READS AS" summary,
 *           and Remove / Add-rule actions.
 * Rules persist to the same criteria store the runtime evaluator reads.
 */

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 380px',
    gap: '20px',
    alignItems: 'start',
    '@media (max-width: 1080px)': { gridTemplateColumns: '1fr' },
  },
  // Right column pins to the top of the viewport so the editor stays visible
  // while the (potentially long) rule list scrolls. Offset clears the sticky
  // app topbar; the panel scrolls internally if it's taller than the viewport.
  stickyPane: {
    position: 'sticky',
    top: '80px',
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    // On narrow screens the layout stacks, so sticky would trap the editor
    // above the list — fall back to static flow.
    '@media (max-width: 1080px)': { position: 'static', maxHeight: 'none', overflowY: 'visible' },
  },

  /* ---- Left: pass-rules list ---- */
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '18px 20px',
    borderBottom: '1px solid var(--ds-border)',
  },
  listTitle: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  listSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '3px' },
  showBtn: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
    flexShrink: 0,
    ':hover': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-strong)' },
  },
  showBtnActive: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
  },

  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 18px',
    borderBottom: '1px solid var(--ds-border)',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background-color 0.12s ease',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
    ':last-child': { borderBottom: 'none' },
  },
  rowActive: {
    backgroundColor: 'var(--ds-surface-base)',
    borderLeftColor: 'var(--ds-ai-primary, #8B5CF6)',
  },
  badge: {
    width: '26px',
    height: '26px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  badgeSection: { backgroundColor: 'var(--ds-brand-primary)', color: '#fff' },
  badgeSub: { backgroundColor: 'var(--ds-ai-surface, #F5F3FF)', color: 'var(--ds-ai-primary, #8B5CF6)' },
  badgeQuestion: { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)', fontSize: '10px' },
  badgeOverall: { backgroundColor: 'var(--ds-brand-primary)', color: '#fff' },

  rowText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  rowName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  pill: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    flexShrink: 0,
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    color: 'var(--ds-ai-primary, #8B5CF6)',
  },
  pillInherit: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    flexShrink: 0,
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
    border: '1px solid var(--ds-border)',
  },
  chev: { color: 'var(--ds-text-muted)', display: 'flex', flexShrink: 0 },

  listFooter: {
    padding: '14px 20px',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
  },
  empty: {
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
  },
});

const indentFor = (depth: number) => 18 + depth * 20;

interface FlatRow {
  node: LevelNode;
  depth: number;
}

function flatten(nodes: LevelNode[], depth: number): FlatRow[] {
  const out: FlatRow[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length > 0) out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

/** Plain-language pill text for a level's own rule (undefined ⇒ inherits). */
function pillText(c: Criteria | undefined, levelType: LevelType, childCount: number): string | null {
  if (!c) return null;
  if (levelType === 3) {
    const op = OPERATOR_LABEL[c.operator];
    return c.targetValue ? `${op} "${c.targetValue}"` : op;
  }
  if (c.scoringType === 'Weighted') {
    return childCount > 0
      ? `≥${Math.round(c.passThreshold * 100)}% of ${childCount}`
      : `≥${Math.round(c.passThreshold * 100)}%`;
  }
  if (c.scoringType === 'Grouped') {
    const groups = parseGroups(c.targetValue);
    return groups.length === 0 ? 'By groups' : `By groups (${groups.length})`;
  }
  return childCount > 0 ? `All ${childCount} must pass` : 'Every child must pass';
}

interface Props {
  templateId: string;
}

export function ScoringMatrix({ templateId }: Props) {
  const styles = useStyles();
  const { data: levels, isLoading, error } = useTemplateLevels(templateId);
  const ensureRoot = useEnsureRootLevel(templateId);

  const allLevelIds = useMemo(() => (levels ?? []).map((l) => l.dnx_assessment_levelid), [levels]);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);

  const [showQuestions, setShowQuestions] = useState(false);
  // Default to the synthetic overall-outcome row.
  const [selectedId, setSelectedId] = useState<string | null>('__overall__');

  const tree = useMemo(() => buildTree(levels), [levels]);
  const allRows = useMemo(() => flatten(tree, 0), [tree]);
  const rows = showQuestions
    ? allRows
    : allRows.filter((r) => (r.node.level.dnx_assessment_level_type ?? 1) !== 3);

  const existingRoot = useMemo(
    () => (levels ?? []).find((l) => l.dnx_assessment_level_type === 0),
    [levels],
  );

  // Count of levels carrying their own rule (excludes the synthetic overall row).
  const customCount = useMemo(() => {
    let n = 0;
    for (const l of levels ?? []) {
      if (l.dnx_assessment_level_type === 0) continue;
      if (criteriaByLevelId?.get(l.dnx_assessment_levelid)) n += 1;
    }
    return n;
  }, [levels, criteriaByLevelId]);

  if (isLoading) return <Spinner label="Loading levels..." size="small" />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  if (allRows.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>
          This template doesn't have any levels yet. Switch to the Structure tab to add
          sections, subsections, and questions first.
        </div>
      </div>
    );
  }

  // Resolve the currently-selected level (the overall row lazily ensures a root).
  const selectedNode =
    selectedId && selectedId !== '__overall__'
      ? allRows.find((r) => r.node.level.dnx_assessment_levelid === selectedId)?.node
      : undefined;

  async function selectOverall() {
    setSelectedId('__overall__');
    if (!existingRoot) {
      // Create the hidden root carrier so the overall rule has somewhere to live.
      await ensureRoot.mutateAsync().catch(() => {});
    }
  }

  const selectedLevel: Dnx_assessment_levels | undefined =
    selectedId === '__overall__' ? existingRoot : selectedNode?.level;
  const selectedChildCount =
    selectedId === '__overall__'
      ? tree.length
      : selectedNode
        ? selectedNode.children.length
        : 0;

  // Parent level name for the selected question ("Rolls up into …").
  const parentName = selectedNode
    ? (() => {
        const pid = lookupId(selectedNode.level, 'dnx_parent_assessment_level');
        return pid
          ? (levels ?? []).find((l) => l.dnx_assessment_levelid === pid)?.dnx_name
          : undefined;
      })()
    : undefined;

  return (
    <div className={styles.grid}>
      {/* Left — pass rules list */}
      <div className={styles.card}>
        <div className={styles.listHeader}>
          <div>
            <div className={styles.listTitle}>Pass rules</div>
            <div className={styles.listSub}>
              {customCount === 0
                ? 'All levels inherit'
                : `${customCount} custom rule${customCount === 1 ? '' : 's'} · the rest inherit`}
            </div>
          </div>
          <Button
            appearance="secondary"
            className={`${styles.showBtn} ${showQuestions ? styles.showBtnActive : ''}`}
            onClick={() => setShowQuestions((v) => !v)}
          >
            {showQuestions ? 'Hide questions' : 'Show questions'}
          </Button>
        </div>

        {/* Overall outcome */}
        <div
          className={`${styles.row} ${selectedId === '__overall__' ? styles.rowActive : ''}`}
          onClick={() => void selectOverall()}
        >
          <span className={`${styles.badge} ${styles.badgeOverall}`}>A</span>
          <span className={styles.rowText}>
            <span className={styles.rowName}>Overall outcome</span>
            <span className={styles.rowSub}>
              {tree.length} {tree.length === 1 ? 'child' : 'children'}
            </span>
          </span>
          {existingRoot && criteriaByLevelId?.get(existingRoot.dnx_assessment_levelid) ? (
            <span className={styles.pill}>
              {pillText(
                criteriaByLevelId.get(existingRoot.dnx_assessment_levelid),
                1,
                tree.length,
              )}
            </span>
          ) : (
            <span className={styles.pill}>
              {tree.length > 0 ? `All ${tree.length} must pass` : 'Every child must pass'}
            </span>
          )}
          <span className={styles.chev}>
            <ChevronRight16Regular />
          </span>
        </div>

        {/* Level rows */}
        {rows.map(({ node, depth }) => {
          const levelId = node.level.dnx_assessment_levelid;
          const levelType = (node.level.dnx_assessment_level_type ?? 1) as LevelType;
          const criteria = criteriaByLevelId?.get(levelId);
          const childCount = node.children.length;
          const pill = pillText(criteria, levelType, childCount);
          const badgeClass =
            levelType === 1 ? styles.badgeSection : levelType === 2 ? styles.badgeSub : styles.badgeQuestion;
          const badgeText = levelType === 1 ? 'S' : levelType === 2 ? 'S' : 'Q';
          return (
            <div
              key={levelId}
              className={`${styles.row} ${selectedId === levelId ? styles.rowActive : ''}`}
              style={{ paddingLeft: indentFor(depth) }}
              onClick={() => setSelectedId(levelId)}
            >
              <span className={`${styles.badge} ${badgeClass}`}>{badgeText}</span>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{node.level.dnx_name}</span>
                <span className={styles.rowSub}>
                  {levelType === 3
                    ? 'Question'
                    : `${childCount} ${childCount === 1 ? 'child' : 'children'}`}
                </span>
              </span>
              {pill ? (
                <span className={styles.pill}>{pill}</span>
              ) : (
                <span className={styles.pillInherit}>Inherits</span>
              )}
              <span className={styles.chev}>
                <ChevronRight16Regular />
              </span>
            </div>
          );
        })}

        <div className={styles.listFooter}>
          Levels with no rule of their own inherit “every child must pass”.
        </div>
      </div>

      {/* Right — rule editor for the selected level (sticky so it stays in
          view while a long rule list scrolls). */}
      <div className={styles.stickyPane}>
        {selectedId === '__overall__' && !selectedLevel && ensureRoot.isPending ? (
          <div className={styles.card}>
            <div className={styles.empty}>
              <Spinner size="tiny" label="Preparing…" />
            </div>
          </div>
        ) : selectedLevel ? (
          (selectedLevel.dnx_assessment_level_type ?? 1) === 3 ? (
            <QuestionRulePanel
              key={selectedLevel.dnx_assessment_levelid}
              level={selectedLevel}
              parentName={parentName}
            />
          ) : (
            <RulePanel
              key={selectedLevel.dnx_assessment_levelid}
              level={selectedLevel}
              childCount={selectedChildCount}
              isOverall={selectedId === '__overall__'}
            />
          )
        ) : (
          <div className={styles.card}>
            <div className={styles.empty}>Select a level to edit its pass rule.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Right-panel rule editor for parent / overall levels ---------- */

const usePanelStyles = makeStyles({
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    display: 'flex',
    flexDirection: 'column',
  },
  head: { padding: '18px 20px', borderBottom: '1px solid var(--ds-border)' },
  kicker: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--ds-text-muted)',
  },
  name: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)', marginTop: '4px' },
  sub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '2px' },

  body: { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' },
  groupLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },

  choices: { display: 'flex', flexDirection: 'column', gap: '10px' },
  choice: {
    fontFamily: 'var(--font-sans)',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    transition: 'border-color 0.12s ease, background-color 0.12s ease',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  choiceActive: {
    borderColor: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    ':hover': { borderColor: 'var(--ds-ai-primary, #8B5CF6)' },
  },
  radio: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid var(--ds-border-strong, #cbd5e1)',
    flexShrink: 0,
    marginTop: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: 'var(--ds-ai-primary, #8B5CF6)' },
  radioDot: { width: '9px', height: '9px', borderRadius: '50%', backgroundColor: 'var(--ds-ai-primary, #8B5CF6)' },
  choiceText: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  choiceTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  choiceDesc: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.4 },

  // Percentage editor
  pctCard: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  pctTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  pctLabel: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)' },
  pctInputWrap: { display: 'flex', alignItems: 'center', gap: '6px' },
  pctInput: {
    width: '58px',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    textAlign: 'right',
    padding: '0 8px',
    fontSize: 'var(--ds-fs-body)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ds-text-strong)',
  },
  pctPct: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)' },
  slider: { width: '100%', accentColor: 'var(--ds-ai-primary, #8B5CF6)' },
  pctNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

  groupsWrap: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
  },

  readsCard: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
  },
  readsLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--ds-text-muted)',
    marginBottom: '6px',
  },
  readsText: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)', lineHeight: 1.5 },

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderTop: '1px solid var(--ds-border)',
  },
  removeBtn: { color: 'var(--ds-text-muted)' },
  addBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
    ':disabled': { backgroundColor: 'var(--ds-border)', color: 'var(--ds-text-muted)' },
  },
  savedFlag: { fontSize: 'var(--ds-fs-caption)', color: '#047857' },

  /* ---- Question pass/fail editor ---- */
  qToggleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
  qToggleTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  qToggleHint: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    lineHeight: 1.45,
    marginTop: '3px',
    maxWidth: '320px',
  },
  qCard: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  qFieldLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)', marginBottom: '8px' },
  /* Segmented pill group (operators + counts-as) */
  pillGroup: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  segPill: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-body)',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '7px 14px',
    cursor: 'pointer',
    transition: 'background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  segPillActive: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    borderColor: 'var(--ds-brand-primary)',
    ':hover': { borderColor: 'var(--ds-brand-primary)' },
  },
  qValueInput: {
    width: '100%',
    height: '38px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    padding: '0 12px',
    fontSize: 'var(--ds-fs-body)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ds-text-strong)',
    boxSizing: 'border-box',
  },
  qCountsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  qNote: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', lineHeight: 1.45 },
});

type Mode = 'boolean' | 'weighted' | 'grouped' | 'none';

function RulePanel({
  level,
  childCount,
  isOverall,
}: {
  level: Dnx_assessment_levels;
  childCount: number;
  isOverall: boolean;
}) {
  const s = usePanelStyles();
  const levelId = level.dnx_assessment_levelid;
  const levelType = (level.dnx_assessment_level_type ?? 1) as number;
  const { data: criteria } = useCriteriaForLevels([levelId]);
  const existing = criteria?.get(levelId);
  const upsert = useUpsertCriteria(levelId);
  const remove = useDeleteCriteria(levelId);

  const [mode, setMode] = useState<Mode>('none');
  const [pct, setPct] = useState(50);
  const [groups, setGroups] = useState<ScoringGroup[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  // Hydrate from the stored rule when it first loads / changes identity. Render-
  // time adjust-on-change (not an effect) avoids set-state-in-effect cascades.
  // `hydratedKey` tracks which criteria row the local draft reflects.
  const criteriaKey = existing?.id ?? '__none__';
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  if (hydratedKey !== criteriaKey) {
    setHydratedKey(criteriaKey);
    if (existing) {
      setMode(
        existing.scoringType === 'Weighted'
          ? 'weighted'
          : existing.scoringType === 'Grouped'
            ? 'grouped'
            : 'boolean',
      );
      setPct(Math.round((existing.passThreshold ?? 0.5) * 100));
      setGroups(existing.scoringType === 'Grouped' ? parseGroups(existing.targetValue) : []);
    } else {
      setMode('none');
      setPct(50);
      setGroups([]);
    }
  }

  const kicker = isOverall ? 'ASSESSMENT' : levelType === 1 ? 'SECTION' : 'SUBSECTION';
  const name = isOverall ? 'Overall outcome' : level.dnx_name;

  const minPass = Math.max(1, Math.ceil(childCount * (pct / 100)));

  async function save() {
    if (mode === 'none') {
      if (existing) await remove.mutateAsync(existing.id);
      return;
    }
    const scoringType: ScoringTypeKey =
      mode === 'weighted' ? 'Weighted' : mode === 'grouped' ? 'Grouped' : 'Boolean';
    const sourceType: 0 | 1 | 2 = levelType === 2 ? 1 : 2;
    await upsert.mutateAsync({
      id: existing?.id,
      levelId,
      name: levelType === 0 ? 'Assessment outcome rule' : `${level.dnx_name} rule`,
      operator: existing?.operator ?? 'Equals',
      targetValue: scoringType === 'Grouped' ? serializeGroups(groups) : '',
      outcomeIfPass: 'Suitable',
      outcomeIfFail: 'NotSuitable',
      scoringType,
      passThreshold: scoringType === 'Weighted' ? pct / 100 : 1,
      weight: 1,
      sourceType,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  async function removeRule() {
    if (existing) await remove.mutateAsync(existing.id);
    setMode('none');
  }

  const childWord = `${childCount} ${childCount === 1 ? 'child' : 'children'}`;
  const readsAs = (() => {
    if (mode === 'none') {
      return isOverall
        ? 'The overall outcome inherits “every section must pass”.'
        : `${name} has no rule of its own and inherits every child must pass.`;
    }
    if (mode === 'boolean') {
      return childCount > 0
        ? `All ${childWord} of ${name} must pass. Any single failure fails this level.`
        : 'Every child must pass. Any single failure fails this level.';
    }
    if (mode === 'weighted') {
      return childCount > 0
        ? `At least ${minPass} of ${childCount} ${childCount === 1 ? 'child' : 'children'} must pass (${pct}%). Which ones does not matter.`
        : `At least ${pct}% of children must pass. Which ones does not matter.`;
    }
    // grouped
    const withMembers = groups.filter((g) => g.memberLevelIds.length > 0);
    const groupedIds = new Set(withMembers.flatMap((g) => g.memberLevelIds));
    const ungrouped = Math.max(0, childCount - groupedIds.size);
    if (withMembers.length === 0) {
      return `No group has members yet. Add members, or every child must pass individually. The remaining ${childWord} must each pass individually.`;
    }
    const groupPart = withMembers
      .map((g) => `${g.name}: pass ${g.minToPass} of ${g.memberLevelIds.length}`)
      .join('; ');
    return `${groupPart}. ${ungrouped > 0 ? `The other ${ungrouped} must each pass individually.` : 'All grouped children are covered.'}`;
  })();

  const CHOICES: { key: Mode; title: string; desc: string }[] = [
    { key: 'boolean', title: 'Every child must pass', desc: 'Strictest. One failure fails the level.' },
    { key: 'weighted', title: 'At least a percentage passes', desc: 'Pass when enough children pass, whichever ones.' },
    { key: 'grouped', title: 'By groups (N of M)', desc: 'Pick N of M within named groups. Ungrouped children must still pass.' },
    { key: 'none', title: 'No rule', desc: isOverall ? 'Falls back to every section must pass.' : "Inherits the parent's rule." },
  ];

  return (
    <div className={s.card}>
      <div className={s.head}>
        <div className={s.kicker}>{kicker}</div>
        <div className={s.name}>{name}</div>
        {childCount > 0 && (
          <div className={s.sub}>
            {childCount} {childCount === 1 ? 'child rolls' : 'children roll'} up into this level
          </div>
        )}
      </div>

      <div className={s.body}>
        <div className={s.groupLabel}>How this level passes</div>
        <div className={s.choices}>
          {CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${s.choice} ${mode === c.key ? s.choiceActive : ''}`}
              onClick={() => setMode(c.key)}
            >
              <span className={`${s.radio} ${mode === c.key ? s.radioOn : ''}`}>
                {mode === c.key && <span className={s.radioDot} />}
              </span>
              <span className={s.choiceText}>
                <span className={s.choiceTitle}>{c.title}</span>
                <span className={s.choiceDesc}>{c.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === 'weighted' && (
          <div className={s.pctCard}>
            <div className={s.pctTop}>
              <span className={s.pctLabel}>Minimum that must pass</span>
              <span className={s.pctInputWrap}>
                <input
                  className={s.pctInput}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setPct(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);
                  }}
                />
                <span className={s.pctPct}>%</span>
              </span>
            </div>
            <input
              className={s.slider}
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              onChange={(e) => setPct(parseInt(e.target.value, 10))}
            />
            <div className={s.pctNote}>
              With {childWord}, {minPass} must pass.
            </div>
          </div>
        )}

        {mode === 'grouped' && (
          <div className={s.groupsWrap}>
            <GroupListEditor level={level} groups={groups} onChange={setGroups} />
          </div>
        )}

        <div className={s.readsCard}>
          <div className={s.readsLabel}>Reads as</div>
          <div className={s.readsText}>{readsAs}</div>
        </div>

        {(upsert.error || remove.error) && (
          <MessageBar intent="error">
            <MessageBarBody>
              {((upsert.error ?? remove.error) as Error)?.message ?? 'Save failed'}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>

      <div className={s.footer}>
        <span>
          {justSaved ? (
            <span className={s.savedFlag}>Saved</span>
          ) : existing ? (
            <Button
              appearance="subtle"
              className={s.removeBtn}
              disabled={remove.isPending}
              onClick={removeRule}
            >
              Remove rule
            </Button>
          ) : (
            <span />
          )}
        </span>
        <Button
          appearance="primary"
          className={s.addBtn}
          disabled={upsert.isPending || remove.isPending}
          onClick={save}
        >
          {upsert.isPending || remove.isPending
            ? 'Saving…'
            : existing
              ? 'Save rule'
              : mode === 'none'
                ? 'Keep inherited'
                : 'Add rule'}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Right-panel pass/fail editor for a Question level ---------- */

// Friendly pill labels for the operators (shorter than the dropdown labels).
const OP_PILL_LABEL: Partial<Record<OperatorKey, string>> = {
  IsTrue: 'Is Yes',
  IsFalse: 'Is No',
  Equals: 'Equals',
  Contains: 'Contains',
  GreaterThan: 'After',
  LessThan: 'Before',
};

function QuestionRulePanel({
  level,
  parentName,
}: {
  level: Dnx_assessment_levels;
  parentName: string | undefined;
}) {
  const s = usePanelStyles();
  const levelId = level.dnx_assessment_levelid;
  const dataType = (level.dnx_data_type ?? 3) as DataType;
  const operators = operatorsForDataType(dataType);
  const options = dataType === 1 || dataType === 2 ? parseOptions(level.dnx_option_set_reference) : [];
  const isDate = dataType === 4;

  const { data: criteria } = useCriteriaForLevels([levelId]);
  const existing = criteria?.get(levelId);
  const upsert = useUpsertCriteria(levelId);
  const remove = useDeleteCriteria(levelId);

  const [enabled, setEnabled] = useState(false);
  const [operator, setOperator] = useState<OperatorKey>(operators[0] ?? 'Equals');
  const [target, setTarget] = useState('');
  const [importance, setImportance] = useState(1);
  const [justSaved, setJustSaved] = useState(false);

  // Hydrate from the stored rule (render-time adjust-on-change, keyed by row id).
  const criteriaKey = existing?.id ?? '__none__';
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  if (hydratedKey !== criteriaKey) {
    setHydratedKey(criteriaKey);
    if (existing) {
      setEnabled(true);
      setOperator(existing.operator);
      setTarget(existing.targetValue);
      setImportance(existing.weight > 0 ? existing.weight : 1);
    } else {
      setEnabled(false);
      setOperator(operators[0] ?? 'Equals');
      setTarget('');
      setImportance(1);
    }
  }

  const needsTarget = operatorNeedsTarget(operator);
  const isChoice = dataType === 1 || dataType === 2;

  async function save() {
    await upsert.mutateAsync({
      id: existing?.id,
      levelId,
      name: `${level.dnx_name} rule`,
      operator,
      targetValue: needsTarget ? target : '',
      outcomeIfPass: 'Suitable',
      outcomeIfFail: 'NotSuitable',
      scoringType: 'Boolean',
      passThreshold: 1,
      weight: importance,
      sourceType: 0,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  async function removeRule() {
    if (existing) await remove.mutateAsync(existing.id);
    setEnabled(false);
  }

  const opWord = OP_PILL_LABEL[operator] ?? OPERATOR_LABEL[operator];
  const readsAs = !enabled
    ? `${level.dnx_name} has no pass rule — it won't affect its section's outcome until you add one.`
    : needsTarget
      ? `${level.dnx_name} passes when the answer ${opWord.toLowerCase()} “${target || '…'}”.`
      : `${level.dnx_name} passes when the answer is ${operator === 'IsTrue' ? 'Yes' : 'No'}.`;

  return (
    <div className={s.card}>
      <div className={s.head}>
        <div className={s.kicker}>QUESTION</div>
        <div className={s.name}>{level.dnx_name}</div>
        {parentName && <div className={s.sub}>Rolls up into {parentName}</div>}
      </div>

      <div className={s.body}>
        <div className={s.qToggleRow}>
          <div>
            <div className={s.qToggleTitle}>Pass / fail rule</div>
            <div className={s.qToggleHint}>
              Marks this question passed or failed from the assessor's answer, then cascades up
              to the section outcome.
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={remove.isPending}
            onChange={(_, d) => {
              setEnabled(d.checked);
              if (!d.checked && existing) void removeRule();
            }}
          />
        </div>

        {enabled && operators.length > 0 && (
          <div className={s.qCard}>
            <div>
              <div className={s.qFieldLabel}>Passes when the answer</div>
              <div className={s.pillGroup}>
                {operators.map((op) => (
                  <button
                    key={op}
                    type="button"
                    className={`${s.segPill} ${operator === op ? s.segPillActive : ''}`}
                    onClick={() => {
                      setOperator(op);
                      setTarget('');
                    }}
                  >
                    {OP_PILL_LABEL[op] ?? OPERATOR_LABEL[op]}
                  </button>
                ))}
              </div>
            </div>

            {needsTarget && (
              <div>
                <div className={s.qFieldLabel}>This exact value</div>
                {isChoice ? (
                  <div className={s.pillGroup}>
                    {options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={`${s.segPill} ${target === o ? s.segPillActive : ''}`}
                        onClick={() => setTarget(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    className={s.qValueInput}
                    type={isDate ? 'date' : 'text'}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. Verified"
                  />
                )}
              </div>
            )}

            <div>
              <div className={s.qCountsRow}>
                <span className={s.qFieldLabel} style={{ marginBottom: 0 }}>
                  Counts as
                </span>
                <div className={s.pillGroup}>
                  {[1, 2, 3].map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`${s.segPill} ${importance === w ? s.segPillActive : ''}`}
                      onClick={() => setImportance(w)}
                    >
                      {w}×
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.qNote} style={{ marginTop: 8 }}>
                Counts as {importance === 1 ? 'one question' : `${importance} questions`} in its
                parent's percentage threshold.
              </div>
            </div>
          </div>
        )}

        {enabled && operators.length === 0 && (
          <div className={s.qNote}>
            This question's data type doesn't support evaluation rules yet.
          </div>
        )}

        <div className={s.readsCard}>
          <div className={s.readsLabel}>Reads as</div>
          <div className={s.readsText}>{readsAs}</div>
        </div>

        {(upsert.error || remove.error) && (
          <MessageBar intent="error">
            <MessageBarBody>
              {((upsert.error ?? remove.error) as Error)?.message ?? 'Save failed'}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>

      <div className={s.footer}>
        <span>
          {justSaved ? (
            <span className={s.savedFlag}>Saved</span>
          ) : existing ? (
            <Button
              appearance="subtle"
              className={s.removeBtn}
              disabled={remove.isPending}
              onClick={removeRule}
            >
              Remove rule
            </Button>
          ) : (
            <span />
          )}
        </span>
        <Button
          appearance="primary"
          className={s.addBtn}
          disabled={
            !enabled ||
            operators.length === 0 ||
            upsert.isPending ||
            (needsTarget && target.trim() === '')
          }
          onClick={save}
        >
          {upsert.isPending ? 'Saving…' : existing ? 'Save rule' : 'Add rule'}
        </Button>
      </div>
    </div>
  );
}
