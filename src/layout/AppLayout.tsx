import { Outlet, NavLink } from 'react-router-dom';
import { makeStyles } from '@fluentui/react-components';
import {
  Alert16Regular,
  ClipboardTaskListLtr20Regular,
} from '@fluentui/react-icons';
import { useCurrentUser } from '../lib/currentUser';
import { useCurrentUserRoles, appRoleLabel } from '../lib/roles';
import { useModalScrollLock } from '../lib/useModalScrollLock';
import { ScrollToTop } from '../components/ScrollToTop';

/*
 * App shell — Design System v1.0 ("Calm Efficiency"). Deep-navy brand mark,
 * blue accent on the active nav link + avatar, light-grey app background.
 * The role pill is a neutral app-role badge (violet stays reserved for AI).
 */
const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--ds-surface-base)',
  },
  topbar: {
    height: '56px',
    backgroundColor: 'var(--ds-surface-card)',
    borderBottom: '1px solid var(--ds-border)',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '24px',
    paddingRight: '24px',
    gap: '18px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 600,
    color: 'var(--ds-text-strong)',
    letterSpacing: '-0.01em',
  },
  brandMark: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    backgroundColor: 'var(--ds-brand-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--ds-border)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
  },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 14px',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--ds-text-body)',
    textDecoration: 'none',
    fontSize: 'var(--ds-fs-body)',
    fontWeight: 500,
    transition: 'background-color 0.1s ease, color 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--ds-surface-base)',
      color: 'var(--ds-text-strong)',
    },
  },
  navLinkActive: {
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    fontWeight: 600,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconBtn: {
    width: '34px',
    height: '34px',
    borderRadius: 'var(--border-radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--ds-text-muted)',
    ':hover': {
      backgroundColor: 'var(--ds-surface-base)',
      color: 'var(--ds-text-strong)',
    },
  },
  rolePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 11px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    whiteSpace: 'nowrap',
  },
  rolePillNone: {
    backgroundColor: 'var(--ds-surface-base)',
    color: 'var(--ds-text-muted)',
  },
  avatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    padding: '24px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
  },
});

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/assessments', label: 'Assessments' },
  { to: '/templates', label: 'Templates' },
];

/** First-letter initials from a full name (max 2), fallback "?". */
function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.slice(0, 2).map((p) => p[0]!.toUpperCase());
  return letters.join('');
}

export function AppLayout() {
  const styles = useStyles();
  useModalScrollLock();
  const { data: user } = useCurrentUser();
  const roles = useCurrentUserRoles();
  const name = user?.fullName;
  const roleText = appRoleLabel(roles);
  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <ClipboardTaskListLtr20Regular />
          </div>
          IntelliAssessment
        </div>
        <div className={styles.divider} />
        <nav className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.topbarRight}>
          <div className={styles.iconBtn} title="Notifications" aria-label="Notifications">
            <Alert16Regular />
          </div>
          {!roles.isLoading && (
            <span
              className={`${styles.rolePill} ${roleText ? '' : styles.rolePillNone}`}
              title={
                roleText
                  ? `Your app role${roleText.includes('·') ? 's' : ''}: ${roleText}`
                  : 'No app role assigned — some actions are hidden'
              }
            >
              {roleText || 'No role'}
            </span>
          )}
          <div
            className={styles.avatar}
            title={name ?? 'Account'}
            aria-label={name ? `Account: ${name}` : 'Account'}
          >
            {initialsOf(name)}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <ScrollToTop />
    </div>
  );
}
