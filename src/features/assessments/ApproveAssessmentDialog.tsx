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
import { CheckmarkCircle20Filled } from '@fluentui/react-icons';
import { useApproveAssessment } from './api';

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
});

interface Props {
  instanceId: string;
  trigger: React.ReactElement;
}

export function ApproveAssessmentDialog({ instanceId, trigger }: Props) {
  const styles = useStyles();
  const approve = useApproveAssessment(instanceId);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<'0' | '1'>('0');
  const [notes, setNotes] = useState('');

  function reset() {
    setOutcome('0');
    setNotes('');
    approve.reset();
  }

  async function handleApprove() {
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
              disabled={approve.isPending}
            >
              {approve.isPending ? 'Approving...' : 'Approve'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
