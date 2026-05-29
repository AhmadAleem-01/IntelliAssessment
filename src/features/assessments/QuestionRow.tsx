import { useEffect, useRef, useState } from 'react';
import { makeStyles } from '@fluentui/react-components';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import { parseOptions } from '../templates/levels/options';
import type { DataType } from '../templates/levels/levelTypes';
import { readResponseValue } from './responseHelpers';
import {
  BooleanField,
  OptionSetField,
  MultiSelectField,
  TextField,
  DateField,
} from './fields/Fields';

const TEXT_DEBOUNCE_MS = 800;

const useStyles = makeStyles({
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '12px 0',
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  required: {
    color: 'var(--color-red)',
    fontWeight: 500,
  },
  letterDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-purple)',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
});

interface Props {
  level: Dnx_assessment_levels;
  response: Dnx_assessment_responses | undefined;
  onChange: (value: boolean | string | string[] | null) => void;
  disabled?: boolean;
}

export function QuestionRow({ level, response, onChange, disabled }: Props) {
  const styles = useStyles();
  const dataType = (level.dnx_data_type ?? 3) as DataType;
  const persisted = readResponseValue(dataType, response);
  const options = dataType === 1 || dataType === 2
    ? parseOptions(level.dnx_option_set_reference)
    : [];

  // Local state for the debounced text field — keystrokes update local state
  // immediately, and a single network write fires once typing stops for
  // TEXT_DEBOUNCE_MS. All other field types call `onChange` directly because
  // each interaction is one discrete action (a toggle, pick, or date pick).
  const isTextish = dataType === 3;
  const [draft, setDraft] = useState<string>(
    typeof persisted === 'string' ? persisted : '',
  );
  const lastSentRef = useRef<string>(typeof persisted === 'string' ? persisted : '');
  const timerRef = useRef<number | undefined>(undefined);

  // When the persisted value changes from outside (e.g. instance reload, server
  // refresh) and the user isn't actively typing the same field, sync down.
  useEffect(() => {
    if (!isTextish) return;
    const next = typeof persisted === 'string' ? persisted : '';
    // Only overwrite the draft if the latest persisted value differs from what
    // we last sent — avoids fighting the user mid-keystroke.
    if (next !== lastSentRef.current) {
      setDraft(next);
      lastSentRef.current = next;
    }
  }, [persisted, isTextish]);

  // Cancel any pending debounced write when the row unmounts (component
  // swapped, page navigated away). We deliberately don't try to "flush" the
  // last value — the captured closure would be stale and the parent mutation
  // hook is also tearing down. <800 ms in-flight typing is lost on navigation.
  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, []);

  function handleTextChange(next: string) {
    setDraft(next);
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (next !== lastSentRef.current) {
        onChange(next);
        lastSentRef.current = next;
      }
      timerRef.current = undefined;
    }, TEXT_DEBOUNCE_MS);
  }

  return (
    <div className={styles.row}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          {level.dnx_name}
          {level.dnx_is_required && <span className={styles.required}>{' *'}</span>}
        </span>
        {level.dnx_include_in_letter && (
          <span className={styles.letterDot} title="Included in outcome letter" />
        )}
      </div>
      {level.dnx_hint_text && <div className={styles.hint}>{level.dnx_hint_text}</div>}
      {renderField()}
    </div>
  );

  function renderField() {
    switch (dataType) {
      case 0:
        return (
          <BooleanField
            value={typeof persisted === 'boolean' ? persisted : null}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 1:
        return (
          <OptionSetField
            value={typeof persisted === 'string' ? persisted : ''}
            options={options}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 2:
        return (
          <MultiSelectField
            value={Array.isArray(persisted) ? persisted : []}
            options={options}
            onChange={onChange}
            disabled={disabled}
          />
        );
      case 3:
        return (
          <TextField
            value={draft}
            onChange={handleTextChange}
            disabled={disabled}
            multiline
          />
        );
      case 4:
        return (
          <DateField
            value={typeof persisted === 'string' ? persisted : ''}
            onChange={onChange}
            disabled={disabled}
          />
        );
    }
  }
}
