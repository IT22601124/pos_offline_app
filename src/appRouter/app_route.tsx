import React from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
  useOutletContext,
} from 'react-router-dom';
import App, { type AdminOutletContext } from '../App';
import AnalyticsPage from '../components/AnalyticsPage';
import BranchManagement from '../components/BranchManagement';
import ComingSoon from '../components/ComingSoon';
import Overview from '../components/Overview';
import PosManagement from '../components/PosManagement';
import PosSystem from '../components/PosSystem';
import ProfileSection from '../components/ProfileSection';
import RoleManagement from '../components/RoleManagement';
import SettingsPage from '../components/SettingsPage';
import SplashScreen from '../screens/splash_screen/splash_screen';
import UserManagement from '../components/UserManagement';
import HRManagement from '../components/HRManagement';
import { type NavPage } from '../types';
import { APP_ROUTES, DEFAULT_PAGE, PAGE_ICONS, PAGE_PATHS, PAGE_TITLES } from './route_config';
import LoginPage from '../screens/authentications/login_screen';

type ComingSoonRoutePage = Exclude<NavPage, 'dashboard' | 'pos' | 'posManagement' | 'users' | 'branches' | 'roles' | 'profile' | 'settings'>;
type PlaceholderRoutePage = Exclude<ComingSoonRoutePage, 'analytics'>;

const DashboardPage: React.FC = () => <Overview />;

const UserManagementPage: React.FC = () => {
  const { branches, roles, searchQuery } = useOutletContext<AdminOutletContext>();

  return (
    <UserManagement
      searchQuery={searchQuery}
      branchOptions={branches.map((branch) => branch.name)}
      roleOptions={roles.map((role) => role.name)}
    />
  );
};

const BranchManagementPage: React.FC = () => {
  const { branches, onAddBranch, searchQuery } = useOutletContext<AdminOutletContext>();

  return (
    <BranchManagement
      searchQuery={searchQuery}
      branches={branches}
      onAddBranch={onAddBranch}
    />
  );
};

const RoleManagementPage: React.FC = () => {
  const { roles, onAddRole, searchQuery } = useOutletContext<AdminOutletContext>();

  return (
    <RoleManagement
      searchQuery={searchQuery}
      roles={roles}
      onAddRole={onAddRole}
    />
  );
};

const ComingSoonPage: React.FC<{ page: PlaceholderRoutePage }> = ({
  page,
}) => (
  <ComingSoon
    title={PAGE_TITLES[page]}
    icon={PAGE_ICONS[page]}
  />
);

const routeElements: Record<NavPage, React.ReactElement> = {
  dashboard: <DashboardPage />,
  pos: <PosSystem />,
  posManagement: <PosManagement />,
  users: <UserManagementPage />,
  branches: <BranchManagementPage />,
  roles: <RoleManagementPage />,
  profile: <ProfileSection />,
  analytics: <AnalyticsPage />,
  settings: <SettingsPage />,
  permissions: <ComingSoonPage page="permissions" />,
  audit: <ComingSoonPage page="audit" />,
  hr: <HRManagement />,
};

const AppRoutes: React.FC = () => {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route index element={<SplashScreen />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<App />}>
          {APP_ROUTES.map(({ page, routePath }) => (
            <Route key={page} path={routePath} element={routeElements[page]} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to={PAGE_PATHS[DEFAULT_PAGE]} replace />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
