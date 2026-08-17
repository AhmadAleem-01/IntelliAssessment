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

/** "dateOfBirth" / "yearsExperience" → "Date of birth" / "Years experience". */
function humanize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Flatten a parsed application-details object one level into readable
 * label/value rows. Scalars pass through; a nested object contributes its own
 * scalar leaves (labelled by child key); arrays collapse to an "N items" count.
 * Deliberately shallow — the preview is a summary, not a JSON dump.
 */
function flattenForPreview(root: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(root)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      rows.push({ label: humanize(k), value: `${v.length} item${v.length === 1 ? '' : 's'}` });
    } else if (typeof v === 'object') {
      for (const [ck, cv] of Object.entries(v as Record<string, unknown>)) {
        if (cv === null || cv === undefined || typeof cv === 'object') continue;
        rows.push({ label: humanize(ck), value: formatValue(cv) });
      }
    } else {
      rows.push({ label: humanize(k), value: formatValue(v) });
    }
  }
  return rows;
}

const useStyles = makeStyles({
  card: {
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: 'var(--ds-fs-h2)',
    fontWeight: 600,
    color: 'var(--ds-text-heading)',
  },
  headerTitle: { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 },
  fileRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-body)',
  },
  empty: { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px' },
  row: {
    display: 'grid',
    gridTemplateColumns: '96px 1fr',
    gap: '12px',
    alignItems: 'baseline',
  },
  key: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  val: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  divider: { height: '1px', backgroundColor: 'var(--ds-border)' },
  footRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--ds-text-muted)',
  },
  rawToggle: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-ai-primary)',
    ':hover': { textDecoration: 'underline' },
  },
  rawJson: {
    margin: 0,
    padding: '12px',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--ds-surface-base)',
    border: '1px solid var(--ds-border)',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: '11px',
    lineHeight: 1.5,
    color: 'var(--ds-text-body)',
    maxHeight: '220px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  error: { fontSize: 'var(--ds-fs-caption)', color: '#b91c1c' },
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
  const [showRaw, setShowRaw] = useState(false);
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

  // Flatten the JSON one level into readable label/value rows for the preview.
  // Nested objects expand into their scalar leaves (so "applicant: {...}" shows
  // as Full name / Date of birth / …); arrays collapse to a count; scalars show
  // as-is. Never dumps raw JSON, which is what made the old preview unreadable.
  const previewRows = data ? flattenForPreview(data).slice(0, 10) : [];

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
            <span className={styles.fileRow}>
              <Checkmark16Filled style={{ color: 'var(--ds-suitable)' }} />
              {detailsName}
            </span>
            <div className={styles.grid}>
              {previewRows.map((r, i) => (
                <div key={`${r.label}-${i}`} className={styles.row}>
                  <span className={styles.key}>{r.label}</span>
                  <span className={styles.val} title={r.value}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.divider} />
            <div className={styles.footRow}>
              <span>{detailsName}</span>
              <button
                type="button"
                className={styles.rawToggle}
                onClick={() => setShowRaw((v) => !v)}
              >
                {showRaw ? 'Hide raw JSON' : 'Raw JSON'}
              </button>
            </div>
            {showRaw && <pre className={styles.rawJson}>{JSON.stringify(data, null, 2)}</pre>}
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
