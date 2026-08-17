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
import {
  useAssessmentResponses,
  useSubmitForReview,
  ASSESSMENT_OUTCOME,
  type AssessmentOutcomeValue,
} from './api';
import {
  validateSubmission,
  indexResponses,
  type MissingRequired,
} from './responseHelpers';
import { buildTree } from '../templates/levels/treeBuilder';
import { useCriteriaForLevels } from '../rules/api';
import { evaluateAssessment, findRootCriteria } from '../rules/engine';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '500px',
    width: '92vw',
  },
  content: { paddingTop: '4px', paddingBottom: '4px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '14px',
    borderBottom: '0.5px solid var(--ds-border)',
    marginBottom: '18px',
  },
  headerMark: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerMarkOk: {
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    color: 'var(--ds-ai-primary, #8B5CF6)',
  },
  headerMarkBlocked: {
    backgroundColor: 'var(--ds-pending-soft, #FEF3C7)',
    color: '#b45309',
  },
  headerText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  headerSub: { fontSize: '12px', color: 'var(--ds-text-body)' },
  body: {
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'var(--ds-text-strong)',
  },
  missingList: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '280px',
    overflowY: 'auto',
    border: '0.5px solid var(--ds-border)',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: 'var(--ds-surface-base)',
  },
  missingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--ds-surface-card)',
  },
  missingPath: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  missingLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  primaryBtn: {
    backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
    color: '#fff !important',
    border: '0.5px solid var(--ds-ai-primary, #8B5CF6) !important',
    ':hover': {
      backgroundColor: 'var(--ds-ai-primary, #8B5CF6) !important',
      border: '0.5px solid var(--ds-ai-primary, #8B5CF6) !important',
    },
  },
  outcomePreview: {
    marginTop: '14px',
    padding: '10px 12px',
    border: '0.5px solid var(--ds-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-surface-base)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  outcomePreviewLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  outcomePreviewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  outcomeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
  },
  outcomeChipPass: {
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
    border: '0.5px solid var(--ds-suitable)',
  },
  outcomeChipFail: {
    backgroundColor: 'var(--ds-not-suitable-soft)',
    color: '#b91c1c',
    border: '0.5px solid var(--ds-not-suitable)',
  },
  outcomeChipPending: {
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-text-body)',
    border: '0.5px solid var(--ds-border)',
  },
  outcomeHint: {
    fontSize: '11px',
    color: 'var(--ds-text-body)',
    lineHeight: 1.4,
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
  // Pull criteria for every level so we can preview + persist the outcome.
  const allLevelIds = (levels ?? []).map((l) => l.dnx_assessment_levelid);
  const { data: criteriaByLevelId } = useCriteriaForLevels(allLevelIds);

  // Validate only while the dialog is open — avoids running on every render
  // of the assessment page when the user is just answering questions.
  const missing: MissingRequired[] = open ? validateSubmission(levels, responses) : [];
  const blocked = missing.length > 0;

  // Compute the overall outcome live so the user sees what will be persisted
  // and the mutation has a value to write. Pending if the rules don't yield
  // a definitive verdict (no rules authored, or no answered questions yet).
  const outcome = open
    ? evaluateAssessment(
        buildTree(levels),
        criteriaByLevelId,
        indexResponses(responses),
        findRootCriteria(levels, criteriaByLevelId),
      )
    : { kind: 'not-evaluable' as const, reason: 'no-children' as const };
  const outcomeValue: AssessmentOutcomeValue =
    outcome.kind === 'pass'
      ? ASSESSMENT_OUTCOME.Suitable
      : outcome.kind === 'fail'
        ? ASSESSMENT_OUTCOME.NotSuitable
        : ASSESSMENT_OUTCOME.Pending;

  async function handleSubmit() {
    if (blocked) return;
    await submit.mutateAsync({ outcome: outcomeValue });
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
                  <div className={styles.outcomePreview}>
                    <span className={styles.outcomePreviewLabel}>
                      Outcome to record
                    </span>
                    <div className={styles.outcomePreviewRow}>
                      {outcome.kind === 'pass' && (
                        <span
                          className={`${styles.outcomeChip} ${styles.outcomeChipPass}`}
                        >
                          Suitable
                        </span>
                      )}
                      {outcome.kind === 'fail' && (
                        <span
                          className={`${styles.outcomeChip} ${styles.outcomeChipFail}`}
                        >
                          Not suitable
                        </span>
                      )}
                      {outcome.kind === 'not-evaluable' && (
                        <span
                          className={`${styles.outcomeChip} ${styles.outcomeChipPending}`}
                        >
                          Pending
                        </span>
                      )}
                    </div>
                    <span className={styles.outcomeHint}>
                      {outcome.kind === 'not-evaluable'
                        ? "No rules yielded a definitive verdict — the reviewer will decide on approval."
                        : (outcome.explanation ??
                          "Based on the current answers and configured rules. The reviewer can still override on approval.")}
                    </span>
                  </div>
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
