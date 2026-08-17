import { makeStyles } from '@fluentui/react-components';
import { ArrowUp20Regular } from '@fluentui/react-icons';
import { useScrolledPast } from '../lib/useScrolledPast';

/*
 * A floating "back to top" button — a circular icon FAB that expands on hover
 * to reveal its label (shared `.fab-expand` helper in index.css, also used by
 * the assessment page's "Application details" jump for a consistent feel).
 * Appears once the page has scrolled past a threshold. Mounted once in
 * AppLayout; watches the window scroller.
 */
const useStyles = makeStyles({
  btn: {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    zIndex: 40,
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    boxShadow: '0 6px 20px -6px rgba(17, 24, 39, 0.4)',
    opacity: 0,
    transform: 'translateY(8px)',
    pointerEvents: 'none',
    transition: 'opacity 0.18s ease, transform 0.18s ease, width 0.24s cubic-bezier(0.34, 1.1, 0.5, 1), gap 0.24s ease, background-color 0.1s ease',
    ':hover': { backgroundColor: '#26384a' },
  },
  visible: { opacity: 1, transform: 'translateY(0)', pointerEvents: 'auto' },
});

export function ScrollToTop() {
  const styles = useStyles();
  const show = useScrolledPast(400);

  return (
    <button
      type="button"
      aria-label="Back to top"
      className={`fab-expand ${styles.btn} ${show ? styles.visible : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <span className="fab-icon">
        <ArrowUp20Regular />
      </span>
      <span className="fab-label">Back to top</span>
    </button>
  );
}
