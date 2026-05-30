import { useEffect, useState } from 'react';
import {
  Dropdown,
  Option,
  Input,
  Field,
  Button,
  Switch,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Delete16Regular, CheckmarkCircle16Filled } from '@fluentui/react-icons';
import { parseOptions } from '../templates/levels/options';
import type { DataType } from '../templates/levels/levelTypes';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import {
  useCriteriaForLevel,
  useUpsertCriteria,
  useDeleteCriteria,
} from './api';
import {
  OPERATOR_LABEL,
  operatorsForDataType,
  operatorNeedsTarget,
  parseGroups,
  serializeGroups,
  type OperatorKey,
  type ScoringTypeKey,
  type ScoringGroup,
} from './types';
import { GroupListEditor } from './GroupListEditor';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  switchSide: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  card: {
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: 'var(--color-background-secondary)',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    '> *': { minWidth: 0 },
  },
  fluid: {
    width: '100%',
    minWidth: 0,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
  savedFlag: {
    fontSize: '11px',
    color: 'var(--color-green-text)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
});

interface Props {
  level: Dnx_assessment_levels;
}

interface DraftState {
  enabled: boolean;
  // Question-only — ignored at runtime for non-question levels.
  operator: OperatorKey;
  targetValue: string;
  /**
   * Question-only — how heavily this question counts in its parent's
   * "At least X% must pass" math. Default 1 (normal). 2 = double-weighted.
   * Ignored when the parent uses "Every child must pass".
   */
  importance: number;
  // Parent-only fields (Subsection / Section).
  scoringType: ScoringTypeKey;
  /** Percent (0–100) — Weighted mode pass threshold. */
  passThresholdPct: number;
  /** Groups (Grouped mode only). Empty otherwise. */
  groups: ScoringGroup[];
}

// Outcomes are no longer user-selectable — every rule passes as "Suitable"
// and fails as "Not suitable". The picklist keys still need values to persist
// to Dataverse; we always send Suitable/NotSuitable.
function defaultDraft(_levelType: number, dataType: DataType): DraftState {
  const ops = operatorsForDataType(dataType);
  return {
    enabled: false,
    operator: ops[0] ?? 'Equals',
    targetValue: '',
    importance: 1,
    scoringType: 'Boolean',
    passThresholdPct: 50,
    groups: [],
  };
}

export function CriteriaEditor({ level }: Props) {
  const styles = useStyles();
  const levelId = level.dnx_assessment_levelid;
  // Note: numeric type so the Root level (0) — used as the carrier for the
  // assessment-outcome rule — can be compared too. The public `LevelType`
  // union is 1|2|3; widening to number here keeps the engine + editor in sync.
  const levelType = (level.dnx_assessment_level_type ?? 1) as number;
  const isQuestion = levelType === 3;
  const dataType = (level.dnx_data_type ?? 3) as DataType;
  const operators = isQuestion ? operatorsForDataType(dataType) : [];
  const options =
    isQuestion && (dataType === 1 || dataType === 2)
      ? parseOptions(level.dnx_option_set_reference)
      : [];

  const { data: criteria, isLoading } = useCriteriaForLevel(levelId);
  const upsert = useUpsertCriteria(levelId);
  const remove = useDeleteCriteria(levelId);

  const existing = criteria?.[0];

  const [draft, setDraft] = useState<DraftState>(() => defaultDraft(levelType, dataType));
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // Hydrate from server when the row loads. We only overwrite when the row id
  // differs to avoid clobbering user edits mid-typing on the same record.
  useEffect(() => {
    if (existing) {
      setDraft({
        enabled: true,
        operator: existing.operator,
        targetValue: existing.targetValue,
        importance: existing.weight > 0 ? existing.weight : 1,
        scoringType: existing.scoringType,
        // Stored 0–1 internally; surfaced as 0–100% in the editor.
        passThresholdPct: Math.round((existing.passThreshold ?? 0.5) * 100),
        // Groups live in target_value when scoringType is Grouped; for other
        // modes target_value is just an empty string (Question rules don't
        // reuse this field at parent level).
        groups:
          existing.scoringType === 'Grouped' ? parseGroups(existing.targetValue) : [],
      });
    } else if (!isLoading) {
      setDraft(defaultDraft(levelType, dataType));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, isLoading, levelId]);

  function patch(p: Partial<DraftState>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function handleToggle(checked: boolean) {
    patch({ enabled: checked });
    if (!checked && existing) {
      await remove.mutateAsync(existing.id);
    }
  }

  async function handleSave() {
    const needsTarget = isQuestion && operatorNeedsTarget(draft.operator);
    // sourceType maps level type → which roll-up tier the criteria belongs to.
    // 0 = Question Value, 1 = Subsection Outcome, 2 = Section Outcome.
    const sourceType: 0 | 1 | 2 = isQuestion ? 0 : levelType === 2 ? 1 : 2;
    // target_value is overloaded for parent Grouped rules: it carries the
    // serialized groups JSON. Questions still use it as the comparison
    // target string; parents in Boolean/Weighted mode leave it empty.
    let parentTargetValue = '';
    if (!isQuestion && draft.scoringType === 'Grouped') {
      parentTargetValue = serializeGroups(draft.groups);
    }
    const id = await upsert.mutateAsync({
      id: existing?.id,
      levelId,
      // Root level has a placeholder name (`_root_`); use a friendlier title
      // so the criteria row reads sensibly in the maker portal.
      name: levelType === 0 ? 'Assessment outcome rule' : `${level.dnx_name} rule`,
      operator: draft.operator,
      targetValue: isQuestion ? (needsTarget ? draft.targetValue : '') : parentTargetValue,
      // Outcomes collapsed to a single Suitable / Not suitable pair.
      outcomeIfPass: 'Suitable',
      outcomeIfFail: 'NotSuitable',
      // Questions always use the "Every child" path (no roll-up to do).
      scoringType: isQuestion ? 'Boolean' : draft.scoringType,
      passThreshold:
        !isQuestion && draft.scoringType === 'Weighted' ? draft.passThresholdPct / 100 : 1,
      // Question rules carry per-question importance; parent rules always
      // save 1 (parents themselves don't "weight" — their children do).
      weight: isQuestion ? draft.importance : 1,
      sourceType,
    });
    setJustSavedId(id);
    setTimeout(() => setJustSavedId((curr) => (curr === id ? null : curr)), 1800);
  }

  const needsTarget = isQuestion && operatorNeedsTarget(draft.operator);
  const isChoiceType = isQuestion && (dataType === 1 || dataType === 2);
  const isDate = isQuestion && dataType === 4;

  if (isQuestion && operators.length === 0) {
    return (
      <div className={styles.hint}>
        This question's data type doesn't support evaluation rules yet.
      </div>
    );
  }

  // Friendly description above the rule. Differs per level type so the editor
  // makes sense without re-reading the docs.
  const description = isQuestion
    ? "Marks this question as passing or failing based on the assessor's answer. Used for live preview and the cascade up to section / assessment outcomes."
    : levelType === 2
      ? 'Combines the pass/fail outcomes of the questions in this subsection into a single subsection outcome.'
      : levelType === 1
        ? 'Combines the pass/fail outcomes of every subsection and question in this section into a single section outcome.'
        : 'Combines the outcomes of every section into the overall assessment verdict (Suitable / Not suitable).';

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {isQuestion ? 'Pass / fail rule' : 'Roll-up rule'}
          </div>
          <div className={styles.hint}>{description}</div>
        </div>
        <div className={styles.switchSide}>
          {isLoading ? (
            <Spinner size="extra-tiny" />
          ) : (
            <Switch
              checked={draft.enabled}
              onChange={(_, d) => handleToggle(d.checked)}
              disabled={remove.isPending}
            />
          )}
        </div>
      </div>

      {draft.enabled && (
        <div className={styles.card}>
          {isQuestion && (
            <>
              <Field label="When the answer">
                <Dropdown
                  className={styles.fluid}
                  value={OPERATOR_LABEL[draft.operator]}
                  selectedOptions={[draft.operator]}
                  onOptionSelect={(_, d) => {
                    if (d.optionValue) {
                      patch({
                        operator: d.optionValue as OperatorKey,
                        targetValue: '',
                      });
                    }
                  }}
                >
                  {operators.map((op) => (
                    <Option key={op} value={op}>
                      {OPERATOR_LABEL[op]}
                    </Option>
                  ))}
                </Dropdown>
              </Field>

              {needsTarget && (
                <Field label="this value">
                  {isChoiceType ? (
                    <Dropdown
                      className={styles.fluid}
                      value={draft.targetValue}
                      selectedOptions={draft.targetValue ? [draft.targetValue] : []}
                      onOptionSelect={(_, d) => patch({ targetValue: d.optionValue ?? '' })}
                      placeholder="Pick an option"
                    >
                      {options.map((opt) => (
                        <Option key={opt} value={opt}>
                          {opt}
                        </Option>
                      ))}
                    </Dropdown>
                  ) : isDate ? (
                    <Input
                      type="date"
                      value={draft.targetValue}
                      onChange={(_, d) => patch({ targetValue: d.value })}
                    />
                  ) : (
                    <Input
                      value={draft.targetValue}
                      onChange={(_, d) => patch({ targetValue: d.value })}
                      placeholder="Expected value"
                    />
                  )}
                </Field>
              )}

              <Field
                label="Importance"
                hint="How heavily this question counts in its parent's % threshold. 1 = normal (default). 2 = counts as two questions. Has no effect when the parent uses 'Every child must pass'."
              >
                <Input
                  type="number"
                  value={String(draft.importance)}
                  onChange={(_, d) => {
                    const n = parseFloat(d.value);
                    patch({ importance: Number.isFinite(n) && n > 0 ? n : 1 });
                  }}
                  min={1}
                  step={1}
                />
              </Field>
            </>
          )}

          {!isQuestion && (
            <>
              <Field
                label="How does this level pass?"
                hint={
                  draft.scoringType === 'Boolean'
                    ? 'Every child must pass for this level to pass.'
                    : draft.scoringType === 'Weighted'
                      ? 'Pass when at least this percent of children pass.'
                      : 'Define groups of questions where only N of M members need to pass. Ungrouped children must still pass individually.'
                }
              >
                <Dropdown
                  className={styles.fluid}
                  value={
                    draft.scoringType === 'Boolean'
                      ? 'Every child must pass'
                      : draft.scoringType === 'Weighted'
                        ? 'At least X% must pass'
                        : 'By groups (N of M)'
                  }
                  selectedOptions={[draft.scoringType]}
                  onOptionSelect={(_, d) => {
                    if (d.optionValue) {
                      patch({ scoringType: d.optionValue as ScoringTypeKey });
                    }
                  }}
                >
                  <Option value="Boolean">Every child must pass</Option>
                  <Option value="Weighted">At least X% must pass</Option>
                  <Option value="Grouped">By groups (N of M)</Option>
                </Dropdown>
              </Field>

              {draft.scoringType === 'Weighted' && (
                <Field
                  label="Minimum % of children that must pass"
                  hint="e.g. 50 means at least half must pass."
                >
                  <Input
                    type="number"
                    value={String(draft.passThresholdPct)}
                    onChange={(_, d) => {
                      const n = parseInt(d.value, 10);
                      patch({
                        passThresholdPct: Number.isFinite(n)
                          ? Math.max(0, Math.min(100, n))
                          : 0,
                      });
                    }}
                    min={0}
                    max={100}
                    step={5}
                    contentAfter="%"
                  />
                </Field>
              )}

              {draft.scoringType === 'Grouped' && (
                <GroupListEditor
                  level={level}
                  groups={draft.groups}
                  onChange={(groups) => patch({ groups })}
                />
              )}
            </>
          )}

          {(upsert.error || remove.error) && (
            <MessageBar intent="error">
              <MessageBarBody>
                {(upsert.error ?? remove.error) instanceof Error
                  ? (upsert.error ?? remove.error)!.message
                  : 'Save failed'}
              </MessageBarBody>
            </MessageBar>
          )}

          <div className={styles.toolbar}>
            {justSavedId ? (
              <span className={styles.savedFlag}>
                <CheckmarkCircle16Filled /> Saved
              </span>
            ) : (
              <span />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {existing && (
                <Button
                  appearance="subtle"
                  icon={<Delete16Regular />}
                  disabled={remove.isPending}
                  onClick={() => handleToggle(false)}
                >
                  Remove
                </Button>
              )}
              <Button
                appearance="primary"
                disabled={
                  upsert.isPending ||
                  (needsTarget && draft.targetValue.trim() === '')
                }
                onClick={handleSave}
              >
                {upsert.isPending ? 'Saving...' : existing ? 'Save rule' : 'Add rule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
