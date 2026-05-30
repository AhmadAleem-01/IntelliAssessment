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
  OUTCOME_PASS_LABEL,
  OUTCOME_FAIL_LABEL,
  OUTCOME_PASS,
  OUTCOME_FAIL,
  operatorsForDataType,
  operatorNeedsTarget,
  type OperatorKey,
  type OutcomePassKey,
  type OutcomeFailKey,
} from './types';

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
  operator: OperatorKey;
  targetValue: string;
  outcomeIfPass: OutcomePassKey;
  outcomeIfFail: OutcomeFailKey;
}

function defaultDraft(dataType: DataType): DraftState {
  const ops = operatorsForDataType(dataType);
  return {
    enabled: false,
    operator: ops[0] ?? 'Equals',
    targetValue: '',
    outcomeIfPass: 'Met',
    outcomeIfFail: 'NotMet',
  };
}

export function CriteriaEditor({ level }: Props) {
  const styles = useStyles();
  const levelId = level.dnx_assessment_levelid;
  const dataType = (level.dnx_data_type ?? 3) as DataType;
  const operators = operatorsForDataType(dataType);
  const options = dataType === 1 || dataType === 2 ? parseOptions(level.dnx_option_set_reference) : [];

  const { data: criteria, isLoading } = useCriteriaForLevel(levelId);
  const upsert = useUpsertCriteria(levelId);
  const remove = useDeleteCriteria(levelId);

  const existing = criteria?.[0];

  const [draft, setDraft] = useState<DraftState>(() => defaultDraft(dataType));
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // Hydrate the local draft from the server when the row loads or the level
  // changes. We only overwrite when the row id differs to avoid clobbering
  // user edits mid-typing on the same record.
  useEffect(() => {
    if (existing) {
      setDraft({
        enabled: true,
        operator: existing.operator,
        targetValue: existing.targetValue,
        outcomeIfPass: existing.outcomeIfPass,
        outcomeIfFail: existing.outcomeIfFail,
      });
    } else if (!isLoading) {
      setDraft(defaultDraft(dataType));
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
    const needsTarget = operatorNeedsTarget(draft.operator);
    const id = await upsert.mutateAsync({
      id: existing?.id,
      levelId,
      name: `${level.dnx_name} rule`,
      operator: draft.operator,
      targetValue: needsTarget ? draft.targetValue : '',
      outcomeIfPass: draft.outcomeIfPass,
      outcomeIfFail: draft.outcomeIfFail,
    });
    setJustSavedId(id);
    setTimeout(() => setJustSavedId((curr) => (curr === id ? null : curr)), 1800);
  }

  // What kind of input the target value field needs.
  const needsTarget = operatorNeedsTarget(draft.operator);
  const isChoiceType = dataType === 1 || dataType === 2;
  const isDate = dataType === 4;

  if (operators.length === 0) {
    return (
      <div className={styles.hint}>
        This question's data type doesn't support evaluation rules yet.
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Pass / fail rule</div>
          <div className={styles.hint}>
            Marks this question as passing or failing based on the assessor's answer.
            Used for live preview and the future cascade up to section / assessment outcomes.
          </div>
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
          <Field label="When the answer">
            <Dropdown
              value={OPERATOR_LABEL[draft.operator]}
              selectedOptions={[draft.operator]}
              onOptionSelect={(_, d) => {
                if (d.optionValue) patch({ operator: d.optionValue as OperatorKey, targetValue: '' });
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

          <div className={styles.twoCol}>
            <Field label="Outcome if pass">
              <Dropdown
                value={OUTCOME_PASS_LABEL[draft.outcomeIfPass]}
                selectedOptions={[draft.outcomeIfPass]}
                onOptionSelect={(_, d) => {
                  if (d.optionValue) patch({ outcomeIfPass: d.optionValue as OutcomePassKey });
                }}
              >
                {(Object.keys(OUTCOME_PASS) as OutcomePassKey[]).map((k) => (
                  <Option key={k} value={k}>
                    {OUTCOME_PASS_LABEL[k]}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            <Field label="Outcome if fail">
              <Dropdown
                value={OUTCOME_FAIL_LABEL[draft.outcomeIfFail]}
                selectedOptions={[draft.outcomeIfFail]}
                onOptionSelect={(_, d) => {
                  if (d.optionValue) patch({ outcomeIfFail: d.optionValue as OutcomeFailKey });
                }}
              >
                {(Object.keys(OUTCOME_FAIL) as OutcomeFailKey[]).map((k) => (
                  <Option key={k} value={k}>
                    {OUTCOME_FAIL_LABEL[k]}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>

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
