import React from 'react';
import { getPostLoginPath } from '../lib/auth.js';
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
import { CleaningPage } from '../pages/CleaningPage.jsx';
import { MaintenancePage } from '../pages/MaintenancePage.jsx';
import { OwnersPage } from '../pages/OwnersPage.jsx';
import { GuestsPage } from '../pages/GuestsPage.jsx';
import { ReportsPage } from '../pages/ReportsPage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';
import { SettingsPage } from '../pages/SettingsPage.jsx';
import { AccountSettingsPage } from '../pages/AccountSettingsPage.jsx';
import { AdminDashboardPage } from '../pages/AdminDashboardPage.jsx';
import { OwnerDashboardPage } from '../pages/OwnerDashboardPage.jsx';
import { CleanerDashboardPage } from '../pages/CleanerDashboardPage.jsx';
import { MaintenanceDashboardPage } from '../pages/MaintenanceDashboardPage.jsx';

const routes = {
  '/': LandingPage,
  '/pricing': PricingPage,
  '/login': LoginPage,
  '/signup': SignupPage,
  '/join': JoinWorkspacePage,
  '/suspended': SuspendedPage,
  '/dashboard': DashboardPage,
  '/properties': PropertiesPage,
  '/bookings': BookingsPage,
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
};

export function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function AppRouter() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const { currentUser } = useApp();
  React.useEffect(() => {
    window.addEventListener('popstate', forceRender);
    return () => window.removeEventListener('popstate', forceRender);
  }, []);

  const path = window.location.pathname;
  if (path === '/login/redirect') {
    navigate(getPostLoginPath(currentUser));
    return null;
  }
  if (path.startsWith('/properties/')) return <PropertyDetailPage propertyId={path.split('/').pop()} />;
  const Page = routes[path] || LandingPage;
  return <Page />;
}

export function RoleGuard({ allowed, children }) {
  const { currentUser } = useApp();
  const hasRole = currentUser?.roles?.some((role) => allowed.includes(role));
  if (currentUser?.status === 'suspended') return <SuspendedPage />;
  if (!hasRole) return <SuspendedPage variant="denied" />;
  return children;
}

export const routeAccess = {
  admin: [roles.ADMIN],
  operations: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  owner: [roles.OWNER, roles.OWNER_ADMIN],
  cleaner: [roles.CLEANER],
  maintenance: [roles.MAINTENANCE],
};
