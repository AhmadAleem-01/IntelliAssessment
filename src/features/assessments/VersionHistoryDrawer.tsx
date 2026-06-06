import { useMemo, useState } from 'react';
import {
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  History16Regular,
  Dismiss20Regular,
  ArrowSwap16Regular,
  ArrowSync16Regular,
  Filter16Regular,
} from '@fluentui/react-icons';
import type { Dnx_assessment_versions } from '../../generated/models/Dnx_assessment_versionsModel';
import { lookupName } from '../../lib/dataverse';
import { useVersionHistory } from './api';
import { SnapshotDiffDialog } from './SnapshotDiffDialog';

const useStyles = makeStyles({
  surface: {
    width: '440px',
    maxWidth: '90vw',
  },
  header: {
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerCount: {
    fontSize: '11px',
    fontWeight: 400,
    color: 'var(--color-text-tertiary)',
  },
  closeBtn: { minWidth: 0 },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    padding: '10px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  filterIcon: {
    display: 'inline-flex',
    color: 'var(--color-text-tertiary)',
    marginRight: '2px',
  },
  // Base pill — small, visible at rest with a soft bg + border so it reads
  // as a clickable toggle rather than a label.
  filterChip: {
    border: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-primary)',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    transition: 'background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-tertiary)',
      color: 'var(--color-text-primary)',
    },
  },
  // Active variants — one per reason so the filter palette mirrors the row
  // chips. Each fully replaces the base border + background.
  filterChipAutosave: {
    backgroundColor: 'var(--color-gray-soft)',
    color: 'var(--color-text-primary)',
    border: '0.5px solid var(--color-border-secondary)',
  },
  filterChipSubmitted: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
    border: '0.5px solid var(--color-amber)',
  },
  filterChipReopened: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
    border: '0.5px solid var(--color-blue)',
  },
  filterChipApproved: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
    border: '0.5px solid var(--color-green)',
  },
  filterChipRejected: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
    border: '0.5px solid var(--color-red)',
  },
  filterReset: {
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
    background: 'transparent',
    border: 'none',
    padding: '3px 6px',
    cursor: 'pointer',
    marginLeft: 'auto',
    ':hover': { color: 'var(--color-text-primary)' },
  },
  body: {
    padding: '12px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    padding: '12px 0',
    textAlign: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px 14px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  versionLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  versionNumber: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  reasonChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  reasonAutosave: {
    backgroundColor: 'var(--color-gray-soft)',
    color: 'var(--color-text-secondary)',
  },
  reasonSubmitted: {
    backgroundColor: 'var(--color-amber-soft)',
    color: 'var(--color-amber-text)',
  },
  reasonReopened: {
    backgroundColor: 'var(--color-blue-soft)',
    color: 'var(--color-blue-text)',
  },
  reasonApproved: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green-text)',
  },
  reasonRejected: {
    backgroundColor: 'var(--color-red-soft)',
    color: 'var(--color-red-text)',
  },
  meta: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  metaSeparator: {
    margin: '0 6px',
    color: 'var(--color-text-tertiary)',
  },
  downloadBtn: {
    minWidth: 0,
    flexShrink: 0,
  },
  rowActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
});

interface Props {
  instanceId: string;
  /** Needed to load the live template + responses for snapshot diff. */
  templateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drawer surfacing the chronological list of `dnx_assessment_versions`
 * snapshots for an instance. Each row shows version number, reason
 * (Autosave / Submitted / Reopened / Approved / Rejected, colour-coded),
 * who saved it, when, and a Download button that pulls the snapshot JSON
 * from the file column on demand (not loaded with the list to save round-trips).
 *
 * Snapshots are written fire-and-forget on every save/submit/reopen/approve/reject;
 * the list query refreshes via the same `assessmentKeys.versions` invalidation
 * triggered by each of those mutations.
 */
export function VersionHistoryDrawer({
  instanceId,
  templateId,
  open,
  onOpenChange,
}: Props) {
  const styles = useStyles();
  const { data: versions, isLoading, error } = useVersionHistory(open ? instanceId : undefined);
  // Open target row + which entry point opened it (Compare = preview first,
  // Replace = jump straight to the confirmation panel).
  const [diffTarget, setDiffTarget] = useState<{
    row: Dnx_assessment_versions;
    mode: 'compare' | 'replace';
  } | null>(null);
  // Set of reasons to keep. Empty set === show everything (no active filter).
  const [activeReasons, setActiveReasons] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const list = versions ?? [];
    if (activeReasons.size === 0) return list;
    return list.filter((v) => activeReasons.has(v.dnx_change_summary ?? 'Autosave'));
  }, [versions, activeReasons]);

  function toggleReason(reason: string) {
    setActiveReasons((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason);
      else next.add(reason);
      return next;
    });
  }

  function fmtTime(iso: string | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function reasonClass(reason: string | undefined): string {
    switch (reason) {
      case 'Submitted':
        return styles.reasonSubmitted;
      case 'Reopened':
        return styles.reasonReopened;
      case 'Approved':
        return styles.reasonApproved;
      case 'Rejected':
        return styles.reasonRejected;
      default:
        return styles.reasonAutosave;
    }
  }

  // Header count reflects total snapshots (not filtered) so users always see
  // how many exist; an active filter narrows the rendered list below.
  const totalCount = (versions ?? []).length;
  const list = filtered;

  // Reason buckets shown as filter chips. Mirrors snapshotAssessment's
  // SnapshotReason union; `activeClass` colours the chip with the same
  // palette its row-chip variant uses, so the filter feels visually wired
  // to the snapshots it controls.
  const reasonOptions: Array<{
    key: string;
    label: string;
    activeClass: string;
  }> = [
    { key: 'Autosave', label: 'Autosave', activeClass: styles.filterChipAutosave },
    { key: 'Submitted', label: 'Submitted', activeClass: styles.filterChipSubmitted },
    { key: 'Reopened', label: 'Reopened', activeClass: styles.filterChipReopened },
    { key: 'Approved', label: 'Approved', activeClass: styles.filterChipApproved },
    { key: 'Rejected', label: 'Rejected', activeClass: styles.filterChipRejected },
  ];

  return (
    <OverlayDrawer
      position="end"
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      className={styles.surface}
    >
      <DrawerHeader className={styles.header}>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              className={styles.closeBtn}
              onClick={() => onOpenChange(false)}
              aria-label="Close history"
            />
          }
        >
          <div className={styles.headerTitleRow}>
            <History16Regular />
            Version history
            {totalCount > 0 && (
              <span className={styles.headerCount}>
                {activeReasons.size > 0
                  ? `${list.length} of ${totalCount}`
                  : `${totalCount} snapshot${totalCount === 1 ? '' : 's'}`}
              </span>
            )}
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      {totalCount > 0 && (
        <div className={styles.filterBar}>
          <span className={styles.filterIcon} aria-hidden>
            <Filter16Regular />
          </span>
          {reasonOptions.map((r) => {
            const active = activeReasons.has(r.key);
            return (
              <button
                key={r.key}
                type="button"
                className={`${styles.filterChip} ${active ? r.activeClass : ''}`}
                onClick={() => toggleReason(r.key)}
                aria-pressed={active}
              >
                {r.label}
              </button>
            );
          })}
          {activeReasons.size > 0 && (
            <button
              type="button"
              className={styles.filterReset}
              onClick={() => setActiveReasons(new Set())}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <DrawerBody style={{ padding: 0 }}>
        <div className={styles.body}>
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{(error as Error).message}</MessageBarBody>
            </MessageBar>
          )}

          {isLoading && <Spinner size="extra-tiny" label="Loading…" />}

          {!isLoading && list.length === 0 && totalCount === 0 && (
            <div className={styles.empty}>
              No snapshots yet. The first save will create one.
            </div>
          )}
          {!isLoading && list.length === 0 && totalCount > 0 && (
            <div className={styles.empty}>
              No snapshots match the current filter.
            </div>
          )}

          {list.map((v) => {
            const reason = v.dnx_change_summary ?? 'Autosave';
            const author =
              lookupName(v, 'ownerid') ??
              v.owneridname ??
              lookupName(v, 'createdby') ??
              v.createdbyname ??
              '—';
            return (
              <div key={v.dnx_assessment_versionid} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.versionLine}>
                    <span className={styles.versionNumber}>v{v.dnx_version_number}</span>
                    <span className={`${styles.reasonChip} ${reasonClass(reason)}`}>
                      {reason}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    {author}
                    <span className={styles.metaSeparator}>·</span>
                    {fmtTime(v.createdon)}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowSwap16Regular />}
                    className={styles.downloadBtn}
                    onClick={() => setDiffTarget({ row: v, mode: 'compare' })}
                  >
                    Compare
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowSync16Regular />}
                    className={styles.downloadBtn}
                    onClick={() => setDiffTarget({ row: v, mode: 'replace' })}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DrawerBody>

      <SnapshotDiffDialog
        instanceId={instanceId}
        templateId={templateId}
        versionRowId={diffTarget?.row.dnx_assessment_versionid ?? null}
        versionNumber={diffTarget?.row.dnx_version_number}
        capturedAt={diffTarget?.row.createdon}
        reason={diffTarget?.row.dnx_change_summary}
        startInConfirm={diffTarget?.mode === 'replace'}
        open={diffTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDiffTarget(null);
        }}
      />
    </OverlayDrawer>
  );
}
