import { useMemo, useState } from 'react';
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
} from '@fluentui/react-icons';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import { parseEvidenceMapping } from '../assessments/api';
import type { DataType } from '../templates/levels/levelTypes';
import {
  useAiPopulateMapped,
  toAiQuestions,
  groupByFileVariable,
  type AiSuggestion,
  type FileVariableGroup,
} from './aiPopulate';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '760px',
    width: '94vw',
    maxHeight: '90vh',
  },
  title: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  sub: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    marginTop: '3px',
    marginBottom: '14px',
    lineHeight: 1.5,
  },
  // --- mapping phase ---
  mapList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '56vh',
    overflow: 'auto',
    paddingRight: '4px',
  },
  // A variable group: the file-mapping header row + its question checklist.
  // No `overflow: hidden` here — it clips the question checklist. The inner
  // `qPickList` carries its own rounded bottom corners instead.
  mapGroup: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
  },
  mapRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
  },
  qPickList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '4px 14px 12px 14px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
    borderBottomLeftRadius: 'var(--border-radius-md)',
    borderBottomRightRadius: 'var(--border-radius-md)',
  },
  qPick: { fontSize: '13px' },
  qPickLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
  },
  qPickAnswered: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: 'var(--border-radius-pill)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  mapInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  mapVar: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-purple-text)',
  },
  mapCount: { fontSize: '11px', color: 'var(--color-text-secondary)' },
  mapDropdown: { minWidth: '220px', flexShrink: 0 },
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
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '12px 14px',
    backgroundColor: 'var(--color-background-primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardAccepted: {
    backgroundColor: 'var(--color-green-soft)',
    border: '0.5px solid var(--color-green)',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  qBlock: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  qLabel: { fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' },
  overwriteTag: {
    marginLeft: '8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: 'var(--border-radius-pill)',
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    whiteSpace: 'nowrap',
  },
  qValue: {
    fontSize: '13px',
    color: 'var(--color-purple-text)',
    fontWeight: 500,
    wordBreak: 'break-word',
  },
  rationale: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.45,
    fontStyle: 'italic',
  },
  confChip: {
    flexShrink: 0,
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--border-radius-pill)',
    whiteSpace: 'nowrap',
  },
  confHigh: { backgroundColor: 'var(--color-green-soft)', color: 'var(--color-green-text)' },
  confMed: { backgroundColor: 'var(--color-amber-soft)', color: 'var(--color-amber-text)' },
  confLow: { backgroundColor: 'var(--color-red-soft)', color: 'var(--color-red-text)' },
  cardActions: { display: 'flex', justifyContent: 'flex-end' },
  acceptedTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-green-text)',
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
    color: 'var(--color-text-tertiary)',
    textAlign: 'center',
    maxWidth: '380px',
    lineHeight: 1.5,
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
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
    color: 'var(--color-text-tertiary)',
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
  // Default selection: every bound question that isn't already answered.
  const defaultSelected = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) {
      for (const q of g.questions) {
        if (!answeredLevelIds.has(q.levelId)) s.add(q.levelId);
      }
    }
    return s;
  }, [groups, answeredLevelIds]);
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
  const selectedRunCount = runnableGroups.reduce(
    (n, g) => n + g.questions.length,
    0,
  );

  function run() {
    // Persist the assessor's effective picks so reopening restores them.
    onPersistMapping?.(mapping);
    setAccepted(new Set());
    setPhase('review');
    populate.mutate({ groups: runnableGroups, mapping });
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
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent>
            <div className={styles.title}>
              <Sparkle16Filled style={{ color: 'var(--color-purple)' }} />
              AI auto-fill
            </div>

            {phase === 'map' ? (
              <MapPhase
                styles={styles}
                groups={groups}
                unboundCount={unbound.length}
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
                  {groups.length === 0
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
  unboundCount,
  availableFiles,
  mapping,
  onSetVar,
  selected,
  answeredLevelIds,
  onToggleQuestion,
}: {
  styles: ReturnType<typeof useStyles>;
  groups: FileVariableGroup[];
  unboundCount: number;
  availableFiles: string[];
  mapping: Record<string, string>;
  onSetVar: (variable: string, file: string) => void;
  selected: Set<string>;
  answeredLevelIds: Set<string>;
  onToggleQuestion: (levelId: string) => void;
}) {
  if (groups.length === 0) {
    // Nothing to map: no question carries a file variable. (Answered / hidden
    // questions ARE offered now, so the only empty reason left is "none bound".)
    return (
      <div className={styles.empty}>
        No questions on this template have an AI binding yet. Open the template in the
        editor and add one in the <b>AI conditioning</b> tab — give the question a{' '}
        <b>file variable</b> (a query alone isn’t enough to map a file).
      </div>
    );
  }
  return (
    <>
      <div className={styles.sub}>
        Map each evidence file to one of your uploads, then tick the questions to run.
        Only ticked questions are sent to the assistant — already-answered ones are
        unticked by default so they aren’t re-queried.
        {unboundCount > 0 &&
          ` (${unboundCount} question${unboundCount === 1 ? '' : 's'} have no file variable and are skipped.)`}
      </div>
      {availableFiles.length === 0 && (
        <MessageBar intent="warning" style={{ marginBottom: 12 }}>
          <MessageBarBody>
            No evidence files have been uploaded yet. Upload the files above first,
            then map them here.
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.mapList}>
        {groups.map((g) => {
          const picked = mapping[g.fileVariable] ?? NO_FILE;
          const isMapped = picked !== NO_FILE;
          return (
            <div key={g.fileVariable} className={styles.mapGroup}>
              <div className={styles.mapRow}>
                <div className={styles.mapInfo}>
                  <span className={styles.mapVar}>
                    <Document16Regular />
                    {g.fileVariable}
                  </span>
                  <span className={styles.mapCount}>
                    {g.questions.length} question{g.questions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <Dropdown
                  className={styles.mapDropdown}
                  value={picked === NO_FILE ? 'Not mapped' : picked}
                  selectedOptions={[picked]}
                  onOptionSelect={(_, d) => onSetVar(g.fileVariable, d.optionValue ?? NO_FILE)}
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
              </div>
              {/* Per-question selection — disabled until the variable is mapped,
                  since an unmapped variable's questions can't be run anyway. */}
              <div className={styles.qPickList}>
                {g.questions.map((q) => (
                  <Checkbox
                    key={q.levelId}
                    className={styles.qPick}
                    checked={selected.has(q.levelId)}
                    disabled={!isMapped}
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
    </>
  );
}
