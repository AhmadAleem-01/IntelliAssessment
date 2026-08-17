import { useMemo, useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  Switch,
  makeStyles,
} from '@fluentui/react-components';
import { ChevronRight16Regular, ChevronDown16Regular } from '@fluentui/react-icons';
import { useTemplateLevels, useUpdateEvidenceBinding } from './api';
import { buildTree, subsectionIndexOf, type LevelNode } from './treeBuilder';
import { lookupId } from '../../../lib/dataverse';
import type { LevelType } from './levelTypes';
import { useTemplate } from '../api';
import { flattenSchema, parseAppData } from '../../applicationDetails/appData';
import {
  parseEvidenceBinding,
  serializeEvidenceBinding,
  type EvidenceBinding,
} from './evidenceBinding';
import type { Dnx_assessment_levels } from '../../../generated/models/Dnx_assessment_levelsModel';

/*
 * AI conditioning — Design System v1.0. Two-panel master/detail with a dark
 * AI-coverage hero:
 *   Hero  — how many questions have a binding, with a violet progress bar.
 *   Left  — every question grouped under its section/subsection, each showing
 *           its binding as a pill (Application data / a file variable / Both /
 *           Unbound). "Show unbound only" filters to the gaps.
 *   Right — the binding editor for the selected question: what the AI reads
 *           (application data / evidence file / both), which JSON attributes
 *           feed it, the extraction query, and an assessment-time explainer.
 * Persists to `dnx_document_type_reference` via useUpdateEvidenceBinding.
 */

const QUERY_MAX = 400;
// Attribute chips shown before the "see more" cap (a big schema can have dozens).
const ATTR_CAP = 12;

const useStyles = makeStyles({
  leftCol: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 },

  /* AI coverage hero */
  hero: {
    backgroundColor: 'var(--ds-brand-primary)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '20px 24px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    flexWrap: 'wrap',
  },
  heroLeft: { minWidth: 0 },
  heroTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: '#fff' },
  heroSub: { fontSize: 'var(--ds-fs-caption)', color: 'rgba(255,255,255,0.7)', marginTop: '4px' },
  heroRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '240px', flex: 1 },
  heroCount: { fontSize: '28px', fontWeight: 700, lineHeight: 1 },
  heroCountOf: { fontSize: 'var(--ds-fs-body)', color: 'rgba(255,255,255,0.7)', fontWeight: 400 },
  heroTrack: {
    width: '100%',
    height: '6px',
    borderRadius: '999px',
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  heroFill: { display: 'block', height: '100%', borderRadius: '999px', backgroundColor: 'var(--ds-ai-primary, #8B5CF6)', minWidth: '2px' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 400px',
    gap: '20px',
    alignItems: 'start',
    '@media (max-width: 1120px)': { gridTemplateColumns: '1fr' },
  },
  stickyPane: {
    position: 'sticky',
    top: '80px',
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto',
    '@media (max-width: 1120px)': { position: 'static', maxHeight: 'none', overflowY: 'visible' },
  },

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
  listSub: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '3px', maxWidth: '360px' },
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
    borderLeft: '3px solid transparent',
    transition: 'background-color 0.12s ease',
    ':last-child': { borderBottom: 'none' },
  },
  rowClickable: { cursor: 'pointer', ':hover': { backgroundColor: 'var(--ds-surface-base)' } },
  rowActive: { backgroundColor: 'var(--ds-surface-base)', borderLeftColor: 'var(--ds-ai-primary, #8B5CF6)' },

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
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
  },
  badgeSub: { backgroundColor: 'var(--ds-ai-surface, #F5F3FF)', color: 'var(--ds-ai-primary, #8B5CF6)' },
  qDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    marginLeft: '9px',
    marginRight: '10px',
  },
  qDotBound: { backgroundColor: 'var(--ds-ai-primary, #8B5CF6)' },
  qDotUnbound: { backgroundColor: 'var(--ds-border-strong, #cbd5e1)' },
  subChevron: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },

  rowText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  rowName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowNameBold: { fontWeight: 600 },
  rowSub: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  countPill: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', flexShrink: 0 },
  bindPill: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    flexShrink: 0,
    maxWidth: '160px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    color: 'var(--ds-ai-primary, #8B5CF6)',
  },
  bindPillUnbound: {
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
    border: '1px solid var(--ds-border)',
  },
  chev: { color: 'var(--ds-text-muted)', display: 'flex', flexShrink: 0 },

  empty: {
    padding: '48px 24px',
    textAlign: 'center',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-body)',
    lineHeight: 1.5,
  },
});

const indentFor = (depth: number) => 18 + depth * 18;

/** True when a binding carries anything meaningful. */
function isBound(b: EvidenceBinding | undefined): boolean {
  return !!b && (!!b.fileVariable.trim() || !!b.query.trim() || (b.applicationDataPaths?.length ?? 0) > 0);
}

/** Left-list pill text for a question's binding. */
function bindPillText(b: EvidenceBinding | undefined): { text: string; bound: boolean } {
  if (!isBound(b)) return { text: 'Unbound', bound: false };
  const hasPaths = (b!.applicationDataPaths?.length ?? 0) > 0;
  const hasFile = !!b!.fileVariable.trim();
  if (hasPaths && hasFile) return { text: 'Both', bound: true };
  if (hasPaths) return { text: 'Application data', bound: true };
  if (hasFile) return { text: b!.fileVariable.trim(), bound: true };
  return { text: 'Query only', bound: true };
}

type FlatRow =
  | { kind: 'header'; node: LevelNode; levelType: LevelType; depth: number; bound: number; total: number; collapsible: boolean }
  | { kind: 'question'; node: LevelNode; depth: number };

/** Count questions + bound questions in a subtree. */
function countBound(node: LevelNode): { total: number; bound: number } {
  let total = 0;
  let bound = 0;
  const walk = (n: LevelNode) => {
    for (const c of n.children) {
      if ((c.level.dnx_assessment_level_type as LevelType) === 3) {
        total += 1;
        if (isBound(parseEvidenceBinding(c.level.dnx_document_type_reference))) bound += 1;
      } else {
        walk(c);
      }
    }
  };
  walk(node);
  return { total, bound };
}

interface Props {
  templateId: string;
}

export function AiConditioningMatrix({ templateId }: Props) {
  const styles = useStyles();
  const { data: levels, isLoading, error } = useTemplateLevels(templateId);
  const { data: template } = useTemplate(templateId);

  const [showUnbound, setShowUnbound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(levels), [levels]);

  // Flatten to header + question rows, emitting a header only when its subtree
  // has questions. Subsections are collapsible.
  const rows = useMemo(() => {
    const build = (nodes: LevelNode[], depth: number): FlatRow[] => {
      const out: FlatRow[] = [];
      for (const node of nodes) {
        const levelType = (node.level.dnx_assessment_level_type as LevelType) ?? 1;
        if (levelType === 3) {
          out.push({ kind: 'question', node, depth });
          continue;
        }
        const childRows = build(node.children, depth + 1);
        if (childRows.some((r) => r.kind === 'question' || r.kind === 'header')) {
          const { total, bound } = countBound(node);
          const isCollapsed = collapsed.has(node.level.dnx_assessment_levelid);
          out.push({
            kind: 'header',
            node,
            levelType,
            depth,
            bound,
            total,
            collapsible: levelType === 2,
          });
          if (!(levelType === 2 && isCollapsed)) out.push(...childRows);
        }
      }
      return out;
    };
    return build(tree, 0);
  }, [tree, collapsed]);

  // Coverage: bound vs total questions across the whole template.
  const { total, bound } = useMemo(() => {
    let t = 0;
    let b = 0;
    for (const l of levels ?? []) {
      if ((l.dnx_assessment_level_type as LevelType) !== 3) continue;
      t += 1;
      if (isBound(parseEvidenceBinding(l.dnx_document_type_reference))) b += 1;
    }
    return { total: t, bound: b };
  }, [levels]);

  if (isLoading) return <Spinner label="Loading questions..." size="small" />;
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  if (total === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>
          This template doesn't have any questions yet. Switch to the Structure tab to add
          sections, subsections, and questions first.
        </div>
      </div>
    );
  }

  const selectedLevel = (levels ?? []).find((l) => l.dnx_assessment_levelid === selectedId);
  const parentOf = (l: Dnx_assessment_levels) => {
    const pid = lookupId(l, 'dnx_parent_assessment_level');
    return pid ? (levels ?? []).find((x) => x.dnx_assessment_levelid === pid) : undefined;
  };

  const pct = total > 0 ? Math.round((bound / total) * 100) : 0;
  const unboundCount = total - bound;

  // Question rows only show when they match the unbound filter.
  const visibleRows = rows.filter((r) => {
    if (r.kind !== 'question') return true;
    if (!showUnbound) return true;
    return !isBound(parseEvidenceBinding(r.node.level.dnx_document_type_reference));
  });

  return (
    <div className={styles.grid}>
      {/* Left column — AI coverage hero stacked above the questions list */}
      <div className={styles.leftCol}>
        <div className={`${styles.hero} ai-glow-border`}>
          <div className={styles.heroLeft}>
            <div className={styles.heroTitle}>AI coverage</div>
            <div className={styles.heroSub}>
              {unboundCount === 0
                ? 'Every question has a binding.'
                : `${unboundCount} question${unboundCount === 1 ? ' has' : 's have'} no binding and must be answered by hand on every live assessment.`}
            </div>
          </div>
          <div className={styles.heroRight}>
            <div>
              <span className={styles.heroCount}>{bound}</span>{' '}
              <span className={styles.heroCountOf}>of {total} bound</span>
            </div>
            <div className={styles.heroTrack}>
              <span className={styles.heroFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Questions list */}
        <div className={styles.card}>
          <div className={styles.listHeader}>
            <div>
              <div className={styles.listTitle}>Questions</div>
              <div className={styles.listSub}>
                Pick a question to declare the evidence it reads and the query the assistant follows.
              </div>
            </div>
            <Button
              appearance="secondary"
              className={`${styles.showBtn} ${showUnbound ? styles.showBtnActive : ''}`}
              onClick={() => setShowUnbound((v) => !v)}
            >
              {showUnbound ? 'Show all' : 'Show unbound only'}
            </Button>
          </div>

          {visibleRows.map((row) => {
            const levelId = row.node.level.dnx_assessment_levelid;
            if (row.kind === 'header') {
              const isCollapsed = collapsed.has(levelId);
              return (
                <div key={levelId} className={styles.row} style={{ paddingLeft: indentFor(row.depth) }}>
                  {row.collapsible ? (
                    <button
                      type="button"
                      className={styles.subChevron}
                      onClick={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(levelId)) next.delete(levelId);
                          else next.add(levelId);
                          return next;
                        })
                      }
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isCollapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
                    </button>
                  ) : (
                    <span className={`${styles.badge} ${row.levelType === 2 ? styles.badgeSub : ''}`}>S</span>
                  )}
                  <span className={styles.rowText}>
                    <span className={`${styles.rowName} ${styles.rowNameBold}`}>{row.node.level.dnx_name}</span>
                    <span className={styles.rowSub}>
                      {row.total} {row.total === 1 ? 'question' : 'questions'}
                    </span>
                  </span>
                  <span className={styles.countPill}>
                    {row.bound} of {row.total} bound
                  </span>
                  <span className={styles.chev}>
                    <ChevronRight16Regular />
                  </span>
                </div>
              );
            }

            const binding = parseEvidenceBinding(row.node.level.dnx_document_type_reference);
            const pill = bindPillText(binding);
            const selected = selectedId === levelId;
            return (
              <div
                key={levelId}
                className={`${styles.row} ${styles.rowClickable} ${selected ? styles.rowActive : ''}`}
                style={{ paddingLeft: indentFor(row.depth) }}
                onClick={() => setSelectedId(levelId)}
              >
                <span className={`${styles.qDot} ${pill.bound ? styles.qDotBound : styles.qDotUnbound}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{row.node.level.dnx_name}</span>
                  <span className={styles.rowSub}>{binding?.query || 'No query yet'}</span>
                </span>
                <span className={`${styles.bindPill} ${pill.bound ? '' : styles.bindPillUnbound}`}>
                  {pill.text}
                </span>
                <span className={styles.chev}>
                  <ChevronRight16Regular />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right — binding editor */}
      <div className={styles.stickyPane}>
          {selectedLevel && (selectedLevel.dnx_assessment_level_type as LevelType) === 3 ? (
            <BindingPanel
              key={selectedLevel.dnx_assessment_levelid}
              level={selectedLevel}
              templateId={templateId}
              parentName={parentOf(selectedLevel)?.dnx_name}
              subsectionIndex={subsectionIndexOf(levels, selectedLevel.dnx_assessment_levelid)}
              insideSubsection={(parentOf(selectedLevel)?.dnx_assessment_level_type ?? 0) === 2}
              schema={template?.dnx_application_schema}
            />
          ) : (
            <div className={styles.card}>
              <div className={styles.empty}>Pick a question on the left to configure its AI binding.</div>
            </div>
          )}
        </div>
      </div>
  );
}

/* ---------------- Right-panel binding editor ---------------- */

const DATA_TYPE_LABEL: Record<number, string> = {
  0: 'Boolean',
  1: 'Single select',
  2: 'Multi select',
  3: 'Text',
  4: 'Date',
};

type ReadMode = 'appData' | 'evidence' | 'both';

const QUICK_INSERTS = ['Set true if…', 'Copy the…', 'Pick the option that…'];

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

  body: { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '18px' },
  groupLabel: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)', marginBottom: '10px' },
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
  labelCount: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },

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

  attrSearch: {
    width: '100%',
    height: '34px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    padding: '0 12px',
    marginBottom: '10px',
    fontSize: 'var(--ds-fs-body)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ds-text-strong)',
    boxSizing: 'border-box',
  },
  seeMore: {
    marginTop: '10px',
    background: 'transparent',
    border: 'none',
    padding: 0,
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-brand-accent)',
    cursor: 'pointer',
    ':hover': { textDecoration: 'underline' },
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 10px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    cursor: 'pointer',
    ':hover': { borderColor: 'var(--ds-border-strong, #cbd5e1)' },
  },
  chipOn: {
    // !important so this beats the base `chip` background/border regardless of
    // Griffel's atomic insertion order (equal-specificity conflict otherwise).
    backgroundColor: 'var(--ds-brand-primary) !important',
    color: '#fff !important',
    border: '1px solid var(--ds-brand-primary) !important',
  },
  chipBox: {
    width: '14px',
    height: '14px',
    borderRadius: '4px',
    border: '1.5px solid var(--ds-border-strong, #cbd5e1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    flexShrink: 0,
  },
  chipBoxOn: { border: '1.5px solid #fff !important', color: '#fff !important' },
  hint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '8px', lineHeight: 1.45 },

  textarea: {
    width: '100%',
    minHeight: '78px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    padding: '10px 12px',
    fontSize: 'var(--ds-fs-body)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ds-text-strong)',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  quickRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
  quickChip: {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-caption)',
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-surface-base)' },
  },

  explain: {
    padding: '14px 16px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
  },
  explainLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--ds-text-muted)',
    marginBottom: '6px',
  },
  explainText: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-body)', lineHeight: 1.5 },

  indexRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 14px',
    borderRadius: '10px',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    border: '1px solid var(--ds-ai-border, #ddd6fe)',
  },
  indexText: { minWidth: 0 },
  indexTitle: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  indexHint: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', marginTop: '2px', lineHeight: 1.45 },

  fileInput: {
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

  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderTop: '1px solid var(--ds-border)',
  },
  clearBtn: { color: 'var(--ds-not-suitable, #EF4444)' },
  saveBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
    ':disabled': { backgroundColor: 'var(--ds-border)', color: 'var(--ds-text-muted)' },
  },
});

const READ_MODES: { key: ReadMode; title: string; desc: string }[] = [
  { key: 'appData', title: 'Application data only', desc: 'Structured facts from the application-details JSON. No upload needed.' },
  { key: 'evidence', title: 'Evidence file only', desc: 'Reads a document the assessor uploads — resume, transcript, letter.' },
  { key: 'both', title: 'Both', desc: 'Cross-checks the uploaded document against the application data.' },
];

function BindingPanel({
  level,
  templateId,
  parentName,
  subsectionIndex,
  insideSubsection,
  schema,
}: {
  level: Dnx_assessment_levels;
  templateId: string;
  parentName: string | undefined;
  /** 0-based position of the question's repeating subsection (Qual 3 → 2). */
  subsectionIndex: number;
  /** True when the question sits directly under a Subsection level. */
  insideSubsection: boolean;
  schema: string | undefined;
}) {
  const s = usePanelStyles();
  const save = useUpdateEvidenceBinding(templateId);

  const attrFields = useMemo(() => flattenSchema(parseAppData(schema)), [schema]);

  const initial = useMemo(
    () => parseEvidenceBinding(level.dnx_document_type_reference) ?? { fileVariable: '', query: '' },
    [level.dnx_document_type_reference],
  );

  const initialMode: ReadMode = (() => {
    const hasPaths = (initial.applicationDataPaths?.length ?? 0) > 0;
    const hasFile = !!initial.fileVariable.trim();
    if (hasPaths && hasFile) return 'both';
    if (hasFile) return 'evidence';
    return 'appData';
  })();

  const [mode, setMode] = useState<ReadMode>(initialMode);
  const [paths, setPaths] = useState<string[]>(initial.applicationDataPaths ?? []);
  const [fileVar, setFileVar] = useState(initial.fileVariable);
  const [query, setQuery] = useState(initial.query);
  const [useIndex, setUseIndex] = useState(initial.useSubsectionIndex === true);
  const [justSaved, setJustSaved] = useState(false);
  // Attribute list can be long — filter by search and cap the visible chips
  // behind a "see more" until the author expands.
  const [attrSearch, setAttrSearch] = useState('');
  const [attrExpanded, setAttrExpanded] = useState(false);

  const showAttrs = mode !== 'evidence';
  const showFile = mode !== 'appData';
  // The "use this subsection's position" toggle only makes sense when a
  // repeating (`[]`) attribute is bound and the question lives in a subsection.
  const hasRepeatingPath = showAttrs && paths.some((p) => p.includes('[]'));
  const showIndexToggle = insideSubsection && hasRepeatingPath;
  const effectiveUseIndex = showIndexToggle && useIndex;

  // Filter attributes by the search box (path or label), then cap the list so a
  // huge schema doesn't fill the panel. Selected-but-hidden chips still count.
  const q = attrSearch.trim().toLowerCase();
  const filteredAttrs = q
    ? attrFields.filter(
        (f) => f.path.toLowerCase().includes(q) || f.label.toLowerCase().includes(q),
      )
    : attrFields;
  const capped = attrExpanded || q ? filteredAttrs : filteredAttrs.slice(0, ATTR_CAP);
  const hiddenCount = filteredAttrs.length - capped.length;
  // A stored path may be a concrete-index form (`qualifications[0].title`) while
  // the schema chip is the repeating form (`qualifications[].title`). Normalise
  // indices to `[]` so the matching chip still lights up.
  const normPath = (p: string) => p.replace(/\[\d+\]/g, '[]');
  const selectedNorm = new Set(paths.map(normPath));
  const isSelected = (chipPath: string) => selectedNorm.has(normPath(chipPath));
  // Selected paths whose normalised form matches no schema chip — surfaced as
  // chips so a non-zero "N selected" count always has something visible.
  const attrNormSet = new Set(attrFields.map((f) => normPath(f.path)));
  const orphanPaths = paths.filter((p) => !attrNormSet.has(normPath(p)));

  function togglePath(p: string) {
    const target = normPath(p);
    setPaths((cur) =>
      cur.some((x) => normPath(x) === target)
        ? cur.filter((x) => normPath(x) !== target) // remove any index-variant too
        : [...cur, p],
    );
  }
  function insertQuick(text: string) {
    setQuery((q) => (q.trim() ? q : text));
  }

  async function handleSave() {
    const binding: EvidenceBinding = {
      fileVariable: showFile ? fileVar.trim() : '',
      query: query.trim(),
      applicationDataPaths: showAttrs ? paths : [],
      ...(effectiveUseIndex ? { useSubsectionIndex: true } : {}),
    };
    await save.mutateAsync({
      levelId: level.dnx_assessment_levelid,
      documentTypeReference: serializeEvidenceBinding(binding) ?? '',
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  }

  async function handleClear() {
    setMode('appData');
    setPaths([]);
    setFileVar('');
    setQuery('');
    setUseIndex(false);
    await save.mutateAsync({ levelId: level.dnx_assessment_levelid, documentTypeReference: '' });
  }

  const dataTypeLabel = DATA_TYPE_LABEL[level.dnx_data_type ?? 3] ?? 'Text';
  // With the index toggle on, repeating paths resolve at THIS subsection's slot.
  const ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][subsectionIndex] ??
    `${subsectionIndex + 1}th`;
  const attrList = paths.length
    ? (effectiveUseIndex ? paths.map((p) => p.replace('[]', `[${subsectionIndex}]`)) : paths).join(', ')
    : 'no attributes yet';
  const explain =
    mode === 'appData'
      ? `The assistant reads ${attrList} from the assessment's application data and drafts an answer.${effectiveUseIndex ? ` Repeating fields resolve to the ${ordinal} item, matching this subsection.` : ''} No upload required, so this question is auto-fillable.`
      : mode === 'evidence'
        ? `The assessor uploads ${fileVar.trim() || 'a file'}; the assistant reads it and drafts an answer from the query.`
        : `The assistant cross-checks the uploaded ${fileVar.trim() || 'file'} against ${attrList} from the application data, then drafts an answer.`;

  const wasBound = (level.dnx_document_type_reference ?? '').trim() !== '';

  return (
    <div className={s.card}>
      <div className={s.head}>
        <div className={s.kicker}>QUESTION</div>
        <div className={s.name}>{level.dnx_name}</div>
        <div className={s.sub}>
          {dataTypeLabel}
          {parentName ? ` · in ${parentName}` : ''}
        </div>
      </div>

      <div className={s.body}>
        {save.error && (
          <MessageBar intent="error">
            <MessageBarBody>{(save.error as Error).message}</MessageBarBody>
          </MessageBar>
        )}

        {/* What the AI reads */}
        <div>
          <div className={s.groupLabel}>What the AI reads</div>
          <div className={s.choices}>
            {READ_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`${s.choice} ${mode === m.key ? s.choiceActive : ''}`}
                onClick={() => setMode(m.key)}
              >
                <span className={`${s.radio} ${mode === m.key ? s.radioOn : ''}`}>
                  {mode === m.key && <span className={s.radioDot} />}
                </span>
                <span className={s.choiceText}>
                  <span className={s.choiceTitle}>{m.title}</span>
                  <span className={s.choiceDesc}>{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Evidence file variable */}
        {showFile && (
          <div>
            <div className={s.groupLabel}>Evidence file variable</div>
            <input
              className={s.fileInput}
              value={fileVar}
              onChange={(e) => setFileVar(e.target.value)}
              placeholder="e.g. r1-testamur"
              maxLength={100}
            />
            <div className={s.hint}>
              A placeholder the assessor maps to a real uploaded file at assessment time.
            </div>
          </div>
        )}

        {/* Application-data attributes */}
        {showAttrs && (
          <div>
            <div className={s.labelRow}>
              <span className={s.groupLabel} style={{ marginBottom: 0 }}>
                Application-data attributes
              </span>
              <span className={s.labelCount}>
                {paths.length} of {attrFields.length} selected
              </span>
            </div>
            {attrFields.length === 0 ? (
              <div className={s.hint} style={{ marginTop: 0 }}>
                No application schema defined yet. Add a sample JSON in the Details tab to bind
                attributes.
              </div>
            ) : (
              <>
                {attrFields.length > ATTR_CAP && (
                  <input
                    className={s.attrSearch}
                    value={attrSearch}
                    onChange={(e) => setAttrSearch(e.target.value)}
                    placeholder={`Search ${attrFields.length} attributes…`}
                  />
                )}
                {capped.length === 0 && orphanPaths.length === 0 ? (
                  <div className={s.hint} style={{ marginTop: 0 }}>
                    No attributes match “{attrSearch}”.
                  </div>
                ) : (
                  <div className={s.chips}>
                    {/* Selected paths not present in the schema list (e.g. the
                        schema changed after binding) still render as chips so a
                        non-zero "N selected" count always has visible chips. */}
                    {orphanPaths.map((p) => (
                      <button
                        key={`orphan-${p}`}
                        type="button"
                        className={`${s.chip} ${s.chipOn}`}
                        onClick={() => togglePath(p)}
                        title="Not in the current schema — click to remove"
                      >
                        <span className={`${s.chipBox} ${s.chipBoxOn}`}>✓</span>
                        {p}
                      </button>
                    ))}
                    {capped.map((f) => {
                      const on = isSelected(f.path);
                      return (
                        <button
                          key={f.path}
                          type="button"
                          className={`${s.chip} ${on ? s.chipOn : ''}`}
                          onClick={() => togglePath(f.path)}
                          title={f.label}
                        >
                          <span className={`${s.chipBox} ${on ? s.chipBoxOn : ''}`}>{on ? '✓' : ''}</span>
                          {f.path}
                        </button>
                      );
                    })}
                  </div>
                )}
                {hiddenCount > 0 && (
                  <button type="button" className={s.seeMore} onClick={() => setAttrExpanded(true)}>
                    Show {hiddenCount} more
                  </button>
                )}
                {attrExpanded && !q && filteredAttrs.length > ATTR_CAP && (
                  <button type="button" className={s.seeMore} onClick={() => setAttrExpanded(false)}>
                    Show fewer
                  </button>
                )}
                <div className={s.hint}>
                  Only ticked attributes are sent from the assessment's application-details JSON.
                </div>
              </>
            )}
          </div>
        )}

        {/* Use this subsection's position — only for repeating (`[]`) attributes
            on a question inside a repeatable subsection. */}
        {showIndexToggle && (
          <div className={s.indexRow}>
            <div className={s.indexText}>
              <div className={s.indexTitle}>Use this subsection's position</div>
              <div className={s.indexHint}>
                Reads the {ordinal} item of the array (matching {parentName ?? 'this subsection'}),
                not always the first.
              </div>
            </div>
            <Switch checked={useIndex} onChange={(_, d) => setUseIndex(d.checked)} />
          </div>
        )}

        {/* Extraction query */}
        <div>
          <div className={s.labelRow}>
            <span className={s.groupLabel} style={{ marginBottom: 0 }}>
              Extraction query
            </span>
            <span className={s.labelCount}>
              {query.length}/{QUERY_MAX}
            </span>
          </div>
          <textarea
            className={s.textarea}
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, QUERY_MAX))}
            placeholder="Tell the assistant what to find and how to answer this question."
            maxLength={QUERY_MAX}
          />
          <div className={s.quickRow}>
            {QUICK_INSERTS.map((q) => (
              <button key={q} type="button" className={s.quickChip} onClick={() => insertQuick(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Assessment-time explainer */}
        <div className={s.explain}>
          <div className={s.explainLabel}>At assessment time</div>
          <div className={s.explainText}>{explain}</div>
        </div>
      </div>

      <div className={s.footer}>
        <span>
          {justSaved ? (
            <span style={{ fontSize: 'var(--ds-fs-caption)', color: '#047857' }}>Saved</span>
          ) : wasBound ? (
            <Button appearance="subtle" className={s.clearBtn} disabled={save.isPending} onClick={handleClear}>
              Clear binding
            </Button>
          ) : (
            <span />
          )}
        </span>
        <Button appearance="primary" className={s.saveBtn} disabled={save.isPending} onClick={handleSave}>
          {save.isPending ? 'Saving…' : wasBound ? 'Update binding' : 'Add binding'}
        </Button>
      </div>
    </div>
  );
}
