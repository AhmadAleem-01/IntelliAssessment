import { forwardRef, useEffect, useRef, useState } from 'react';
import { makeStyles, Tooltip } from '@fluentui/react-components';
import {
  Flag16Regular,
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  Sparkle16Filled,
} from '@fluentui/react-icons';
import type { Dnx_assessment_levels } from '../../generated/models/Dnx_assessment_levelsModel';
import type { Dnx_assessment_responses } from '../../generated/models/Dnx_assessment_responsesModel';
import type { Dnx_reviewer_comments } from '../../generated/models/Dnx_reviewer_commentsModel';
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
import { evaluateQuestion } from '../rules/engine';
import type { Criteria } from '../rules/types';

const TEXT_DEBOUNCE_MS = 800;

/** Compact relative "Nm/h/d ago" for a flag's timestamp. */
function fmtFlagTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const useStyles = makeStyles({
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 0',
    borderBottom: '1px solid var(--ds-border)',
    ':last-child': { borderBottom: 'none' },
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  required: {
    color: 'var(--ds-not-suitable)',
    fontWeight: 500,
  },
  letterDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--ds-brand-accent)',
  },
  aiBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    lineHeight: 1.3,
    backgroundColor: 'var(--ds-ai-surface)',
    color: 'var(--ds-ai-primary)',
    border: '0.5px solid var(--ds-ai-border)',
  },
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    lineHeight: 1.3,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
  },
  hint: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
    lineHeight: 1.45,
  },
  flagged: {
    paddingLeft: '12px',
    boxShadow: 'inset 3px 0 0 0 var(--ds-pending)',
  },
  // Light "flagged by reviewer" card under the question — soft amber fill with
  // a subtle amber border (not a heavy filled block).
  flagBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--ds-pending-soft)',
    border: '1px solid var(--ds-pending)',
    marginTop: '8px',
  },
  flagTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  flagMeta: { fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--ds-text-muted)' },
  flagText: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-strong)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  flagActions: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' },
  flagBtn: {
    cursor: 'pointer',
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    color: 'var(--ds-text-body)',
    transition: 'background-color 0.1s ease, border-color 0.1s ease',
    ':hover': { borderColor: 'var(--ds-text-muted)' },
    ':disabled': { opacity: 0.6, cursor: 'not-allowed' },
  },
  flagReply: {
    background: 'transparent',
    border: 'none',
    padding: '7px 4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--ds-text-body)',
    ':hover': { color: 'var(--ds-text-strong)' },
  },
});

interface Props {
  level: Dnx_assessment_levels;
  response: Dnx_assessment_responses | undefined;
  onChange: (value: boolean | string | string[] | null) => void;
  disabled?: boolean;
  /** Unresolved reviewer flags targeting this question. */
  flags?: Dnx_reviewer_comments[];
  onResolveFlag?: (commentId: string) => void;
  resolvingFlagId?: string | null;
  /** Open the comments drawer to reply, with this question pre-tagged. */
  onReplyFlag?: () => void;
  /** Optional pass/fail rule attached to this question. */
  criteria?: Criteria;
}

/**
 * Format the stored `dnx_ai_source_attributes` (JSON array of application-data
 * paths the AI judgement used) into a trailing tooltip sentence. Returns '' when
 * none / unparseable so the tooltip stays clean for evidence-only answers.
 */
function aiSourceAttributes(stored: string | undefined): string {
  if (!stored) return '';
  try {
    const arr = JSON.parse(stored);
    if (Array.isArray(arr) && arr.length > 0) {
      return ` Used application data: ${arr.join(', ')}.`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

export const QuestionRow = forwardRef<HTMLDivElement, Props>(function QuestionRow(
  { level, response, onChange, disabled, flags, onResolveFlag, resolvingFlagId, onReplyFlag, criteria },
  ref,
) {
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

  const hasFlags = (flags?.length ?? 0) > 0;
  // Live preview chip — only renders when the question has both an evaluable
  // answer and a configured rule. `not-evaluable` outcomes stay silent so the
  // checklist isn't cluttered by every unanswered question.
  const outcome = evaluateQuestion(level, criteria, response);

  return (
    <div ref={ref} className={`${styles.row} ${hasFlags ? styles.flagged : ''}`}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          {level.dnx_name}
          {level.dnx_is_required && <span className={styles.required}>{' *'}</span>}
        </span>
        {level.dnx_include_in_letter && (
          <span className={styles.letterDot} title="Included in outcome letter" />
        )}
        {response?.dnx_ai_populated === true && response?.dnx_manual_override !== true && (
          <Tooltip
            content={
              `AI-suggested answer${
                typeof response.dnx_confidence_score === 'number'
                  ? ` (${Math.round(response.dnx_confidence_score * 100)}% confidence)`
                  : ''
              }.${response.dnx_ai_source_summary ? ` ${response.dnx_ai_source_summary}` : ''}${
                aiSourceAttributes(response.dnx_ai_source_attributes)
              } Edit to override.`
            }
            relationship="description"
            withArrow
          >
            <span className={styles.aiBadge}>
              <Sparkle16Filled />
              AI
              {typeof response.dnx_confidence_score === 'number'
                ? ` · ${Math.round(response.dnx_confidence_score * 100)}%`
                : ''}
            </span>
          </Tooltip>
        )}
        {outcome.kind === 'pass' && (
          <Tooltip
            content={outcome.explanation ?? outcome.label}
            relationship="description"
            withArrow
          >
            <span className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}>
              <CheckmarkCircle16Filled />
              {outcome.label}
            </span>
          </Tooltip>
        )}
        {outcome.kind === 'fail' && (
          <Tooltip
            content={outcome.explanation ?? outcome.label}
            relationship="description"
            withArrow
          >
            <span className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}>
              <DismissCircle16Filled />
              {outcome.label}
            </span>
          </Tooltip>
        )}
      </div>
      {level.dnx_hint_text && <div className={styles.hint}>{level.dnx_hint_text}</div>}
      {hasFlags &&
        flags!.map((flag) => {
          const reviewer = flag.owneridname ?? flag.createdbyname;
          const when = flag.createdon ? fmtFlagTime(flag.createdon) : null;
          return (
            <div key={flag.dnx_reviewer_commentid} className={styles.flagBlock}>
              <span className={styles.flagTitle}>
                <Flag16Regular />
                Flagged by reviewer
                {(reviewer || when) && (
                  <span className={styles.flagMeta}>
                    · {reviewer ?? 'Reviewer'}{when ? ` · ${when}` : ''}
                  </span>
                )}
              </span>
              {flag.dnx_comment_text && (
                <div className={styles.flagText}>{flag.dnx_comment_text}</div>
              )}
              {(onResolveFlag || onReplyFlag) && (
                <div className={styles.flagActions}>
                  {onResolveFlag && (
                    <button
                      type="button"
                      className={styles.flagBtn}
                      disabled={resolvingFlagId === flag.dnx_reviewer_commentid}
                      onClick={() => onResolveFlag(flag.dnx_reviewer_commentid)}
                    >
                      {resolvingFlagId === flag.dnx_reviewer_commentid
                        ? 'Resolving…'
                        : 'Mark as resolved'}
                    </button>
                  )}
                  {onReplyFlag && (
                    <button type="button" className={styles.flagReply} onClick={onReplyFlag}>
                      Reply
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
});
