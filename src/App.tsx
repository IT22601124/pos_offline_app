import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type Branch, type NavPage, type Role } from './types';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { getAllBranches } from './hooks/branch/branch_controller';
import { getAllRoles } from './hooks/users/role_constroller';
import {
  DEFAULT_PAGE,
  getPageFromPath,
  PAGE_PATHS,
  PAGE_TITLES,
} from './appRouter/route_config';
import {
  APP_THEME_CHANGE_EVENT,
  applyAppTheme,
  getStoredTheme,
  persistAppTheme,
  type AppThemeMode,
} from './theme/app_theme';

export interface AdminOutletContext {
  searchQuery: string;
  branches: Branch[];
  roles: Role[];
  theme: AppThemeMode;
  onThemeChange: (theme: AppThemeMode) => void;
  onAddBranch: (branch: Omit<Branch, 'id' | 'status'>) => void;
  onAddRole: (role: Omit<Role, 'id' | 'status'>) => void;
}

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchState, setSearchState] = useState({
    page: DEFAULT_PAGE,
    query: '',
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [theme, setTheme] = useState<AppThemeMode>(() => getStoredTheme());

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem('main_sidebar_collapsed');
    return stored !== null ? stored === 'true' : false;
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('main_sidebar_collapsed', String(next));
      return next;
    });
  };

  const activePage = getPageFromPath(location.pathname) ?? DEFAULT_PAGE;
  const searchQuery = searchState.page === activePage ? searchState.query : '';
  const isPosMode = activePage === 'pos';

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [location.pathname]);

  const userRole = (typeof currentUser?.role === 'string' ? currentUser.role : currentUser?.role?.name || '').toLowerCase();
  const isCashier = userRole.includes('cashier');

  useEffect(() => {
    if (isCashier && ['users', 'roles'].includes(activePage)) {
      navigate(PAGE_PATHS['pos'], { replace: true });
    }
  }, [isCashier, activePage, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        const apiBranches = await getAllBranches();
        if (isMounted) {
          setBranches(apiBranches);
        }
      } catch {
        if (isMounted) {
          setBranches([]);
        }
      }
    };

    const loadRoles = async () => {
      try {
        const apiRoles = await getAllRoles();
        if (isMounted) {
          setRoles(apiRoles);
        }
      } catch {
        if (isMounted) {
          setRoles([]);
        }
      }
    };

    loadBranches();
    loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<AppThemeMode>).detail;
      if (nextTheme === 'light' || nextTheme === 'dark') {
        setTheme(nextTheme);
      }
    };

    window.addEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  const handleNavigate = (page: NavPage) => {
    setSearchState({ page, query: '' });
    navigate(PAGE_PATHS[page]);
  };

  const addBranch = (branch: Omit<Branch, 'id' | 'status'>) => {
    setBranches((prev) => [
      ...prev,
      {
        id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
        status: 'Active',
        ...branch,
      },
    ]);
  };

  const addRole = (role: Omit<Role, 'id' | 'status'>) => {
    setRoles((prev) => [
      ...prev,
      {
        id: prev.length ? Math.max(...prev.map((item) => item.id)) + 1 : 1,
        status: 'Active',
        ...role,
      },
    ]);
  };

  const handleThemeChange = useCallback((nextTheme: AppThemeMode) => {
    setTheme(nextTheme);
    persistAppTheme(nextTheme);
  }, []);

  const outletContext = useMemo<AdminOutletContext>(
    () => ({
      searchQuery,
      branches,
      roles,
      theme,
      onThemeChange: handleThemeChange,
      onAddBranch: addBranch,
      onAddRole: addRole,
    }),
    [branches, handleThemeChange, roles, searchQuery, theme],
  );

  return (
    <div style={styles.shell}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={isPosMode || isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      <div style={styles.main}>
        <TopBar
          title={PAGE_TITLES[activePage]}
          onSearch={(query) => setSearchState({ page: activePage, query })}
          searchValue={searchQuery}
          onToggleSidebar={handleToggleSidebar}
          sidebarCollapsed={isPosMode || isSidebarCollapsed}
        />
        <div style={styles.content}>
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    height: '100vh',
    background: 'var(--app-bg)',
    color: 'var(--app-text)',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    overflow: 'hidden',
    transition: 'background 0.18s ease, color 0.18s ease',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
};

export default App;
