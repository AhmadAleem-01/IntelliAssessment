import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  SendCopy20Regular,
  Warning20Filled,
} from '@fluentui/react-icons';
import { useTemplateLevels } from '../templates/levels/api';
import { useAssessmentResponses, useSubmitForReview } from './api';
import { validateSubmission, type MissingRequired } from './responseHelpers';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--border-radius-lg)',
    maxWidth: '500px',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerMarkOk: {
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
  },
  headerMarkBlocked: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  headerSub: { fontSize: '12px', color: 'var(--color-text-secondary)' },
  body: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--color-text-primary)',
  },
  missingList: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '280px',
    overflowY: 'auto',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    padding: '10px',
    backgroundColor: 'var(--color-background-tertiary)',
  },
  missingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-background-primary)',
  },
  missingPath: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  missingLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  primaryBtn: {
    backgroundColor: 'var(--color-purple) !important',
    color: '#fff !important',
    border: '0.5px solid var(--color-purple) !important',
    ':hover': {
      backgroundColor: 'var(--color-purple-text) !important',
      border: '0.5px solid var(--color-purple-text) !important',
    },
  },
});

interface Props {
  instanceId: string;
  templateId: string;
  trigger: React.ReactElement;
  /** Disable trigger interaction when the instance has already moved on. */
  alreadySubmitted: boolean;
}

export function SubmitAssessmentDialog({
  instanceId,
  templateId,
  trigger,
  alreadySubmitted,
}: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const { data: levels } = useTemplateLevels(templateId);
  const { data: responses } = useAssessmentResponses(instanceId);
  const submit = useSubmitForReview(instanceId);

  // Validate only while the dialog is open — avoids running on every render
  // of the assessment page when the user is just answering questions.
  const missing: MissingRequired[] = open ? validateSubmission(levels, responses) : [];
  const blocked = missing.length > 0;

  async function handleSubmit() {
    if (blocked) return;
    await submit.mutateAsync();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => {
        if (alreadySubmitted) return;
        setOpen(d.open);
        if (!d.open) submit.reset();
      }}
    >
      <DialogTrigger disableButtonEnhancement>{trigger}</DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent className={styles.content}>
            <div className={styles.header}>
              <div
                className={`${styles.headerMark} ${
                  blocked ? styles.headerMarkBlocked : styles.headerMarkOk
                }`}
              >
                {blocked ? <Warning20Filled /> : <SendCopy20Regular />}
              </div>
              <div className={styles.headerText}>
                <span className={styles.headerTitle}>
                  {blocked ? 'Required answers missing' : 'Submit for review'}
                </span>
                <span className={styles.headerSub}>
                  {blocked
                    ? `${missing.length} required question${missing.length === 1 ? '' : 's'} still unanswered.`
                    : 'Mark this assessment as ready for reviewer sign-off.'}
                </span>
              </div>
            </div>

            {submit.error && (
              <MessageBar intent="error" style={{ marginBottom: 14 }}>
                <MessageBarBody>{(submit.error as Error).message}</MessageBarBody>
              </MessageBar>
            )}

            <div className={styles.body}>
              {blocked ? (
                <>
                  Answer the questions below before submitting. Visibility-hidden
                  questions are excluded.
                  <div className={styles.missingList}>
                    {missing.map((m) => (
                      <div key={m.levelId} className={styles.missingRow}>
                        {m.path && <div className={styles.missingPath}>{m.path}</div>}
                        <div className={styles.missingLabel}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  Submitting changes the instance status to{' '}
                  <b>Pending review</b> and stamps today's date as the submission
                  date. The instance can still be edited until a reviewer signs
                  off, but the status will surface to reviewers immediately.
                </>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                {blocked ? 'Back to checklist' : 'Cancel'}
              </Button>
            </DialogTrigger>
            {!blocked && (
              <Button
                className={styles.primaryBtn}
                type="button"
                onClick={handleSubmit}
                disabled={submit.isPending}
              >
                {submit.isPending ? 'Submitting...' : 'Submit for review'}
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
