import { Outlet, NavLink } from 'react-router-dom';
import { makeStyles, Avatar, Text } from '@fluentui/react-components';
import {
  Board24Regular,
  Folder24Regular,
  DocumentBulletList24Regular,
  Sparkle24Filled,
  Settings24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '256px 1fr',
    minHeight: '100vh',
    backgroundColor: 'var(--app-bg)',
  },
  sidebar: {
    background: 'var(--app-sidebar-bg)',
    color: 'var(--app-sidebar-text)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px 20px 16px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px 12px 24px 12px',
    marginBottom: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  brandMark: {
    width: '38px',
    height: '38px',
    borderRadius: '11px',
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    boxShadow: '0 6px 16px -4px rgba(99,102,241,0.6)',
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.2,
  },
  brandTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '15px',
    letterSpacing: '-0.01em',
  },
  brandSub: {
    color: '#9ca3af',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginTop: '2px',
  },
  navSectionLabel: {
    color: '#6b7280',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '16px 12px 8px 12px',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    color: 'var(--app-sidebar-text)',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: '#ffffff',
    },
  },
  navLinkActive: {
    background:
      'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.12) 100%)',
    color: '#ffffff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
  },
  navIcon: {
    display: 'flex',
    color: 'inherit',
    opacity: 0.85,
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 8px 8px 4px',
    borderRadius: '10px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.25,
    overflow: 'hidden',
  },
  userName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    color: '#9ca3af',
    fontSize: '11px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  topbar: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    padding: '20px 40px',
    backdropFilter: 'saturate(180%) blur(14px)',
    WebkitBackdropFilter: 'saturate(180%) blur(14px)',
    background: 'rgba(247, 247, 249, 0.72)',
    borderBottom: '1px solid var(--app-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  topbarTitle: {
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--app-text-muted)',
    letterSpacing: '-0.005em',
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--app-text-muted)',
  },
  iconBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--app-text-muted)',
    ':hover': {
      backgroundColor: 'rgba(15,23,42,0.05)',
      color: 'var(--app-text)',
    },
  },
  main: {
    flex: 1,
    padding: '36px 40px 56px',
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
  },
});

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: <Board24Regular /> },
  { to: '/projects', label: 'Projects', icon: <Folder24Regular /> },
  { to: '/templates', label: 'Templates', icon: <DocumentBulletList24Regular /> },
];

export function AppLayout() {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Sparkle24Filled />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>IntelliAssessment</span>
            <span className={styles.brandSub}>V1 · CodeApp</span>
          </div>
        </div>

        <div className={styles.navSectionLabel}>Workspace</div>
        <nav className={styles.navList}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userRow}>
            <Avatar
              size={36}
              name="Ahmad Aleem"
              color="colorful"
              shape="square"
            />
            <div className={styles.userInfo}>
              <span className={styles.userName}>Ahmad Aleem</span>
              <span className={styles.userRole}>Assessor</span>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <Text className={styles.topbarTitle}>Assessment Workspace</Text>
          <div className={styles.topbarRight}>
            <div className={styles.iconBtn} title="Settings">
              <Settings24Regular />
            </div>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
