import React from 'react';
import { getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';
import { LandingPage } from '../pages/LandingPage.jsx';
import { PricingPage } from '../pages/PricingPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SignupPage } from '../pages/SignupPage.jsx';
import { JoinWorkspacePage } from '../pages/JoinWorkspacePage.jsx';
import { SuspendedPage } from '../pages/SuspendedPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { PropertiesPage } from '../pages/PropertiesPage.jsx';
import { PropertyDetailPage } from '../pages/PropertyDetailPage.jsx';
import { BookingsPage } from '../pages/BookingsPage.jsx';
import { CalendarPage } from '../pages/CalendarPage.jsx';
import { CleaningPage } from '../pages/CleaningPage.jsx';
import { MaintenancePage } from '../pages/MaintenancePage.jsx';
import { OwnersPage } from '../pages/OwnersPage.jsx';
import { GuestsPage } from '../pages/GuestsPage.jsx';
import { ReportsPage } from '../pages/ReportsPage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';
import { InventoryPage } from '../pages/InventoryPage.jsx';
import { SettingsPage } from '../pages/SettingsPage.jsx';
import { AccountSettingsPage } from '../pages/AccountSettingsPage.jsx';
import { AdminDashboardPage } from '../pages/AdminDashboardPage.jsx';
import { OwnerDashboardPage } from '../pages/OwnerDashboardPage.jsx';
import { CleanerDashboardPage } from '../pages/CleanerDashboardPage.jsx';
import { MaintenanceDashboardPage } from '../pages/MaintenanceDashboardPage.jsx';
import { AccountantDashboardPage } from '../pages/AccountantDashboardPage.jsx';
import { BillingPage } from '../pages/BillingPage.jsx';
import { ComingSoonPage } from '../pages/ComingSoonPage.jsx';

const publicRoutes = { '/': LandingPage, '/pricing': PricingPage, '/login': LoginPage, '/signup': SignupPage };
const dashboardAccess = {
  '/dashboard': [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  '/owner-dashboard': [roles.OWNER],
  '/cleaner-dashboard': [roles.CLEANER],
  '/maintenance-dashboard': [roles.MAINTENANCE],
  '/accountant-dashboard': [roles.ACCOUNTANT],
};

const protectedRoutes = {
  '/workspace-setup': JoinWorkspacePage,
  '/join': JoinWorkspacePage,
  '/suspended': SuspendedPage,
  '/dashboard': DashboardPage,
  '/properties': PropertiesPage,
  '/bookings': BookingsPage,
  '/calendar': CalendarPage,
  '/cleaning': CleaningPage,
  '/maintenance': MaintenancePage,
  '/owners': OwnersPage,
  '/guests': GuestsPage,
  '/reports': ReportsPage,
  '/notifications': NotificationsPage,
  '/settings': SettingsPage,
  '/account': AccountSettingsPage,
  '/admin': AdminDashboardPage,
  '/owner-dashboard': OwnerDashboardPage,
  '/cleaner-dashboard': CleanerDashboardPage,
  '/maintenance-dashboard': MaintenanceDashboardPage,
  '/accountant-dashboard': AccountantDashboardPage,
  '/inventory': InventoryPage,
  '/team': SettingsPage,
  '/smart-tools': () => <ComingSoonPage title="Smart Tools / AI Tools" />,
  '/billing': BillingPage,
  '/help': () => <ComingSoonPage title="Help / Support" />,
};

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function LoadingScreen() { return <div className="auth-page"><div className="auth-card"><h1>Loading PropFlow…</h1><p>Checking Supabase Auth session and workspace membership.</p></div></div>; }

function isPublicPath(path) { return Boolean(publicRoutes[path]); }

export function AppRouter() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const { authLoading, currentUser, currentWorkspace } = useApp();
  React.useEffect(() => { window.addEventListener('popstate', forceRender); return () => window.removeEventListener('popstate', forceRender); }, []);

  const path = window.location.pathname;
  if (authLoading) return <LoadingScreen />;
  if (path === '/login/redirect') { navigate(getPostLoginPath(currentUser)); return null; }

  if (isPublicPath(path)) {
    if (currentUser && (path === '/login' || path === '/signup')) { navigate(getPostLoginPath(currentUser)); return null; }
    const Page = publicRoutes[path];
    return <Page />;
  }

  if (!currentUser) { navigate('/login'); return null; }
  if (currentUser.status === 'suspended' && path !== '/suspended' && path !== '/account') { navigate('/suspended'); return null; }
  if (!currentWorkspace && !currentUser.roles?.includes(roles.ADMIN) && path !== '/workspace-setup' && path !== '/join' && path !== '/account') { navigate('/workspace-setup'); return null; }
  if (currentWorkspace && (path === '/workspace-setup' || path === '/join')) { navigate(getPostLoginPath(currentUser)); return null; }
  if (path === '/admin' && !currentUser.roles?.includes(roles.ADMIN)) return <SuspendedPage variant="denied" />;
  if (dashboardAccess[path] && !hasAnyRole(currentUser, dashboardAccess[path])) { navigate(getPostLoginPath(currentUser)); return null; }
  if (path.startsWith('/properties/')) return <RoleGuard allowed={[roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.OWNER, roles.ACCOUNTANT, roles.CLEANER, roles.MAINTENANCE]}><PropertyDetailPage propertyId={path.split('/').pop()} /></RoleGuard>;
  const Page = protectedRoutes[path] || DashboardPage;
  return <Page />;
}

export function RoleGuard({ allowed, children }) {
  const { currentUser } = useApp();
  if (currentUser?.status === 'suspended') return <SuspendedPage />;
  if (!hasAnyRole(currentUser, allowed)) return <SuspendedPage variant="denied" />;
  return children;
}

export const routeAccess = {
  admin: [roles.ADMIN],
  operations: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  owner: [roles.OWNER, roles.OWNER_ADMIN],
  cleaner: [roles.CLEANER],
  maintenance: [roles.MAINTENANCE],
  accountant: [roles.ACCOUNTANT],
};