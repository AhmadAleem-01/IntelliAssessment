import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Field,
  Textarea,
  Radio,
  RadioGroup,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Filled,
  Warning16Filled,
} from '@fluentui/react-icons';
import { useApproveAssessment, useReviewerComments } from './api';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '480px',
    width: '92vw',
  },
  content: { paddingTop: '4px', paddingBottom: '4px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    marginBottom: '18px',
  },
  headerMark: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  headerSub: { fontSize: '12px', color: 'var(--color-text-secondary)' },
  fields: { display: 'flex', flexDirection: 'column', gap: '18px' },
  approveBtn: {
    backgroundColor: 'var(--color-green) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-green) !important',
    ':hover': {
      backgroundColor: 'var(--color-green-text) !important',
      border: '0.5px solid var(--color-green-text) !important',
    },
  },
  flagWarning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-amber-soft)',
    border: '0.5px solid var(--color-amber)',
    color: 'var(--color-amber-text)',
    marginBottom: '14px',
  },
  flagWarningIcon: { flexShrink: 0, marginTop: '2px' },
  flagWarningBody: {
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--color-text-primary)',
  },
  flagWarningTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--color-amber-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '2px',
  },
});

interface Props {
  instanceId: string;
  trigger: React.ReactElement;
}

export function ApproveAssessmentDialog({ instanceId, trigger }: Props) {
  const styles = useStyles();
  const approve = useApproveAssessment(instanceId);
  const { data: comments } = useReviewerComments(instanceId);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<'0' | '1'>('0');
  const [notes, setNotes] = useState('');

  // Block approval while any reviewer flags are still unresolved. The
  // assessor is expected to fix the flagged questions and the reviewer
  // (or someone) resolves the flag before sign-off — approving over the
  // top of open flags would defeat the audit trail.
  const unresolvedFlags = (comments ?? []).filter((c) => !c.dnx_is_resolved);
  const blocked = unresolvedFlags.length > 0;

  function reset() {
    setOutcome('0');
    setNotes('');
    approve.reset();
  }

  async function handleApprove() {
    if (blocked) return;
    await approve.mutateAsync({
      outcome: outcome === '0' ? 0 : 1,
      notes: notes.trim() || undefined,
    });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        setOpen(d.open);
        if (!d.open) reset();
      }}
    >
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div className={styles.headerMark}>
                <CheckmarkCircle20Filled />
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>Approve assessment</span>
                <span className={styles.headerSub}>
                  Sign off with a final outcome. The assessor will see this on the instance.
                </span>
              </div>
            </div>

            {approve.error && (
              <MessageBar intent="error" style={{ marginBottom: 14 }}>
                <MessageBarBody>{(approve.error as Error).message}</MessageBarBody>
              </MessageBar>
            )}

            {blocked && (
              <div className={styles.flagWarning}>
                <Warning16Filled className={styles.flagWarningIcon} />
                <div className={styles.flagWarningBody}>
                  <div className={styles.flagWarningTitle}>
                    Unresolved reviewer flags
                  </div>
                  {unresolvedFlags.length} question
                  {unresolvedFlags.length === 1 ? '' : 's'} still flagged. Resolve
                  every flag on the checklist before approving — open flags should
                  either be addressed by the assessor or marked resolved.
                </div>
              </div>
            )}

            <div className={styles.fields}>
              <Field label="Outcome" required>
                <RadioGroup
                  value={outcome}
                  onChange={(_, d) => setOutcome((d.value as '0' | '1') ?? '0')}
                >
                  <Radio value="0" label="Suitable — meets criteria" />
                  <Radio value="1" label="Not suitable — does not meet criteria" />
                </RadioGroup>
              </Field>

              <Field
                label="Notes"
                hint="Optional. Visible to the assessor on the locked instance."
              >
                <Textarea
                  value={notes}
                  onChange={(_, d) => setNotes(d.value)}
                  rows={3}
                  resize="vertical"
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Cancel
              </Button>
            </DialogTrigger>
            <Button
              className={styles.approveBtn}
              type="button"
              onClick={handleApprove}
              disabled={approve.isPending || blocked}
            >
              {approve.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
