import { makeStyles } from '@fluentui/react-components';
import { DocumentData16Regular } from '@fluentui/react-icons';
import { parseDetailsLayout } from './detailsLayout';
import { resolvePath, formatValue } from './appData';

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
});

interface Props {
  /** The level's stored `dnx_details_layout` JSON. */
  storedLayout: string | undefined;
  /** The assessment's parsed application-details JSON (null when none). */
  applicationData: Record<string, unknown> | null;
}

/**
 * Read-only "details" panel shown at the top of a Section/Subsection body when
 * the level has an authored details layout. Resolves each chosen attribute path
 * against the assessment's application-details JSON. Renders nothing when there
 * is no layout, or no application-details file to resolve against.
 */
export function DetailsPanel({ storedLayout, applicationData }: Props) {
  const styles = useStyles();
  const layout = parseDetailsLayout(storedLayout);
  if (!layout || layout.fields.length === 0) return null;
  if (!applicationData) return null;

  return (
    <div className={styles.panel}>
      <span className={styles.head}>
        <DocumentData16Regular />
        Application details
      </span>
      <div className={styles.grid}>
        {layout.fields.map((f) => {
          const resolved = resolvePath(applicationData, f.path);
          return (
            <div key={f.id} className={styles.row}>
              <span className={styles.key}>{f.label ?? f.path}</span>
              <span className={styles.val}>
                {resolved === undefined ? '—' : formatValue(resolved)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
