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
import { Dismiss20Regular } from '@fluentui/react-icons';
import type { Dnx_assessment_versions } from '../../generated/models/Dnx_assessment_versionsModel';
import { lookupName } from '../../lib/dataverse';
import { useCurrentUser } from '../../lib/currentUser';
import { useVersionHistory } from './api';
import { SnapshotDiffDialog } from './SnapshotDiffDialog';
import { SegmentedControl } from '../../components/SegmentedControl';

const REASON = {
  Autosave: { label: 'autosaved', color: 'var(--ds-text-muted)', bg: 'var(--ds-surface-base)', text: 'var(--ds-text-body)' },
  Submitted: { label: 'submitted', color: 'var(--ds-brand-accent)', bg: 'var(--ds-brand-accent-soft)', text: 'var(--ds-brand-accent)' },
  Reopened: { label: 'reopened', color: 'var(--ds-pending)', bg: 'var(--ds-pending-soft)', text: '#b45309' },
  Approved: { label: 'approved', color: 'var(--ds-suitable)', bg: 'var(--ds-suitable-soft)', text: '#047857' },
  Rejected: { label: 'rejected', color: 'var(--ds-not-suitable)', bg: 'var(--ds-not-suitable-soft)', text: '#b91c1c' },
} as const;

const useStyles = makeStyles({
  surface: { width: '460px', maxWidth: '92vw' },
  header: { borderBottom: '1px solid var(--ds-border)', paddingBottom: '4px' },
  headerTitleRow: { display: 'flex', alignItems: 'baseline', gap: '10px' },
  headerTitleText: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  headerCount: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  closeBtn: { minWidth: 0, color: 'var(--ds-text-muted)' },
  tabs: { padding: '10px 18px 0' },

  body: {
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
    backgroundColor: 'var(--ds-surface-base)',
  },
  empty: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    padding: '24px 4px',
    textAlign: 'center',
  },
  groupLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-muted)',
    padding: '10px 0 6px',
  },

  /* Timeline: dot + connector on the left, card on the right. */
  tl: { display: 'flex', gap: '12px', position: 'relative' },
  tlLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
    width: '12px',
  },
  tlDot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, marginTop: '18px', zIndex: 1 },
  tlLine: { flex: 1, width: '2px', backgroundColor: 'var(--ds-border)', marginTop: '2px' },
  tlCard: {
    flex: 1,
    minWidth: 0,
    marginBottom: '10px',
    padding: '14px 16px',
    borderRadius: 'var(--ds-radius-card)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tlCardCurrent: {
    borderColor: 'var(--ds-ai-border)',
    backgroundColor: 'var(--ds-ai-surface)',
    boxShadow: '0 0 0 3px var(--ds-ai-glow)',
  },

  topLine: { display: 'flex', alignItems: 'center', gap: '8px' },
  versionNumber: { fontSize: 'var(--ds-fs-body)', fontWeight: 700, color: 'var(--ds-text-strong)' },
  reasonChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  currentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    backgroundColor: 'var(--ds-suitable-soft)',
    color: '#047857',
  },
  time: { marginLeft: 'auto', fontSize: '11px', color: 'var(--ds-text-muted)', flexShrink: 0 },
  descLine: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  avatar: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 600,
    flexShrink: 0,
  },
  desc: {
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-body)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: { display: 'flex', gap: '8px', marginTop: '2px' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: '#26384a', color: '#fff' },
  },

  /* Collapsed autosaves marker. */
  hiddenRow: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '10px',
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px dashed var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    fontSize: 'var(--ds-fs-caption)',
    color: 'var(--ds-text-muted)',
  },
  hiddenShow: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-ai-primary)',
    ':hover': { textDecoration: 'underline' },
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
  const { data: currentUser } = useCurrentUser();
  const myName = currentUser?.fullName;
  const [diffTarget, setDiffTarget] = useState<{
    row: Dnx_assessment_versions;
    mode: 'compare' | 'replace';
  } | null>(null);
  const [scope, setScope] = useState<'milestones' | 'all' | 'mine'>('milestones');
  // When true, autosaves are shown even in the Milestones view.
  const [showAutosaves, setShowAutosaves] = useState(false);

  const authorOf = (v: Dnx_assessment_versions) =>
    lookupName(v, 'ownerid') ?? v.owneridname ?? lookupName(v, 'createdby') ?? v.createdbyname ?? '—';
  const reasonOf = (v: Dnx_assessment_versions) =>
    (v.dnx_change_summary ?? 'Autosave') as keyof typeof REASON;

  // Newest first. The highest version number is the "current" one.
  const all = useMemo(
    () => [...(versions ?? [])].sort((a, b) => (b.dnx_version_number ?? 0) - (a.dnx_version_number ?? 0)),
    [versions],
  );
  const currentId = all[0]?.dnx_assessment_versionid;

  const counts = useMemo(() => {
    let milestones = 0;
    let mine = 0;
    for (const v of all) {
      if (reasonOf(v) !== 'Autosave') milestones += 1;
      if (myName && authorOf(v) === myName) mine += 1;
    }
    return { milestones, all: all.length, mine };
  }, [all, myName]);

  // Rows for the active scope (autosaves toggle only affects Milestones view).
  const rows = useMemo(() => {
    if (scope === 'mine') return all.filter((v) => myName && authorOf(v) === myName);
    if (scope === 'all') return all;
    return showAutosaves ? all : all.filter((v) => reasonOf(v) !== 'Autosave');
  }, [all, scope, myName, showAutosaves]);
  const hiddenAutosaves = scope === 'milestones' && !showAutosaves
    ? all.filter((v) => reasonOf(v) === 'Autosave').length
    : 0;

  function fmtTime(iso: string | undefined): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      return sameDay
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  const isToday = (iso: string | undefined) => {
    if (!iso) return false;
    try {
      return new Date(iso).toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  };

  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '—';

  const totalCount = all.length;

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
            <span className={styles.headerTitleText}>Version history</span>
            {totalCount > 0 && (
              <span className={styles.headerCount}>
                {totalCount} version{totalCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      {totalCount > 0 && (
        <div className={styles.tabs}>
          <SegmentedControl<'milestones' | 'all' | 'mine'>
            ariaLabel="Filter versions"
            value={scope}
            onChange={setScope}
            items={[
              { key: 'milestones', label: 'Milestones', count: counts.milestones },
              { key: 'all', label: 'All', count: counts.all },
              { key: 'mine', label: 'Mine', count: counts.mine },
            ]}
          />
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

          {!isLoading && rows.length === 0 && totalCount === 0 && (
            <div className={styles.empty}>No snapshots yet. The first save will create one.</div>
          )}
          {!isLoading && rows.length === 0 && totalCount > 0 && (
            <div className={styles.empty}>No versions in this view.</div>
          )}

          {rows.map((v, i) => {
            const reason = reasonOf(v);
            const meta = REASON[reason] ?? REASON.Autosave;
            const author = authorOf(v);
            const isCurrent = v.dnx_assessment_versionid === currentId;
            const last = i === rows.length - 1;
            // Date-group headers (Today / Earlier) at transitions.
            const showTodayHeader = i === 0 && isToday(v.createdon);
            const showEarlierHeader =
              (i === 0 && !isToday(v.createdon)) ||
              (i > 0 && isToday(rows[i - 1].createdon) && !isToday(v.createdon));
            return (
              <div key={v.dnx_assessment_versionid}>
                {showTodayHeader && <div className={styles.groupLabel}>Today</div>}
                {showEarlierHeader && <div className={styles.groupLabel}>Earlier</div>}
                <div className={styles.tl}>
                  <div className={styles.tlLeft}>
                    <span className={styles.tlDot} style={{ backgroundColor: meta.color }} />
                    {!last && <span className={styles.tlLine} />}
                  </div>
                  <div className={`${styles.tlCard} ${isCurrent ? styles.tlCardCurrent : ''}`}>
                    <div className={styles.topLine}>
                      <span className={styles.versionNumber}>v{v.dnx_version_number}</span>
                      {isCurrent ? (
                        <span className={styles.currentChip}>Current</span>
                      ) : (
                        <span
                          className={styles.reasonChip}
                          style={{ backgroundColor: meta.bg, color: meta.text }}
                        >
                          {meta.label}
                        </span>
                      )}
                      <span className={styles.time}>{fmtTime(v.createdon)}</span>
                    </div>
                    <div className={styles.descLine}>
                      <span className={styles.avatar} aria-hidden>{initials(author)}</span>
                      <span className={styles.desc}>
                        {author} · {meta.label}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <Button
                        appearance={isCurrent ? 'primary' : 'secondary'}
                        size="small"
                        className={isCurrent ? styles.primaryBtn : undefined}
                        onClick={() => setDiffTarget({ row: v, mode: 'compare' })}
                      >
                        Compare
                      </Button>
                      {!isCurrent && (
                        <Button
                          appearance="secondary"
                          size="small"
                          onClick={() => setDiffTarget({ row: v, mode: 'replace' })}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {hiddenAutosaves > 0 && (
            <div className={styles.tl}>
              <div className={styles.tlLeft}>
                <span className={styles.tlDot} style={{ backgroundColor: 'var(--ds-border)' }} />
              </div>
              <div className={styles.hiddenRow}>
                <span>
                  {hiddenAutosaves} autosave{hiddenAutosaves === 1 ? '' : 's'} hidden
                </span>
                <button type="button" className={styles.hiddenShow} onClick={() => setShowAutosaves(true)}>
                  Show
                </button>
              </div>
            </div>
          )}
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
