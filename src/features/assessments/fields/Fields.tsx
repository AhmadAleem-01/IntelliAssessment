/**
 * Per-data-type field components for the assessment runtime.
 *
 * Each field renders the appropriate input for one of the 5 question data
 * types (Boolean / OptionSet / Multiselect / Text / Date) and reports the
 * normalised value through a single `onChange(value)` callback. Storage
 * mapping happens upstream in `useUpsertResponse` — these components only
 * deal in the natural in-memory shapes:
 *
 *   Boolean    → boolean
 *   OptionSet  → string (the selected label)
 *   Multi      → string[] (selected labels)
 *   Text       → string
 *   Date       → string (YYYY-MM-DD)
 */

import {
  Input,
  Textarea,
  Dropdown,
  Option,
  Checkbox,
  makeStyles,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  booleanRow: {
    display: 'inline-flex',
    gap: '6px',
  },
  booleanBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--border-radius-md)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-primary)',
    transition: 'background-color 0.1s ease, border 0.1s ease',
    minWidth: '64px',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
    },
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },
  booleanYesActive: {
    backgroundColor: 'var(--color-green) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-green) !important',
  },
  booleanNoActive: {
    backgroundColor: 'var(--color-red) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-red) !important',
  },
  multiList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  dateInput: {
    fontFamily: 'inherit',
    fontSize: '13px',
    padding: '7px 10px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    width: '180px',
  },
});

interface BaseProps {
  disabled?: boolean;
}

/* -------------------- Boolean -------------------- */

interface BooleanFieldProps extends BaseProps {
  value: boolean | null;
  onChange: (next: boolean) => void;
}
export function BooleanField({ value, onChange, disabled }: BooleanFieldProps) {
  const styles = useStyles();
  return (
    <div className={styles.booleanRow}>
      <button
        type="button"
        className={`${styles.booleanBtn} ${value === true ? styles.booleanYesActive : ''}`}
        onClick={() => onChange(true)}
        disabled={disabled}
        aria-pressed={value === true}
      >
        Yes
      </button>
      <button
        type="button"
        className={`${styles.booleanBtn} ${value === false ? styles.booleanNoActive : ''}`}
        onClick={() => onChange(false)}
        disabled={disabled}
        aria-pressed={value === false}
      >
        No
      </button>
    </div>
  );
}

/* -------------------- Option set (single) -------------------- */

interface OptionSetFieldProps extends BaseProps {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}
export function OptionSetField({ value, options, onChange, disabled }: OptionSetFieldProps) {
  return (
    <Dropdown
      value={value}
      selectedOptions={value ? [value] : []}
      onOptionSelect={(_, d) => d.optionValue && onChange(d.optionValue)}
      placeholder="Select..."
      disabled={disabled}
    >
      {options.map((o) => (
        <Option key={o} value={o}>
          {o}
        </Option>
      ))}
    </Dropdown>
  );
}

/* -------------------- Option set (multi) -------------------- */

interface MultiSelectFieldProps extends BaseProps {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}
export function MultiSelectField({
  value,
  options,
  onChange,
  disabled,
}: MultiSelectFieldProps) {
  const styles = useStyles();
  const selectedSet = new Set(value);
  function toggle(opt: string) {
    if (selectedSet.has(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }
  return (
    <div className={styles.multiList}>
      {options.map((o) => (
        <Checkbox
          key={o}
          label={o}
          checked={selectedSet.has(o)}
          onChange={() => toggle(o)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/* -------------------- Text -------------------- */

interface TextFieldProps extends BaseProps {
  value: string;
  onChange: (next: string) => void;
  /** Use multi-line input when true (longer answer expected). */
  multiline?: boolean;
}
export function TextField({ value, onChange, disabled, multiline }: TextFieldProps) {
  if (multiline) {
    return (
      <Textarea
        value={value}
        onChange={(_, d) => onChange(d.value)}
        disabled={disabled}
        rows={3}
        resize="vertical"
        style={{ width: '100%' }}
      />
    );
  }
  return (
    <Input
      value={value}
      onChange={(_, d) => onChange(d.value)}
      disabled={disabled}
      style={{ width: '100%', maxWidth: '480px' }}
    />
  );
}

/* -------------------- Date -------------------- */

interface DateFieldProps extends BaseProps {
  value: string;
  onChange: (next: string) => void;
}
export function DateField({ value, onChange, disabled }: DateFieldProps) {
  const styles = useStyles();
  return (
    <input
      type="date"
      className={styles.dateInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}
