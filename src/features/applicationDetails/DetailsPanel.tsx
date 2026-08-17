import { makeStyles } from '@fluentui/react-components';
import { DocumentData16Regular } from '@fluentui/react-icons';
import { parseDetailsLayout, type DetailsField } from './detailsLayout';
import {
  resolvePath,
  resolvePathAt,
  arrayLengthForPath,
  isRepeatingPath,
  formatValue,
} from './appData';

/**
 * Turn a dot/array path into a readable label from its last segment:
 * "applicant.fullName" → "Full name", "quals[].title" → "Title".
 */
function humanizePath(path: string): string {
  const last = path.replace(/\[\d*\]/g, '').split('.').filter(Boolean).pop() ?? path;
  const spaced = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/*
 * Application-details reference panel (design.md). Soft-violet AI-tinted card
 * (it's the application data that grounds AI judgements) with humanized labels
 * and prominent values — a clean reference, not a raw path dump.
 */
const useStyles = makeStyles({
  panel: {
    border: '1px solid var(--ds-ai-border)',
    borderRadius: 'var(--ds-radius-card)',
    backgroundColor: 'var(--ds-ai-surface)',
    padding: '14px 16px',
    marginBottom: '14px',
  },
  head: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--ds-ai-primary)',
    marginBottom: '12px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 20px' },
  row: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  key: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--ds-text-muted)',
  },
  val: {
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    color: 'var(--ds-text-strong)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Repeating items: one block per array element, divided.
  item: {
    borderTop: '1px solid var(--ds-ai-border)',
    paddingTop: '10px',
    marginTop: '10px',
  },
  itemHead: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-ai-primary)',
    marginBottom: '8px',
  },
  empty: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)', fontStyle: 'italic' },
});

interface Props {
  /** The level's stored `dnx_details_layout` JSON. */
  storedLayout: string | undefined;
  /** The assessment's parsed application-details JSON (null when none). */
  applicationData: Record<string, unknown> | null;
}

/**
 * Read-only "details" panel shown at the top of a Section/Subsection body when
 * the level has an authored details layout. Renders nothing without a layout /
 * without an application-details file.
 *
 * Fields split into two groups:
 *  - **scalar** paths (e.g. `applicant.name`) render once in a two-column grid;
 *  - **repeating** paths (e.g. `qualifications[].title`) render one block PER
 *    array item, so a list attribute shows every element, not just the first.
 * A panel can mix both (scalars on top, then the repeating items).
 */
export function DetailsPanel({ storedLayout, applicationData }: Props) {
  const styles = useStyles();
  const layout = parseDetailsLayout(storedLayout);
  if (!layout || layout.fields.length === 0) return null;
  if (!applicationData) return null;

  const scalarFields = layout.fields.filter((f) => !isRepeatingPath(f.path));
  const repeatingFields = layout.fields.filter((f) => isRepeatingPath(f.path));

  // A fixed `arrayIndex` pins this whole panel to one array element (e.g. a
  // "Qualification 2" subsection → qualifications[1]); its repeating fields then
  // render a single block at that index, not one-per-item.
  const pinnedIndex = layout.arrayIndex;
  const isPinned = pinnedIndex !== undefined;

  // Item count = the longest array any repeating field iterates. (Different
  // fields usually iterate the same array; taking the max keeps them aligned.)
  const itemCount = repeatingFields.reduce(
    (n, f) => Math.max(n, arrayLengthForPath(applicationData, f.path)),
    0,
  );

  // Prefer the author's label; otherwise humanize the last path segment so a
  // field reads "Full name" instead of the raw dot-path "applicant.fullName".
  const label = (f: DetailsField) => f.label ?? humanizePath(f.path);

  return (
    <div className={styles.panel}>
      <span className={styles.head}>
        <DocumentData16Regular />
        Application details
      </span>

      {scalarFields.length > 0 && (
        <div className={styles.grid}>
          {scalarFields.map((f) => {
            const resolved = resolvePath(applicationData, f.path);
            return (
              <div key={f.id} className={styles.row}>
                <span className={styles.key}>{label(f)}</span>
                <span className={styles.val}>
                  {resolved === undefined ? '—' : formatValue(resolved)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pinned to a fixed array index: one block, resolved at that index. */}
      {repeatingFields.length > 0 && isPinned && (
        <div className={styles.grid}>
          {repeatingFields.map((f) => {
            const resolved = resolvePathAt(applicationData, f.path, pinnedIndex!);
            return (
              <div key={f.id} className={styles.row}>
                <span className={styles.key}>{label(f)}</span>
                <span className={styles.val}>
                  {resolved === undefined ? '—' : formatValue(resolved)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Not pinned: render one block per array item. */}
      {repeatingFields.length > 0 &&
        !isPinned &&
        (itemCount === 0 ? (
          <div className={styles.empty}>No items.</div>
        ) : (
          Array.from({ length: itemCount }, (_, i) => (
            <div key={i} className={styles.item}>
              <div className={styles.itemHead}>#{i + 1}</div>
              <div className={styles.grid}>
                {repeatingFields.map((f) => {
                  const resolved = resolvePathAt(applicationData, f.path, i);
                  return (
                    <div key={f.id} className={styles.row}>
                      <span className={styles.key}>{label(f)}</span>
                      <span className={styles.val}>
                        {resolved === undefined ? '—' : formatValue(resolved)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ))}
    </div>
  );
}
