import { makeStyles } from '@fluentui/react-components';
import { Attach20Regular } from '@fluentui/react-icons';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';

const useStyles = makeStyles({
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  header: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  body: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
});

interface Props {
  assessmentName: string;
  disabled?: boolean;
}

/**
 * Evidence card mounted on AssessmentPage. Composes the upload affordance +
 * the live file list. Keys everything off the assessment **name** because
 * that's what the SharePoint flow uses to pick the folder (see the flow
 * contracts in `api.ts`).
 */
export function EvidenceCard({ assessmentName, disabled }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Attach20Regular />
        Evidence files
      </div>
      <div className={styles.body}>
        <FileDropzone assessmentName={assessmentName} disabled={disabled} />
        <FileList assessmentName={assessmentName} />
      </div>
    </div>
  );
}
