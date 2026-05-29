import {
  Field,
  Dropdown,
  Option,
  OptionGroup,
  Input,
  Switch,
  makeStyles,
} from '@fluentui/react-components';
import type { VisibilityRule, VisibilityOperator } from './visibility';
import { operatorLabel } from './visibility';
import { BOOLEAN_VALUES, groupByParent, type EligibleQuestion } from './eligibleParents';

const useStyles = makeStyles({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '14px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-tertiary)',
    border: '0.5px solid var(--color-border-tertiary)',
  },
  switchRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
  },
  switchLabelGroup: { display: 'flex', flexDirection: 'column', gap: '2px' },
  switchLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  switchHint: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
  empty: {
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
});

interface Props {
  /** Current rule, or `undefined` when no condition is configured. */
  value: VisibilityRule | undefined;
  /** All eligible parent questions in the template. */
  parents: EligibleQuestion[];
  onChange: (next: VisibilityRule | undefined) => void;
}

export function VisibilityRuleEditor({ value, parents, onChange }: Props) {
  const styles = useStyles();
  const enabled = !!value;

  function toggleEnabled(on: boolean) {
    if (on) {
      const first = parents[0];
      if (!first) {
        // No eligible parents — toggle stays off; the empty state below explains.
        return;
      }
      onChange({
        showWhen: {
          questionId: first.id,
          operator: 'equals',
          value: defaultValueFor(first),
          questionLabel: first.parentPath
          ? `${first.parentPath} › ${first.label}`
          : first.label,
        },
      });
    } else {
      onChange(undefined);
    }
  }

  function selectParent(id: string) {
    const p = parents.find((x) => x.id === id);
    if (!p || !value) return;
    onChange({
      showWhen: {
        questionId: p.id,
        operator: value.showWhen.operator,
        value: defaultValueFor(p),
        questionLabel: p.parentPath ? `${p.parentPath} › ${p.label}` : p.label,
      },
    });
  }

  function setOperator(op: VisibilityOperator) {
    if (!value) return;
    onChange({ showWhen: { ...value.showWhen, operator: op } });
  }

  function setValue(v: string) {
    if (!value) return;
    onChange({ showWhen: { ...value.showWhen, value: v } });
  }

  const selectedParent = value
    ? parents.find((p) => p.id === value.showWhen.questionId)
    : undefined;

  return (
    <div className={styles.shell}>
      <div className={styles.switchRow}>
        <div className={styles.switchLabelGroup}>
          <span className={styles.switchLabel}>Conditional visibility</span>
          <span className={styles.switchHint}>
            Hide this question unless another question matches a specific answer.
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={(_, d) => toggleEnabled(d.checked)}
          disabled={!enabled && parents.length === 0}
        />
      </div>

      {parents.length === 0 && !enabled && (
        <div className={styles.empty}>
          No eligible source questions yet — add at least one Boolean or Option-set
          question elsewhere in this template before enabling visibility rules.
        </div>
      )}

      {enabled && value && (
        <>
          <Field label="Show this question when">
            <Dropdown
              value={
                selectedParent
                  ? selectedParent.parentPath
                    ? `${selectedParent.parentPath} › ${selectedParent.label}`
                    : selectedParent.label
                  : ''
              }
              selectedOptions={[value.showWhen.questionId]}
              onOptionSelect={(_, d) => d.optionValue && selectParent(d.optionValue)}
              placeholder="Pick a question"
            >
              {groupByParent(parents).map((group) => (
                <OptionGroup key={group.key} label={group.path}>
                  {group.questions.map((p) => (
                    <Option key={p.id} value={p.id}>
                      {p.label}
                    </Option>
                  ))}
                </OptionGroup>
              ))}
            </Dropdown>
          </Field>

          <Field label="Operator">
            <Dropdown
              value={operatorLabel(value.showWhen.operator, selectedParent?.dataType)}
              selectedOptions={[value.showWhen.operator]}
              onOptionSelect={(_, d) =>
                d.optionValue && setOperator(d.optionValue as VisibilityOperator)
              }
            >
              <Option value="equals">
                {operatorLabel('equals', selectedParent?.dataType)}
              </Option>
              <Option value="notEquals">
                {operatorLabel('notEquals', selectedParent?.dataType)}
              </Option>
            </Dropdown>
          </Field>

          <Field
            label="Value"
            hint={
              selectedParent?.dataType === 2
                ? 'Rule fires when this option is among the values the assessor selected.'
                : undefined
            }
          >
            {renderValueInput(selectedParent, value.showWhen.value, setValue)}
          </Field>
        </>
      )}
    </div>
  );
}

function defaultValueFor(parent: EligibleQuestion): string {
  if (parent.dataType === 0) return 'Yes';
  if (parent.options.length > 0) return parent.options[0];
  return '';
}

function renderValueInput(
  parent: EligibleQuestion | undefined,
  value: string,
  onChange: (v: string) => void,
) {
  if (!parent) {
    return (
      <Input value={value} onChange={(_, d) => onChange(d.value)} />
    );
  }
  if (parent.dataType === 0) {
    // Boolean — Yes / No dropdown
    return (
      <Dropdown
        value={value}
        selectedOptions={[value]}
        onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}
      >
        {BOOLEAN_VALUES.map((v) => (
          <Option key={v} value={v}>
            {v}
          </Option>
        ))}
      </Dropdown>
    );
  }
  if (parent.dataType === 1 || parent.dataType === 2) {
    // OptionSet single / multi — choose from the parent's option list
    return (
      <Dropdown
        value={value}
        selectedOptions={[value]}
        onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}
        placeholder="Pick an option"
      >
        {parent.options.map((o) => (
          <Option key={o} value={o}>
            {o}
          </Option>
        ))}
      </Dropdown>
    );
  }
  return <Input value={value} onChange={(_, d) => onChange(d.value)} />;
}
