import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  surface: {
    borderRadius: 'var(--ds-radius-card)',
    maxWidth: '720px',
    width: '94vw',
    maxHeight: '88vh',
  },
  title: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
  },
  sub: {
    fontSize: '12px',
    color: 'var(--ds-text-body)',
    marginTop: '3px',
    marginBottom: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    padding: '16px 22px',
    maxHeight: '60vh',
    overflow: 'auto',
  },
  pre: {
    fontSize: '12px',
    lineHeight: 1.55,
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
    color: 'var(--ds-text-strong)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: 'var(--ds-surface-base)',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    margin: 0,
  },
  loadingPad: {
    padding: '60px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--ds-text-muted)',
    fontStyle: 'italic',
  },
});

interface Props {
  fileName: string | null;
  content: string | null;
  loading: boolean;
  error: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only viewer for text extracted from an evidence file via the OCR flow. */
export function ExtractedTextDialog({
  fileName,
  content,
  loading,
  error,
  open,
  onOpenChange,
}: Props) {
  const styles = useStyles();
  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogContent>
            <div className={styles.title}>Extracted text</div>
            <div className={styles.sub} title={fileName ?? ''}>
              {fileName ?? '—'}
            </div>
            <div className={styles.body}>
              {loading && (
                <div className={styles.loadingPad}>
                  <Spinner size="small" label="Running OCR…" />
                </div>
              )}
              {error && !loading && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}
              {!loading && !error && content !== null && (
                content.trim().length > 0 ? (
                  <pre className={styles.pre}>{content}</pre>
                ) : (
                  <div className={styles.empty}>
                    The extraction flow returned an empty document.
                  </div>
                )
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" type="button">
                Close
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
