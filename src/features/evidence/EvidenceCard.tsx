import { Button, makeStyles } from '@fluentui/react-components';
import { Attach20Regular, Sparkle16Filled } from '@fluentui/react-icons';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';

const useStyles = makeStyles({
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid var(--ds-border)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  headerTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  body: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  // AI trigger — a hollow violet button wrapped in the animated glow ring.
  // The ring lives on the wrapper (.ai-glow-border) so Fluent's own button
  // background/border can't paint over it; the button itself is fully
  // transparent with no border of its own.
  aiButtonWrap: {
    display: 'inline-flex',
    // Padding = the visible ring band. The button nests inside this gap so the
    // animated ring (.ai-glow-border ::before) is always shown around it, not
    // just at the corners on hover.
    padding: '2px',
    borderRadius: '8px',
  },
  aiButton: {
    // Soft violet tint at rest (not just on hover) so the hollow button still
    // stands off the white header; bold text + a touch more padding give it
    // presence without becoming a solid block.
    backgroundColor: 'var(--ds-ai-surface)',
    color: 'var(--ds-ai-primary)',
    borderColor: 'transparent',
    // Slightly tighter than the wrapper so the button sits cleanly inside the ring.
    borderRadius: '6px',
    minWidth: 'auto',
    fontWeight: 700,
    padding: '5px 14px',
    ':hover': {
      backgroundColor: 'var(--ds-ai-glow)',
      color: 'var(--ds-ai-primary)',
      borderColor: 'transparent',
    },
    ':hover:active': {
      backgroundColor: 'var(--ds-ai-glow)',
      color: 'var(--ds-ai-primary)',
      borderColor: 'transparent',
    },
  },
});

interface Props {
  assessmentName: string;
  disabled?: boolean;
  /**
   * When provided, an "AI auto-fill" button appears in the header. Clicking it
   * opens the mapping + review dialog owned by the page. Omitted in read-only
   * states (PendingReview / Complete) where no answers can change.
   */
  onAiPopulate?: () => void;
}

/**
 * Evidence card mounted on AssessmentPage. Composes the upload affordance +
 * the live file list. Keys everything off the assessment **name** because
 * that's what the SharePoint flow uses to pick the folder (see the flow
 * contracts in `api.ts`).
 */
export function EvidenceCard({ assessmentName, disabled, onAiPopulate }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <Attach20Regular />
          Evidence files
        </span>
        {onAiPopulate && (
          <span className={`${styles.aiButtonWrap} ai-glow-border`}>
            <Button
              appearance="subtle"
              size="small"
              icon={<Sparkle16Filled />}
              onClick={onAiPopulate}
              className={styles.aiButton}
            >
              AI auto-fill
            </Button>
          </span>
        )}
      </div>
      <div className={styles.body}>
        <FileDropzone assessmentName={assessmentName} disabled={disabled} />
        <FileList assessmentName={assessmentName} />
      </div>
    </div>
  );
}
