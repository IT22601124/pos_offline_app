import React, { useMemo } from 'react';
import { NavPage } from '../types';

interface NavItem {
  id: NavPage;
  label: string;
  icon: string;
}

const ALL_MAIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: 'ti-home' },
  { id: 'pos', label: 'POS terminal', icon: 'ti-cash-register' },
  { id: 'posManagement', label: 'POS management', icon: 'ti-building-store' },
  { id: 'users', label: 'User management', icon: 'ti-users' },
  { id: 'branches', label: 'Branch management', icon: 'ti-building' },
  { id: 'roles', label: 'Role management', icon: 'ti-shield-lock' },
  { id: 'analytics', label: 'Analytics', icon: 'ti-chart-bar' },
];

const SETTINGS_NAV: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: 'ti-user-circle' },
  { id: 'settings', label: 'Settings', icon: 'ti-settings' },
];

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getInitials = (name: string): string => {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, collapsed = false, onToggleCollapse }) => {
  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const userName = currentUser?.name || currentUser?.username || 'User';
  const roleName = typeof currentUser?.role === 'string' ? currentUser.role : currentUser?.role?.name || 'Cashier';
  const roleLower = roleName.toLowerCase();

  const isCashier = roleLower.includes('cashier');
  const isManager = roleLower.includes('manager');

  const mainNav = useMemo(() => {
    if (isCashier) {
      return ALL_MAIN_NAV.filter((item) => ['pos', 'dashboard', 'posManagement', 'branches', 'analytics'].includes(item.id));
    }
    if (isManager) {
      return ALL_MAIN_NAV.filter((item) => ['dashboard', 'pos', 'posManagement', 'users', 'branches', 'analytics'].includes(item.id));
    }
    return ALL_MAIN_NAV;
  }, [isCashier, isManager]);

  return (
    <aside style={{ ...styles.sidebar, ...(collapsed ? styles.sidebarCollapsed : {}) }}>
      {/* Logo */}
      <div style={{ ...styles.logo, ...(collapsed ? styles.logoCollapsed : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={styles.logoMark}>
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
          </div>
          {!collapsed && <span style={styles.logoName}>AdminPanel</span>}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand main navigation' : 'Minimize main navigation'}
            style={{
              border: 'none',
              background: 'var(--app-surface-soft, rgba(0,0,0,0.04))',
              color: 'var(--app-muted, #667085)',
              borderRadius: 6,
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: collapsed ? 0 : 'auto',
              marginTop: collapsed ? 6 : 0,
              transition: 'all 0.15s ease',
            }}
          >
            <i className={`ti ${collapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} style={{ fontSize: 15 }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ ...styles.nav, ...(collapsed ? styles.navCollapsed : {}) }}>
        {!collapsed && <span style={styles.navSection}>Main</span>}
        {mainNav.map((item) => (
          <button
            key={item.id}
            style={{
              ...styles.navItem,
              ...(collapsed ? styles.navItemCollapsed : {}),
              ...(activePage === item.id ? styles.navItemActive : {}),
            }}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
          >
            <i className={`ti ${item.icon}`} style={styles.navIcon} aria-hidden="true" />
            {!collapsed && item.label}
          </button>
        ))}

        {!collapsed && <span style={{ ...styles.navSection, marginTop: 8 }}>Settings</span>}
        {SETTINGS_NAV.map((item) => (
          <button
            key={item.id}
            style={{
              ...styles.navItem,
              ...(collapsed ? styles.navItemCollapsed : {}),
              ...(activePage === item.id ? styles.navItemActive : {}),
            }}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
          >
            <i className={`ti ${item.icon}`} style={styles.navIcon} aria-hidden="true" />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ ...styles.footer, ...(collapsed ? styles.footerCollapsed : {}) }}>
        <button
          style={styles.profileButton}
          onClick={() => onNavigate('profile')}
          aria-label="Open profile"
        >
          <div style={styles.avatar}>{getInitials(userName)}</div>
        </button>
        {!collapsed && (
          <>
            <button
              style={styles.avatarInfoButton}
              onClick={() => onNavigate('profile')}
              aria-label="Open profile"
            >
              <div style={styles.avatarName}>{userName}</div>
              <div style={styles.avatarRole}>{roleName}</div>
            </button>
            <button style={styles.iconBtn} aria-label="Settings" onClick={() => onNavigate('settings')}>
              <i className="ti ti-settings" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--app-sidebar-bg)',
    borderRight: '1px solid var(--app-border)',
    color: 'var(--app-text)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    transition: 'width 0.2s ease',
  },
  sidebarCollapsed: {
    width: 72,
  },
  logo: {
    padding: '18px 20px',
    borderBottom: '1px solid var(--app-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoCollapsed: {
    justifyContent: 'center',
    padding: '18px 10px',
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: '#534AB7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 14,
  },
  logoName: {
    fontWeight: 500,
    fontSize: 15,
    color: 'var(--app-text-strong)',
  },
  nav: {
    flex: 1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navCollapsed: {
    alignItems: 'center',
    padding: '12px 8px',
  },
  navSection: {
    fontSize: 11,
    color: 'var(--app-muted)',
    padding: '10px 10px 4px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    color: 'var(--app-muted)',
    fontSize: 13.5,
    border: 'none',
    borderLeft: '4px solid transparent',
    background: 'transparent',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: 'inherit',
    outline: 'none',
    fontWeight: 400,
    transition: 'all 0.15s ease',
  },
  navItemCollapsed: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    padding: 0,
    borderRadius: 10,
  },
  navItemActive: {
    background: 'var(--app-accent-soft, rgba(47, 128, 237, 0.12))',
    color: 'var(--app-accent-strong, #2F80ED)',
    fontWeight: 700,
    borderLeft: '4px solid #2F80ED',
  },


  navIcon: {
    fontSize: 17,
  },
  footer: {
    padding: '14px 16px',
    borderTop: '1px solid var(--app-border)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  footerCollapsed: {
    justifyContent: 'center',
    padding: '14px 10px',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--app-accent-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--app-accent-strong)',
    flexShrink: 0,
  },
  profileButton: {
    border: 'none',
    background: 'none',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  avatarInfo: {
    flex: 1,
    minWidth: 0,
  },
  avatarInfoButton: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'none',
    padding: 0,
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: 'var(--app-text)',
  },
  avatarName: {
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  avatarRole: {
    fontSize: 11,
    color: 'var(--app-muted)',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--app-button-text)',
    flexShrink: 0,
    fontSize: 15,
  },
};

export default Sidebar;
