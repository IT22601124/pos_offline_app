import { type NavPage } from '../types';

export const DEFAULT_PAGE: NavPage = 'users';

export const PAGE_TITLES: Record<NavPage, string> = {
  dashboard: 'Overview',
  pos: 'POS terminal',
  posManagement: 'POS management',
  users: 'User management',
  branches: 'Branch management',
  roles: 'Role management',
  analytics: 'Analytics',
  settings: 'Settings',
  profile: 'Profile',
  permissions: 'Permissions',
  audit: 'Audit log',
  hr: 'HR management',
};

export const PAGE_ICONS: Partial<Record<NavPage, string>> = {
  pos: 'ti-cash-register',
  posManagement: 'ti-building-store',
  branches: 'ti-building',
  roles: 'ti-shield-lock',
  analytics: 'ti-chart-bar',
  settings: 'ti-settings',
  profile: 'ti-user-circle',
  permissions: 'ti-lock',
  audit: 'ti-file-text',
  hr: 'ti-id',
};

export const PAGE_PATHS: Record<NavPage, string> = {
  dashboard: '/dashboard',
  pos: '/pos',
  posManagement: '/pos-management',
  users: '/users',
  branches: '/branches',
  roles: '/roles',
  analytics: '/analytics',
  settings: '/settings',
  profile: '/profile',
  permissions: '/permissions',
  audit: '/audit',
  hr: '/hr',
};

export const APP_ROUTES = Object.entries(PAGE_PATHS).map(([page, path]) => ({
  page: page as NavPage,
  path,
  routePath: path.replace(/^\//, ''),
}));

export const getPageFromPath = (pathname: string): NavPage | undefined => {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  return APP_ROUTES.find((route) => route.path === normalizedPath)?.page;
};
