import { useState } from 'react';
import { Input, Button, makeStyles } from '@fluentui/react-components';
import { Add16Regular, Dismiss12Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
  },
  inputWrap: {
    flex: 1,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    minHeight: '32px',
    padding: '8px',
    backgroundColor: 'var(--color-background-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    border: '0.5px solid var(--color-border-tertiary)',
  },
  emptyHint: {
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    padding: '2px 4px',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 6px 4px 10px',
    backgroundColor: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    borderRadius: 'var(--border-radius-pill)',
    border: '0.5px solid var(--color-border-secondary)',
    fontSize: '12px',
    fontWeight: 500,
  },
  removeBtn: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    color: 'var(--color-text-tertiary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--color-red-soft)',
      color: 'var(--color-red-text)',
    },
  },
  duplicate: {
    fontSize: '11px',
    color: 'var(--color-amber-text)',
  },
});

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function OptionListEditor({ value, onChange, placeholder }: Props) {
  const styles = useStyles();
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const isDuplicate = trimmed.length > 0 && value.includes(trimmed);

  function add() {
    if (!trimmed || isDuplicate) return;
    onChange([...value, trimmed]);
    setDraft('');
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.root}>
      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <Input
            value={draft}
            onChange={(_, d) => setDraft(d.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder ?? 'Type an option label and press Enter'}
            maxLength={120}
          />
        </div>
        <Button
          type="button"
          appearance="secondary"
          icon={<Add16Regular />}
          disabled={!trimmed || isDuplicate}
          onClick={add}
        >
          Add
        </Button>
      </div>

      {isDuplicate && (
        <div className={styles.duplicate}>
          "{trimmed}" is already in the list.
        </div>
      )}

      <div className={styles.chips}>
        {value.length === 0 ? (
          <span className={styles.emptyHint}>No options yet — add at least two.</span>
        ) : (
          value.map((opt, i) => (
            <span key={`${opt}-${i}`} className={styles.chip}>
              {opt}
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={`Remove ${opt}`}
                onClick={() => remove(i)}
              >
                <Dismiss12Regular />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
