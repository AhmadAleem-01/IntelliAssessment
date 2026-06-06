import { useState } from 'react';
import {
  Spinner,
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
} from '@fluentui/react-components';
import {
  DocumentPdf16Regular,
  DocumentBulletList16Regular,
  Image16Regular,
  ArrowDownload16Regular,
  Sparkle16Filled,
  Delete16Regular,
} from '@fluentui/react-icons';
import {
  useEvidenceFiles,
  useDeleteEvidence,
  useExtractDocumentText,
  type EvidenceFile,
} from './api';
import { ExtractedTextDialog } from './ExtractedTextDialog';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
  },
  rowBusy: { opacity: 0.6 },
  iconWrap: {
    display: 'inline-flex',
    flexShrink: 0,
    color: 'var(--color-text-secondary)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowPath: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowActions: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
  },
  miniBtn: {
    minWidth: 0,
    padding: '2px 8px',
    fontSize: '11px',
  },
});

interface Props {
  assessmentName: string;
}

function inferIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <DocumentPdf16Regular />;
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext))
    return <Image16Regular />;
  return <DocumentBulletList16Regular />;
}

function inferMime(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Normalise then base64-decode the file body the Get flow embeds.
 * Power Automate line-wraps base64 (RFC 2045, every 76 chars) and some HTTP
 * layers replace `+` with space — `atob` rejects both. We also accept
 * URL-safe variants (`-`/`_`) and re-pad to a multiple of 4 if the flow
 * trimmed trailing `=` characters. After cleanup, decode to a Uint8Array
 * and trigger a Blob download via a synthesised anchor click.
 */
function downloadBase64(file: EvidenceFile): void {
  let b64 = file.fileContent
    .replace(/\s+/g, '') // strip CR/LF/space
    .replace(/-/g, '+') // URL-safe → standard
    .replace(/_/g, '/');
  // Re-pad so length is a multiple of 4.
  while (b64.length % 4 !== 0) b64 += '=';

  let byteString: string;
  try {
    byteString = atob(b64);
  } catch (e) {
    console.error('[download] base64 decode failed', {
      fileName: file.fileName,
      sample: b64.slice(0, 80),
      length: b64.length,
      error: e,
    });
    throw new Error(
      'Could not decode the file. The flow may have returned a malformed base64 payload — check the flow logs.',
    );
  }

  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes as BlobPart], { type: inferMime(file.fileName) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FileList({ assessmentName }: Props) {
  const styles = useStyles();
  const { data: files, isLoading, error } = useEvidenceFiles(assessmentName);
  const remove = useDeleteEvidence(assessmentName);
  const extract = useExtractDocumentText(assessmentName);

  const [extractTarget, setExtractTarget] = useState<{
    fileName: string;
    content: string | null;
    error: string | null;
  } | null>(null);

  async function handleExtract(file: EvidenceFile) {
    setExtractTarget({ fileName: file.fileName, content: null, error: null });
    try {
      const content = await extract.mutateAsync(file.fileName);
      setExtractTarget({ fileName: file.fileName, content, error: null });
    } catch (e) {
      setExtractTarget({
        fileName: file.fileName,
        content: null,
        error: (e as Error).message,
      });
    }
  }

  if (isLoading) {
    return <Spinner size="extra-tiny" label="Loading files…" />;
  }
  if (error) {
    return (
      <MessageBar intent="error">
        <MessageBarBody>{(error as Error).message}</MessageBarBody>
      </MessageBar>
    );
  }

  const list = files ?? [];

  return (
    <div className={styles.root}>
      {list.length === 0 ? (
        <div className={styles.empty}>
          No files uploaded yet. Drop one above or click to pick.
        </div>
      ) : (
        list.map((f) => {
          const removing =
            remove.isPending && remove.variables === f.fileName;
          return (
            <div
              key={f.filePath || f.fileName}
              className={`${styles.row} ${removing ? styles.rowBusy : ''}`}
            >
              <span className={styles.iconWrap} aria-hidden>
                {inferIcon(f.fileName)}
              </span>
              <div className={styles.rowBody}>
                <span className={styles.rowName} title={f.fileName}>
                  {f.fileName}
                </span>
                {f.filePath && (
                  <span className={styles.rowPath} title={f.filePath}>
                    {f.filePath}
                  </span>
                )}
              </div>
              <div className={styles.rowActions}>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ArrowDownload16Regular />}
                  className={styles.miniBtn}
                  onClick={() => downloadBase64(f)}
                  title="Download"
                >
                  Download
                </Button>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Sparkle16Filled />}
                  className={styles.miniBtn}
                  onClick={() => void handleExtract(f)}
                  title="Run OCR / text extraction"
                >
                  Extract
                </Button>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Delete16Regular />}
                  className={styles.miniBtn}
                  disabled={removing}
                  onClick={() => remove.mutate(f.fileName)}
                  title="Delete"
                >
                  Delete
                </Button>
              </div>
            </div>
          );
        })
      )}

      {remove.error && (
        <MessageBar intent="error">
          <MessageBarBody>{(remove.error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      <ExtractedTextDialog
        fileName={extractTarget?.fileName ?? null}
        content={extractTarget?.content ?? null}
        loading={extract.isPending && !!extractTarget && extractTarget.content === null && !extractTarget.error}
        error={extractTarget?.error ?? null}
        open={extractTarget !== null}
        onOpenChange={(o) => {
          if (!o) setExtractTarget(null);
        }}
      />
    </div>
  );
}
