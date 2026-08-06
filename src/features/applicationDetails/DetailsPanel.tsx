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

const useStyles = makeStyles({
  panel: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-secondary)',
    padding: '10px 12px',
    marginBottom: '12px',
  },
  head: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-tertiary)',
    marginBottom: '8px',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' },
  row: { display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 0' },
  key: { fontSize: '11px', color: 'var(--color-text-secondary)' },
  val: { fontSize: '12px', color: 'var(--color-text-primary)' },
  // Repeating items: one bordered block per array element.
  item: {
    borderTop: '0.5px solid var(--color-border-tertiary)',
    paddingTop: '6px',
    marginTop: '6px',
  },
  itemHead: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    marginBottom: '4px',
  },
  empty: { fontSize: '12px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' },
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

  const label = (f: DetailsField) => f.label ?? f.path;

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
