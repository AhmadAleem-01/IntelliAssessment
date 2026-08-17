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

import { Input, Textarea, makeStyles } from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';

/*
 * Field components — Design System v1.0 (assessment detail redesign):
 *  - Boolean: Yes/No segmented buttons (active = navy fill).
 *  - OptionSet: bordered radio rows (active = violet ring + soft-violet fill).
 *  - Multi: bordered checkbox chips in a wrapping row.
 *  - Date: DS input + a "Today" quick-fill button.
 */
const useStyles = makeStyles({
  booleanRow: { display: 'inline-flex', gap: '8px' },
  booleanBtn: {
    padding: '8px 20px',
    borderRadius: 'var(--border-radius-md)',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-strong)',
    transition: 'background-color 0.1s ease, border-color 0.1s ease',
    minWidth: '64px',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
    ':disabled': { cursor: 'not-allowed', opacity: 0.6 },
  },
  booleanActive: {
    backgroundColor: 'var(--ds-brand-primary) !important',
    color: '#fff !important',
    borderColor: 'var(--ds-brand-primary) !important',
  },

  /* Single-choice radio rows */
  radioList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  radioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'border-color 0.1s ease, background-color 0.1s ease',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
    ':disabled': { cursor: 'not-allowed', opacity: 0.6 },
  },
  radioRowActive: {
    borderColor: 'var(--ds-ai-primary)',
    backgroundColor: 'var(--ds-ai-surface)',
  },
  radioMark: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '2px solid var(--ds-border)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioMarkActive: { borderColor: 'var(--ds-ai-primary)' },
  radioMarkInner: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--ds-ai-primary)' },
  radioLabel: { flex: 1, minWidth: 0, fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-strong)' },

  /* Multi-select checkbox chips */
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-strong)',
    transition: 'border-color 0.1s ease, background-color 0.1s ease',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
    ':disabled': { cursor: 'not-allowed', opacity: 0.6 },
  },
  chipActive: {
    borderColor: 'var(--ds-brand-accent)',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
  },
  chipBox: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    border: '2px solid var(--ds-border)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  chipBoxActive: { backgroundColor: 'var(--ds-brand-accent)', borderColor: 'var(--ds-brand-accent)' },

  /* Date */
  dateRow: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  dateInput: {
    fontFamily: 'inherit',
    fontSize: 'var(--ds-fs-body)',
    padding: '8px 12px',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-strong)',
    width: '180px',
    ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
  },
  quickBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 500,
    cursor: 'pointer',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
    ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
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
        className={`${styles.booleanBtn} ${value === true ? styles.booleanActive : ''}`}
        onClick={() => onChange(true)}
        disabled={disabled}
        aria-pressed={value === true}
      >
        Yes
      </button>
      <button
        type="button"
        className={`${styles.booleanBtn} ${value === false ? styles.booleanActive : ''}`}
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
  const styles = useStyles();
  return (
    <div className={styles.radioList} role="radiogroup">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.radioRow} ${active ? styles.radioRowActive : ''}`}
            onClick={() => onChange(o)}
            disabled={disabled}
          >
            <span className={`${styles.radioMark} ${active ? styles.radioMarkActive : ''}`}>
              {active && <span className={styles.radioMarkInner} />}
            </span>
            <span className={styles.radioLabel}>{o}</span>
          </button>
        );
      })}
    </div>
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
    <div className={styles.chipRow}>
      {options.map((o) => {
        const active = selectedSet.has(o);
        return (
          <button
            key={o}
            type="button"
            role="checkbox"
            aria-checked={active}
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={() => toggle(o)}
            disabled={disabled}
          >
            <span className={`${styles.chipBox} ${active ? styles.chipBoxActive : ''}`}>
              {active && <Checkmark12Filled />}
            </span>
            {o}
          </button>
        );
      })}
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
    <div className={styles.dateRow}>
      <input
        type="date"
        className={styles.dateInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className={styles.quickBtn}
        onClick={() => onChange(new Date().toISOString().slice(0, 10))}
        disabled={disabled}
      >
        Today
      </button>
    </div>
  );
}
