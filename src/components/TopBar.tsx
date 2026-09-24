import React from 'react';
import { userLogout } from '../hooks/authentication/logout';

interface TopBarProps {
  title: string;
  onSearch: (query: string) => void;
  searchValue: string;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  title,
  onSearch: _onSearch,
  searchValue: _searchValue,
  onToggleSidebar,
  sidebarCollapsed = false,
}) => {
  return (
    <header style={styles.topbar}>
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Expand main navigation' : 'Minimize main navigation'}
          style={{ ...styles.iconBtn, marginRight: 4 }}
          aria-label={sidebarCollapsed ? 'Expand main navigation' : 'Minimize main navigation'}
        >
          <i className={`ti ${sidebarCollapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`} aria-hidden="true" />
        </button>
      )}
      <span style={styles.title}>{title}</span>

      {/* <div style={styles.searchWrap}>
        <i className="ti ti-search" style={styles.searchIcon} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div> */}

      {/* <button style={styles.iconBtn} aria-label="Notifications">
        <i className="ti ti-bell" aria-hidden="true" />
      </button>
      <button style={styles.iconBtn} aria-label="Help">
        <i className="ti ti-help-circle" aria-hidden="true" />
      </button> */}
      <button
        style={{ ...styles.iconBtn, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
        onClick={() => {
          if (window.confirm("Are you sure you want to log out?")) {
            userLogout();
          }
        }}
        aria-label="Logout"
        title="Logout"
      >
        <i className="ti ti-logout" aria-hidden="true" />
      </button>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  topbar: {
    height: 56,
    background: 'var(--app-surface)',
    borderBottom: '1px solid var(--app-border)',
    color: 'var(--app-text)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 16,
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 500,
    flex: 1,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--app-input-bg)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '6px 12px',
    width: 220,
  },
  searchIcon: {
    color: 'var(--app-muted)',
    fontSize: 15,
  },
  searchInput: {
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: 'var(--app-input-text)',
    width: '100%',
    fontFamily: 'inherit',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    border: '1px solid var(--app-border)',
    background: 'var(--app-button-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--app-button-text)',
    fontSize: 16,
  },
};

export default TopBar;
