import { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Dropdown,
  Option,
  Checkbox,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  Sparkle16Filled,
  CheckmarkCircle16Filled,
  ArrowClockwise16Regular,
  Document16Regular,
  Checkmark16Filled,
  Database16Regular,
} from '@fluentui/react-icons';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { parseEvidenceMapping } from '../assessments/api';
import type { DataType } from '../templates/levels/levelTypes';
import {
  useAiPopulateMapped,
  toAiQuestions,
  groupByFileVariable,
  type AiSuggestion,
  type AiQuestion,
  type FileVariableGroup,
} from './aiPopulate';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '860px',
    width: '94vw',
    maxHeight: '90vh',
    // The animated AI glow ring (.ai-glow-border) draws the edge; drop Fluent's
    // own border so there's no double outline around the dialog.
    border: '1px solid transparent',
  },
  title: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
  },
  sub: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    marginTop: '4px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  // --- mapping phase: two-panel master/detail ---
  twoPanel: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '20px',
    maxHeight: '56vh',
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  panel: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  panelHead: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-muted)',
  },
  panelScroll: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflow: 'auto',
    paddingRight: '4px',
  },
  // Left panel: a selectable source row (file variable or the app-data group).
  sourceRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'border-color 0.1s ease, background-color 0.1s ease',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
  },
  // Active source: the animated AI glow ring (.ai-glow-border, added on the
  // element in JSX) draws the edge, so this just sets the soft-violet fill and
  // clears the resting border to avoid doubling the ring.
  sourceRowActive: {
    borderColor: 'transparent',
    backgroundColor: 'var(--ds-ai-surface)',
  },
  sourceIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '18px',
    '& svg': { width: '18px', height: '18px' },
  },
  sourceIconActive: {
    backgroundColor: 'var(--ds-ai-primary)',
    color: '#fff',
  },
  sourceInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  sourceName: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sourceMeta: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  sourceMetaMapped: { color: '#047857' },
  sourceCheck: { color: 'var(--ds-suitable)', flexShrink: 0, display: 'flex' },
  // Right panel: the selected source's file picker + its question checklist.
  detailHead: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-heading)',
    marginBottom: '4px',
  },
  // Each source's question group on the right. The active group gets a soft
  // violet tint so it visually pairs with the highlighted left-panel row.
  qGroup: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid transparent',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
  },
  qGroupActive: {
    backgroundColor: 'var(--ds-ai-surface)',
    borderColor: 'var(--ds-ai-border)',
  },
  qPickList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  // Force the Fluent Checkbox label to use the app font — Fluent pulls its own
  // family/size from the theme, which mismatched the Inter used elsewhere.
  qPick: {
    fontSize: 'var(--ds-fs-body)',
    '& label': {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--ds-fs-body)',
      color: 'var(--ds-text-body)',
    },
  },
  qPickLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--ds-fs-body)',
  },
  qPickAnswered: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: 'var(--ds-radius-pill)',
    backgroundColor: 'var(--ds-pending-soft)',
    color: '#b45309',
  },
  mapVar: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-ai-primary)',
  },
  mapDropdown: { width: '100%', marginBottom: '14px' },
  detailEmpty: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    fontStyle: 'italic',
    padding: '20px 0',
    textAlign: 'center',
  },
  // --- review phase ---
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '54vh',
    overflow: 'auto',
    paddingRight: '4px',
  },
  card: {
    border: '1px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '12px 14px',
    backgroundColor: 'var(--ds-surface-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardAccepted: {
    backgroundColor: 'var(--ds-suitable-soft)',
    border: '1px solid var(--ds-suitable)',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  qBlock: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  qLabel: { fontSize: '13px', fontWeight: 500, color: 'var(--ds-text-strong)' },
  overwriteTag: {
    marginLeft: '8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: 'var(--ds-radius-pill)',
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    color: '#b45309',
    whiteSpace: 'nowrap',
  },
  qValue: {
    fontSize: '13px',
    color: 'var(--ds-ai-primary)',
    fontWeight: 500,
    wordBreak: 'break-word',
  },
  rationale: {
    fontSize: '11px',
    color: 'var(--ds-text-body)',
    lineHeight: 1.45,
    fontStyle: 'italic',
  },
  confChip: {
    flexShrink: 0,
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--ds-radius-pill)',
    whiteSpace: 'nowrap',
  },
  confHigh: { backgroundColor: 'var(--ds-suitable-soft)', color: '#047857' },
  confMed: { backgroundColor: 'var(--ds-pending-soft, #FEF3C7)', color: '#b45309' },
  confLow: { backgroundColor: 'var(--ds-not-suitable-soft)', color: '#b91c1c' },
  cardActions: { display: 'flex', justifyContent: 'flex-end' },
  acceptedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#047857',
  },
  loadingPad: {
    padding: '52px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  loadingSub: {
    fontSize: '12px',
    color: 'var(--ds-text-muted)',
    textAlign: 'center',
    maxWidth: '380px',
    lineHeight: 1.5,
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--ds-text-body)',
    lineHeight: 1.5,
  },
  // Footer laid out as a column: the button row on top, a status line beneath
  // it (full-width, so the counts read clearly under the actions instead of
  // crowding them on the left).
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '8px',
    width: '100%',
  },
  footerBtns: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  footerStatus: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
    textAlign: 'right',
  },
  // Keep every footer button on one line + same height — Fluent will otherwise
  // wrap a label like "Accept all (1)" when the action row gets tight.
  actionBtn: { whiteSpace: 'nowrap', flexShrink: 0 },
  warnStack: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' },
});

const NO_FILE = '__none__';

function displayValue(value: AiSuggestion['value'], dataType: DataType): string {
  if (dataType === 0) return value === true ? 'Yes' : value === false ? 'No' : '—';
  if (Array.isArray(value)) return value.join(', ');
  return value == null ? '—' : String(value);
}

function confClass(styles: ReturnType<typeof useStyles>, c: number): string {
  if (c >= 0.8) return `${styles.confChip} ${styles.confHigh}`;
  if (c >= 0.5) return `${styles.confChip} ${styles.confMed}`;
  return `${styles.confChip} ${styles.confLow}`;
}

export interface AcceptedSuggestion {
  level: Dnx_assessment_levels;
  suggestion: AiSuggestion;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessmentName: string;
  /**
   * All Question levels (answered or not, visible or not). The dialog narrows
   * to those carrying a file variable; the assessor picks which proposals to
   * apply in the review step, so it's safe to offer everything.
   */
  questions: Dnx_assessment_levels[];
  /**
   * Level ids that already have an answer — the review list flags these so the
   * assessor knows accepting will overwrite the current value.
   */
  answeredLevelIds: Set<string>;
  /** Real uploaded evidence file names the variables can be mapped to. */
  availableFiles: string[];
  /**
   * Previously-saved variable → file mapping for this instance, as the raw JSON
   * string from `dnx_evidence_mapping`. Parsed inside (kept as a string so the
   * parent doesn't churn object identity every render). Used as the base the
   * assessor's picks override, so reopening restores their earlier choices.
   */
  persistedMappingJson?: string;
  /** Persist the effective mapping (called when the assessor runs auto-fill). */
  onPersistMapping?: (mapping: Record<string, string>) => void;
  /** Called once per accepted suggestion — caller persists via useUpsertResponse. */
  onAccept: (accepted: AcceptedSuggestion) => void;
  /**
   * The assessment's parsed application-details JSON, so questions bound to JSON
   * attributes (in the AI conditioning tab) can inject those facts into their
   * prompt. Null / omitted when the instance has no application-details file.
   */
  applicationData?: Record<string, unknown> | null;
}

/**
 * AI auto-fill, assessment-time. Two phases:
 *
 *   1. **Map** — each evidence file variable declared on the template's
 *      questions is listed; the assessor binds it to a real uploaded file.
 *   2. **Review** — runs one extraction per mapped file + one AI call per
 *      variable group, then lists the proposals with confidence chips. The
 *      assessor accepts answers individually or in bulk; nothing is written
 *      until accepted.
 *
 * Mapping is pre-filled with a best-guess match (a file whose name contains the
 * variable, case-insensitive) so the common case is one click to Run.
 */
export function AiPopulateDialog({
  open,
  onOpenChange,
  assessmentName,
  questions,
  answeredLevelIds,
  availableFiles,
  persistedMappingJson,
  onPersistMapping,
  onAccept,
  applicationData,
}: Props) {
  const styles = useStyles();
  const populate = useAiPopulateMapped(assessmentName);
  const [phase, setPhase] = useState<'map' | 'review'>('map');
  // Only the assessor's explicit picks live in state; the effective mapping
  // merges these over an auto-derived best guess (below). NO_FILE marks a
  // variable the assessor deliberately unmapped (overriding a guess).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  // Which question levelIds will actually be sent to the AI. Lets the assessor
  // trim the batch so the agent is queried as little as possible. Defaults to
  // the unanswered bound questions (re-querying an answered one is opt-in).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const aiQuestions = useMemo(() => toAiQuestions(questions), [questions]);
  const { groups, unbound } = useMemo(
    () => groupByFileVariable(aiQuestions),
    [aiQuestions],
  );
  // Questions with no file variable but WITH application-data attributes — these
  // are judged from the JSON alone (no evidence file). Only meaningful when the
  // instance actually supplied an application-details file.
  const appOnlyQuestions = useMemo(
    () =>
      applicationData
        ? unbound.filter((q) => (q.applicationDataPaths?.length ?? 0) > 0)
        : [],
    [unbound, applicationData],
  );

  // Default selection: every bound question (file-grouped OR JSON-only) that
  // isn't already answered.
  const defaultSelected = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) {
      for (const q of g.questions) {
        if (!answeredLevelIds.has(q.levelId)) s.add(q.levelId);
      }
    }
    for (const q of appOnlyQuestions) {
      if (!answeredLevelIds.has(q.levelId)) s.add(q.levelId);
    }
    return s;
  }, [groups, appOnlyQuestions, answeredLevelIds]);
  const levelById = useMemo(
    () => new Map(questions.map((q) => [q.dnx_assessment_levelid, q] as const)),
    [questions],
  );

  // Base mapping per variable: prefer the assessor's previously-saved pick;
  // otherwise fall back to a name-match guess (a file whose name contains the
  // variable, case-insensitive). Recomputed only when inputs change — pure.
  const base = useMemo(() => {
    const saved = parseEvidenceMapping(persistedMappingJson);
    const out: Record<string, string> = {};
    for (const g of groups) {
      const savedPick = saved[g.fileVariable];
      if (savedPick && availableFiles.includes(savedPick)) {
        out[g.fileVariable] = savedPick;
        continue;
      }
      const v = g.fileVariable.toLowerCase();
      const hit = availableFiles.find((f) => f.toLowerCase().includes(v));
      if (hit) out[g.fileVariable] = hit;
    }
    return out;
  }, [groups, availableFiles, persistedMappingJson]);

  // Effective mapping the UI + run use: base, with this-session overrides on
  // top. NO_FILE in overrides removes the variable from the mapping entirely.
  const mapping = useMemo(() => {
    const out: Record<string, string> = { ...base };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === NO_FILE) delete out[k];
      else out[k] = v;
    }
    return out;
  }, [base, overrides]);

  // Reset overrides / phase / accepted each time the dialog reopens — derived
  // during render from a tracked previous-open flag (React's endorsed
  // "adjust state on prop change" pattern; no effect, so no cascading render).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setOverrides({});
      setAccepted(new Set());
      setSelected(defaultSelected);
      setPhase('map');
      populate.reset();
    }
  }

  function setVar(variable: string, file: string) {
    setOverrides((prev) => ({ ...prev, [variable]: file }));
  }

  function toggleQuestion(levelId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  }

  const mappedCount = groups.filter((g) => mapping[g.fileVariable]).length;

  // Groups trimmed to the selected questions only — this is exactly what gets
  // sent to the AI, so unticked questions are never queried. A mapped variable
  // with zero selected questions is dropped (no point extracting its file).
  const runnableGroups = groups
    .map((g) => ({
      ...g,
      questions: g.questions.filter((q) => selected.has(q.levelId)),
    }))
    .filter((g) => g.questions.length > 0 && mapping[g.fileVariable]);
  // JSON-only questions the assessor kept selected — run with no evidence file.
  const runnableAppOnly = appOnlyQuestions.filter((q) => selected.has(q.levelId));
  const selectedRunCount =
    runnableGroups.reduce((n, g) => n + g.questions.length, 0) + runnableAppOnly.length;

  function run() {
    // Persist the assessor's effective picks so reopening restores them.
    onPersistMapping?.(mapping);
    setAccepted(new Set());
    setPhase('review');
    populate.mutate({
      groups: runnableGroups,
      mapping,
      applicationData,
      applicationOnlyQuestions: runnableAppOnly,
    });
  }

  function acceptOne(s: AiSuggestion) {
    const level = levelById.get(s.levelId);
    if (!level) return;
    onAccept({ level, suggestion: s });
    setAccepted((prev) => new Set(prev).add(s.levelId));
  }

  function acceptAll() {
    for (const s of populate.data?.suggestions ?? []) {
      if (!accepted.has(s.levelId)) acceptOne(s);
    }
  }

  const suggestions = populate.data?.suggestions ?? [];
  const remaining = suggestions.filter((s) => !accepted.has(s.levelId)).length;

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface className={`${styles.surface} ai-glow-border`}>
        <DialogBody>
          <DialogContent>
            <div className={styles.title}>
              <Sparkle16Filled style={{ color: 'var(--ds-ai-primary)' }} />
              AI auto-fill
            </div>

            {phase === 'map' ? (
              <MapPhase
                styles={styles}
                groups={groups}
                appOnlyQuestions={appOnlyQuestions}
                skippedCount={unbound.length - appOnlyQuestions.length}
                availableFiles={availableFiles}
                mapping={mapping}
                onSetVar={setVar}
                selected={selected}
                answeredLevelIds={answeredLevelIds}
                onToggleQuestion={toggleQuestion}
              />
            ) : (
              <>
                <div className={styles.sub}>
                  Proposals are drafted from the mapped files. Review each — nothing
                  is saved until you accept it.
                </div>

                {populate.isPending && (
                  <div className={styles.loadingPad}>
                    <Spinner size="small" label="Reading evidence & drafting answers…" />
                    <div className={styles.loadingSub}>
                      Extracting each mapped file once and asking the assistant to
                      answer its questions using the template's instructions.
                    </div>
                  </div>
                )}

                {populate.isError && (
                  <MessageBar intent="error">
                    <MessageBarBody>{(populate.error as Error).message}</MessageBarBody>
                  </MessageBar>
                )}

                {!populate.isPending && !populate.isError && populate.data && (
                  <>
                    {populate.data.warnings.length > 0 && (
                      <div className={styles.warnStack}>
                        {populate.data.warnings.map((w, i) => (
                          <MessageBar key={i} intent="warning">
                            <MessageBarBody>{w}</MessageBarBody>
                          </MessageBar>
                        ))}
                      </div>
                    )}
                    {suggestions.length === 0 ? (
                      <div className={styles.empty}>
                        The assistant couldn’t confidently answer any of the mapped
                        questions from those files.
                      </div>
                    ) : (
                      <div className={styles.list}>
                        {suggestions.map((s) => {
                          const level = levelById.get(s.levelId);
                          const isAccepted = accepted.has(s.levelId);
                          const willOverwrite = answeredLevelIds.has(s.levelId);
                          const dataType = (level?.dnx_data_type ?? 3) as DataType;
                          return (
                            <div
                              key={s.levelId}
                              className={`${styles.card} ${isAccepted ? styles.cardAccepted : ''}`}
                            >
                              <div className={styles.cardTop}>
                                <div className={styles.qBlock}>
                                  <span className={styles.qLabel}>
                                    {level?.dnx_name ?? 'Question'}
                                    {willOverwrite && !isAccepted && (
                                      <span className={styles.overwriteTag}>
                                        replaces current answer
                                      </span>
                                    )}
                                  </span>
                                  <span className={styles.qValue}>
                                    {displayValue(s.value, dataType)}
                                  </span>
                                  <span className={styles.rationale}>{s.rationale}</span>
                                </div>
                                <span className={confClass(styles, s.confidence)}>
                                  {Math.round(s.confidence * 100)}%
                                </span>
                              </div>
                              <div className={styles.cardActions}>
                                {isAccepted ? (
                                  <span className={styles.acceptedTag}>
                                    <CheckmarkCircle16Filled />
                                    Applied
                                  </span>
                                ) : (
                                  <Button
                                    size="small"
                                    appearance="primary"
                                    onClick={() => acceptOne(s)}
                                  >
                                    Accept
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            {phase === 'map' ? (
              <div className={styles.footer}>
                <div className={styles.footerBtns}>
                  <Button
                    className={styles.actionBtn}
                    appearance="secondary"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={styles.actionBtn}
                    appearance="primary"
                    onClick={run}
                    disabled={selectedRunCount === 0}
                  >
                    {selectedRunCount > 0 ? `Run on ${selectedRunCount}` : 'Run'}
                  </Button>
                </div>
                <span className={styles.footerStatus}>
                  {groups.length === 0 && appOnlyQuestions.length === 0
                    ? 'No AI bindings on this template.'
                    : `${mappedCount}/${groups.length} files mapped · ${selectedRunCount} question${selectedRunCount === 1 ? '' : 's'} selected`}
                </span>
              </div>
            ) : (
              <div className={styles.footer}>
                <div className={styles.footerBtns}>
                  {!populate.isPending && (
                    <Button
                      className={styles.actionBtn}
                      appearance="secondary"
                      icon={<ArrowClockwise16Regular />}
                      onClick={() => setPhase('map')}
                    >
                      Back
                    </Button>
                  )}
                  {remaining > 0 && (
                    <Button
                      className={styles.actionBtn}
                      appearance="primary"
                      onClick={acceptAll}
                    >
                      Accept all ({remaining})
                    </Button>
                  )}
                  <Button
                    className={styles.actionBtn}
                    appearance="secondary"
                    onClick={() => onOpenChange(false)}
                  >
                    {accepted.size > 0 ? 'Done' : 'Close'}
                  </Button>
                </div>
                {populate.data && suggestions.length > 0 && (
                  <span className={styles.footerStatus}>
                    {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'} ·{' '}
                    {accepted.size} applied
                  </span>
                )}
              </div>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Phase 1: map each file variable to an upload + pick which questions to run. */
function MapPhase({
  styles,
  groups,
  appOnlyQuestions,
  skippedCount,
  availableFiles,
  mapping,
  onSetVar,
  selected,
  answeredLevelIds,
  onToggleQuestion,
}: {
  styles: ReturnType<typeof useStyles>;
  groups: FileVariableGroup[];
  /** Questions judged from application-data JSON alone (no file variable). */
  appOnlyQuestions: AiQuestion[];
  /** Questions with neither a file variable nor application-data — truly skipped. */
  skippedCount: number;
  availableFiles: string[];
  mapping: Record<string, string>;
  onSetVar: (variable: string, file: string) => void;
  selected: Set<string>;
  answeredLevelIds: Set<string>;
  onToggleQuestion: (levelId: string) => void;
}) {
  // Unify file-variable groups + the app-data group into one "source" list so
  // the two-panel layout can render them the same way. `fileVar` is null for the
  // application-data source (it has no upload to map). Computed before any early
  // return so the hook below always runs in the same order (rules-of-hooks).
  type Source = {
    id: string;
    name: string;
    fileVar: string | null;
    questions: AiQuestion[];
  };
  const sources: Source[] = [
    ...groups.map((g) => ({
      id: `file:${g.fileVariable}`,
      name: g.fileVariable,
      fileVar: g.fileVariable,
      questions: g.questions,
    })),
    ...(appOnlyQuestions.length > 0
      ? [
          {
            id: 'appdata',
            name: 'Application data',
            fileVar: null,
            questions: appOnlyQuestions,
          },
        ]
      : []),
  ];

  const [activeId, setActiveId] = useState('');
  // Keep a valid selection: fall back to the first source when the stored id
  // isn't present (initial render, or the list changed) so one group always
  // reads as active.
  const active = sources.find((s) => s.id === activeId) ?? sources[0];
  // Per-group DOM refs so clicking a left row scrolls its group into view.
  const groupRefs = useRef(new Map<string, HTMLDivElement | null>());

  if (groups.length === 0 && appOnlyQuestions.length === 0) {
    // Nothing to run: no question carries a file variable OR bound
    // application-data. (Answered / hidden questions ARE offered now.)
    return (
      <div className={styles.empty}>
        No questions on this template have an AI binding yet. Open the template in the
        editor and add one in the <b>AI conditioning</b> tab — give the question a{' '}
        <b>file variable</b> and/or bind <b>application-data attributes</b>.
      </div>
    );
  }

  const sourceMapped = (s: Source) =>
    s.fileVar ? Boolean(mapping[s.fileVar]) : true; // app-data is always "ready"
  const sourceSelectedCount = (s: Source) =>
    s.questions.filter((q) => selected.has(q.levelId)).length;

  return (
    <>
      <div className={styles.sub}>
        Map each evidence file to an upload, then tick the questions to send. Only
        ticked questions go to the assistant — already-answered ones are unticked by
        default. Click a source on the left to jump to its questions.
        {skippedCount > 0 &&
          ` (${skippedCount} question${skippedCount === 1 ? '' : 's'} have no data and are skipped.)`}
      </div>
      {availableFiles.length === 0 && groups.length > 0 && (
        <MessageBar intent="warning" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            No evidence files have been uploaded yet. Upload them first, then map them
            here.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.twoPanel}>
        {/* Left: sources — a clickable summary that highlights + scrolls to a
            group on the right. The active row is emphasised so it's obvious
            which source you're looking at. */}
        <div className={styles.panel}>
          <span className={styles.panelHead}>Evidence files & data sources</span>
          <div className={styles.panelScroll}>
            {sources.map((s) => {
              const isActive = s.id === active?.id;
              const mapped = sourceMapped(s);
              const selCount = sourceSelectedCount(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.sourceRow} ${isActive ? `${styles.sourceRowActive} ai-glow-border` : ''}`}
                  onClick={() => {
                    setActiveId(s.id);
                    groupRefs.current.get(s.id)?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                    });
                  }}
                  aria-pressed={isActive}
                >
                  <span
                    className={`${styles.sourceIcon} ${isActive ? styles.sourceIconActive : ''}`}
                  >
                    {s.fileVar ? <Document16Regular /> : <Database16Regular />}
                  </span>
                  <span className={styles.sourceInfo}>
                    <span className={styles.sourceName}>{s.name}</span>
                    <span
                      className={`${styles.sourceMeta} ${mapped && s.fileVar ? styles.sourceMetaMapped : ''}`}
                    >
                      {s.fileVar
                        ? mapped
                          ? `${selCount} of ${s.questions.length} selected`
                          : 'Not mapped'
                        : `${selCount} of ${s.questions.length} selected · no file`}
                    </span>
                  </span>
                  {mapped && s.fileVar && (
                    <span className={styles.sourceCheck}>
                      <Checkmark16Filled />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: ALL sources' questions, grouped. Every group shows its file
            picker (for file sources) + its question checklist by default. */}
        <div className={styles.panel}>
          <span className={styles.panelHead}>Questions</span>
          <div className={styles.panelScroll}>
            {sources.map((s) => {
              const isActive = s.id === active?.id;
              return (
                <div
                  key={s.id}
                  ref={(el) => {
                    groupRefs.current.set(s.id, el);
                  }}
                  className={`${styles.qGroup} ${isActive ? styles.qGroupActive : ''}`}
                >
                  <span className={styles.detailHead}>
                    {s.fileVar ? `Mapped from ${s.name}` : 'Judged from application data'}
                  </span>

                  {s.fileVar && (
                    <Dropdown
                      className={styles.mapDropdown}
                      value={mapping[s.fileVar] ?? 'Not mapped'}
                      selectedOptions={[mapping[s.fileVar] ?? NO_FILE]}
                      onOptionSelect={(_, d) => onSetVar(s.fileVar!, d.optionValue ?? NO_FILE)}
                      placeholder="Choose a file…"
                    >
                      <Option value={NO_FILE} text="Not mapped">
                        Not mapped
                      </Option>
                      {availableFiles.map((f) => (
                        <Option key={f} value={f} text={f}>
                          {f}
                        </Option>
                      ))}
                    </Dropdown>
                  )}

                  <div className={styles.qPickList}>
                    {s.questions.map((q) => (
                      <Checkbox
                        key={q.levelId}
                        className={styles.qPick}
                        checked={selected.has(q.levelId)}
                        disabled={!sourceMapped(s)}
                        onChange={() => onToggleQuestion(q.levelId)}
                        label={
                          <span className={styles.qPickLabel}>
                            {q.label}
                            {answeredLevelIds.has(q.levelId) && (
                              <span className={styles.qPickAnswered}>answered</span>
                            )}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
