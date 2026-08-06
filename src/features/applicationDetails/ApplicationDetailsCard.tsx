import { useRef, useState } from 'react';
import {
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  DocumentData20Regular,
  ArrowUpload16Regular,
  Checkmark16Filled,
} from '@fluentui/react-icons';
import { useSaveApplicationDetails, useApplicationDetails } from './api';
import { formatValue, missingPaths } from './appData';

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
  headerTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  body: { padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  empty: { fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' },
  row: { display: 'flex', flexDirection: 'column', gap: '1px', padding: '3px 0' },
  key: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-tertiary)',
  },
  val: {
    fontSize: '12px',
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  error: { fontSize: '12px', color: 'var(--color-red-text)' },
  hiddenFile: { display: 'none' },
});

interface Props {
  instanceId: string;
  /** File name currently stored (drives the read refresh key). */
  detailsName?: string;
  disabled?: boolean;
  /**
   * Attribute paths the template actually uses (AI bindings + details panels).
   * The card warns when the uploaded JSON is missing any of them, so bindings
   * / panels don't silently blank out. See `collectUsedPaths`.
   */
  requiredPaths?: string[];
}

/**
 * Application-details card on the AssessmentPage. Lets the assessor upload (or
 * replace) the structured JSON that backs the details panels + AI bindings, and
 * shows a compact preview of its top-level fields. The bytes live in the
 * instance's `dnx_application_details` File column.
 */
export function ApplicationDetailsCard({
  instanceId,
  detailsName,
  disabled,
  requiredPaths,
}: Props) {
  const styles = useStyles();
  const save = useSaveApplicationDetails(instanceId);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasFile = !!detailsName;
  const { data, loading } = useApplicationDetails(
    instanceId,
    hasFile,
    `${detailsName ?? ''}#${refresh}`,
  );

  // Which template-used attributes the currently-stored file is missing — these
  // render as em-dashes in panels and are skipped by AI bindings.
  const missing =
    data && requiredPaths && requiredPaths.length > 0
      ? missingPaths(data, requiredPaths)
      : [];

  async function onPick(file: File | undefined) {
    setError(null);
    if (!file) return;
    const text = await file.text();
    // Validate JSON client-side before uploading — a bad file would silently
    // resolve every path to nothing.
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('The file must be a JSON object (e.g. { "applicant": … }).');
        return;
      }
    } catch {
      setError('That file is not valid JSON.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('File is larger than 4 MB — please use a smaller application-details file.');
      return;
    }
    try {
      await save.mutateAsync({ json: text, fileName: file.name });
      setRefresh((n) => n + 1);
    } catch (err) {
      setError((err as Error).message || 'Upload failed.');
    }
  }

  // Top-level scalar fields for a compact preview (objects/arrays summarised).
  const previewRows = data
    ? Object.entries(data)
        .slice(0, 8)
        .map(([k, v]) => [k, formatValue(v)] as const)
    : [];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <DocumentData20Regular />
          Application details
        </span>
        {!disabled && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className={styles.hiddenFile}
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              size="small"
              appearance={hasFile ? 'secondary' : 'primary'}
              icon={<ArrowUpload16Regular />}
              disabled={save.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {save.isPending ? 'Uploading…' : hasFile ? 'Replace JSON' : 'Upload JSON'}
            </Button>
          </>
        )}
      </div>
      <div className={styles.body}>
        {error && <span className={styles.error}>{error}</span>}
        {!hasFile ? (
          <span className={styles.empty}>
            No application-details file yet. Upload the applicant's structured JSON to power
            the details panels and AI judgement bindings for this assessment.
          </span>
        ) : loading ? (
          <Spinner size="tiny" label="Loading details…" />
        ) : data ? (
          <>
            <span className={styles.empty}>
              <Checkmark16Filled style={{ verticalAlign: 'middle', color: 'var(--color-green)' }} />{' '}
              {detailsName}
            </span>
            <div className={styles.grid}>
              {previewRows.map(([k, v]) => (
                <div key={k} className={styles.row}>
                  <span className={styles.key}>{k}</span>
                  <span className={styles.val} title={v}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
            {missing.length > 0 && (
              <MessageBar intent="warning">
                <MessageBarBody>
                  This file is missing {missing.length} attribute
                  {missing.length === 1 ? '' : 's'} the template uses — they'll show as “—”
                  in detail panels and be skipped by AI bindings:{' '}
                  <b>{missing.join(', ')}</b>.
                </MessageBarBody>
              </MessageBar>
            )}
          </>
        ) : (
          <span className={styles.error}>
            The stored file could not be parsed as JSON. Replace it with a valid file.
          </span>
        )}
      </div>
    </div>
  );
}
