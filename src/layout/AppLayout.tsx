import { Outlet, NavLink } from 'react-router-dom';
import { makeStyles } from '@fluentui/react-components';
import {
  Alert16Regular,
  ClipboardTaskListLtr20Regular,
} from '@fluentui/react-icons';
import { useCurrentUser } from '../lib/currentUser';
import { useCurrentUserRoles, appRoleLabel } from '../lib/roles';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--color-background-tertiary)',
  },
  topbar: {
    height: '52px',
    backgroundColor: 'var(--color-background-primary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '20px',
    paddingRight: '20px',
    gap: '16px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    letterSpacing: '-0.005em',
  },
  brandMark: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-purple)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: '0.5px',
    height: '24px',
    backgroundColor: 'var(--color-border-tertiary)',
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
    padding: '6px 12px',
    borderRadius: 'var(--border-radius-md)',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 400,
    transition: 'background-color 0.1s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      color: 'var(--color-text-primary)',
    },
  },
  navLinkActive: {
    backgroundColor: 'var(--color-background-secondary)',
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconBtn: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--border-radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    ':hover': {
      backgroundColor: 'var(--color-background-secondary)',
      color: 'var(--color-text-primary)',
    },
  },
  rolePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: 'var(--border-radius-pill)',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    whiteSpace: 'nowrap',
  },
  rolePillNone: {
    backgroundColor: 'var(--color-gray-soft)',
    color: 'var(--color-gray-text)',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-purple)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    padding: '20px',
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
    </div>
  );
}
