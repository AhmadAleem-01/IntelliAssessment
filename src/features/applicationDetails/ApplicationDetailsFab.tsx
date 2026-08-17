import { useState } from 'react';
import { makeStyles } from '@fluentui/react-components';
import { DocumentData20Regular, Dismiss16Regular } from '@fluentui/react-icons';
import { formatValue } from './appData';

/*
 * Floating "Application details" reference — a bottom-right FAB that expands
 * IN PLACE into a scrollable panel showing the applicant's data. Deliberately
 * NOT a Fluent Dialog: a modal toggles the page's scroll container in this
 * Power Apps webview, which yanked the page to the top. This is a plain
 * positioned element, so opening it never touches page scroll.
 */

function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface Group {
  title: string | null;
  rows: { label: string; value: string }[];
}

function toGroups(root: Record<string, unknown>): Group[] {
  const groups: Group[] = [];
  const overview: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(root)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const rows = Object.entries(item as Record<string, unknown>)
            .filter(([, cv]) => cv !== null && cv !== undefined && typeof cv !== 'object')
            .map(([ck, cv]) => ({ label: humanize(ck), value: formatValue(cv) }));
          if (rows.length) groups.push({ title: `${humanize(k)} ${i + 1}`, rows });
        } else {
          overview.push({ label: `${humanize(k)} ${i + 1}`, value: formatValue(item) });
        }
      });
    } else if (typeof v === 'object') {
      const rows = Object.entries(v as Record<string, unknown>)
        .filter(([, cv]) => cv !== null && cv !== undefined && typeof cv !== 'object')
        .map(([ck, cv]) => ({ label: humanize(ck), value: formatValue(cv) }));
      if (rows.length) groups.push({ title: humanize(k), rows });
    } else {
      overview.push({ label: humanize(k), value: formatValue(v) });
    }
  }
  return overview.length ? [{ title: null, rows: overview }, ...groups] : groups;
}

const useStyles = makeStyles({
  wrap: { position: 'fixed', right: '24px', bottom: '78px', zIndex: 40 },
  panel: {
    width: '360px',
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'min(560px, calc(100vh - 140px))',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-ai-border)',
    borderRadius: 'var(--ds-radius-card)',
    boxShadow: '0 18px 50px -12px rgba(17, 24, 39, 0.4)',
    overflow: 'hidden',
    // Grow-in from the button corner.
    transformOrigin: 'bottom right',
    animationName: {
      from: { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
      to: { opacity: 1, transform: 'translateY(0) scale(1)' },
    },
    animationDuration: '0.16s',
    animationTimingFunction: 'ease-out',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--ds-border)',
    flexShrink: 0,
  },
  headTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
  },
  headIcon: { color: 'var(--ds-ai-primary)', display: 'flex' },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--ds-text-muted)',
    padding: '3px',
    borderRadius: '6px',
    display: 'flex',
    ':hover': { color: 'var(--ds-text-strong)', backgroundColor: 'var(--ds-surface-base)' },
  },
  body: { display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', overflowY: 'auto', minHeight: 0 },
  fileName: { fontSize: '11px', color: 'var(--ds-text-muted)' },
  group: { display: 'flex', flexDirection: 'column', gap: '8px' },
  groupTitle: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-ai-primary)',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' },
  row: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  key: { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ds-text-muted)' },
  val: { fontSize: 'var(--ds-fs-body)', fontWeight: 500, color: 'var(--ds-text-strong)', wordBreak: 'break-word' },
  empty: { padding: '20px 16px', fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-muted)' },
  // Collapsed FAB (uses the shared .fab-expand helper for the hover label).
  fab: {
    border: '1px solid var(--ds-ai-border)',
    backgroundColor: 'var(--ds-surface-card)',
    color: 'var(--ds-ai-primary)',
    boxShadow: '0 6px 20px -6px rgba(17, 24, 39, 0.35)',
    ':hover': { backgroundColor: 'var(--ds-ai-surface)' },
  },
});

interface Props {
  data: Record<string, unknown> | null;
  detailsName?: string;
}

export function ApplicationDetailsFab({ data, detailsName }: Props) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const groups = data ? toGroups(data) : [];

  if (open) {
    return (
      <div className={styles.wrap}>
        <div className={styles.panel} role="region" aria-label="Application details">
          <div className={styles.head}>
            <span className={styles.headTitle}>
              <span className={styles.headIcon}>
                <DocumentData20Regular />
              </span>
              Application details
            </span>
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <Dismiss16Regular />
            </button>
          </div>
          {!data ? (
            <div className={styles.empty}>No application-details file is attached.</div>
          ) : (
            <div className={styles.body}>
              {detailsName && <span className={styles.fileName}>{detailsName}</span>}
              {groups.map((g, gi) => (
                <div key={g.title ?? `overview-${gi}`} className={styles.group}>
                  {g.title && <span className={styles.groupTitle}>{g.title}</span>}
                  <div className={styles.grid}>
                    {g.rows.map((r, i) => (
                      <div key={`${r.label}-${i}`} className={styles.row}>
                        <span className={styles.key}>{r.label}</span>
                        <span className={styles.val}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`fab-expand ${styles.fab}`}
        aria-label="View application details"
        onClick={() => setOpen(true)}
      >
        <span className="fab-icon">
          <DocumentData20Regular />
        </span>
        <span className="fab-label">Application details</span>
      </button>
    </div>
  );
}
