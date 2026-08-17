import { useRef, useState, type DragEvent } from 'react';
import { Button, makeStyles, MessageBar, MessageBarBody } from '@fluentui/react-components';
import {
  ArrowUpload20Regular,
  DocumentArrowUp20Regular,
} from '@fluentui/react-icons';
import { useUploadEvidence } from './api';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '24px 20px',
    border: '1px dashed var(--ds-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-body)',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'border-color 0.1s ease, background-color 0.1s ease',
    textAlign: 'center',
    ':hover': {
      border: '1px dashed var(--ds-ai-primary, #8B5CF6)',
      color: 'var(--ds-text-strong)',
    },
  },
  dropzoneActive: {
    border: '1px dashed var(--ds-ai-primary, #8B5CF6)',
    backgroundColor: 'var(--ds-ai-surface, #F5F3FF)',
    color: 'var(--ds-ai-primary, #8B5CF6)',
  },
  dropzoneBusy: {
    cursor: 'wait',
    opacity: 0.7,
  },
  hint: {
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
  },
  hiddenInput: {
    display: 'none',
  },
  uploadingBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--ds-text-body)',
  },
});

interface Props {
  assessmentName: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop / click-to-upload affordance for evidence files. Files are
 * read in-browser, base64-encoded, and shipped to the UploadSharepointFile
 * flow via `useUploadEvidence`. No server-side temp storage — bytes go
 * straight to the flow's `text` payload.
 *
 * Multiple files in one drop are batched into a single flow call.
 */
export function FileDropzone({ assessmentName, disabled }: Props) {
  const styles = useStyles();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const upload = useUploadEvidence(assessmentName);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    await upload.mutateAsync(files);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''} ${
          upload.isPending ? styles.dropzoneBusy : ''
        }`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        {upload.isPending ? (
          <div className={styles.uploadingBar}>
            <DocumentArrowUp20Regular />
            Uploading…
          </div>
        ) : (
          <>
            <ArrowUpload20Regular />
            <div>
              <b>Click to upload</b> or drag files here
            </div>
            <div className={styles.hint}>
              PDFs, images, and Office docs. Multiple files supported.
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          disabled={disabled || upload.isPending}
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Reset value so re-uploading the same filename triggers `change` again.
            e.target.value = '';
          }}
        />
      </div>

      {upload.error && (
        <MessageBar intent="error">
          <MessageBarBody>{(upload.error as Error).message}</MessageBarBody>
        </MessageBar>
      )}

      {upload.isSuccess && upload.data && !upload.isPending && (
        <MessageBar intent="success">
          <MessageBarBody>{upload.data}</MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}

/** Tiny utility component for the icon button in dialog triggers. */
export function UploadIconButton({
  assessmentName,
}: {
  assessmentName: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const upload = useUploadEvidence(assessmentName);
  return (
    <>
      <Button
        appearance="primary"
        icon={<ArrowUpload20Regular />}
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? 'Uploading…' : 'Upload files'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void upload.mutateAsync(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
