import React from 'react';

import { getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

function lazyPage(importer, exportName) {
  return React.lazy(async () => {
    const module = await importer();
    const Page = module[exportName];

    if (!Page) {
      throw new Error(
        `Page export "${exportName}" was not found. Check that the page file exports "${exportName}".`,
      );
    }

    return { default: Page };
  });
}

const LandingPage = lazyPage(() => import('../pages/LandingPage.jsx'), 'LandingPage');
const PricingPage = lazyPage(() => import('../pages/PricingPage.jsx'), 'PricingPage');
const LoginPage = lazyPage(() => import('../pages/LoginPage.jsx'), 'LoginPage');
const SignupPage = lazyPage(() => import('../pages/SignupPage.jsx'), 'SignupPage');
const JoinWorkspacePage = lazyPage(() => import('../pages/JoinWorkspacePage.jsx'), 'JoinWorkspacePage');
const SuspendedPage = lazyPage(() => import('../pages/SuspendedPage.jsx'), 'SuspendedPage');
const DashboardPage = lazyPage(() => import('../pages/DashboardPage.jsx'), 'DashboardPage');
const PropertiesPage = lazyPage(() => import('../pages/PropertiesPage.jsx'), 'PropertiesPage');
const PropertyDetailPage = lazyPage(() => import('../pages/PropertyDetailPage.jsx'), 'PropertyDetailPage');
const BookingsPage = lazyPage(() => import('../pages/BookingsPage.jsx'), 'BookingsPage');
const CalendarPage = lazyPage(() => import('../pages/CalendarPage.jsx'), 'CalendarPage');
const CleaningPage = lazyPage(() => import('../pages/CleaningPage.jsx'), 'CleaningPage');
const MaintenancePage = lazyPage(() => import('../pages/MaintenancePage.jsx'), 'MaintenancePage');
const OwnersPage = lazyPage(() => import('../pages/OwnersPage.jsx'), 'OwnersPage');
const GuestsPage = lazyPage(() => import('../pages/GuestsPage.jsx'), 'GuestsPage');
const ReportsPage = lazyPage(() => import('../pages/ReportsPage.jsx'), 'ReportsPage');
const NotificationsPage = lazyPage(() => import('../pages/NotificationsPage.jsx'), 'NotificationsPage');
const NotificationSettingsPage = lazyPage(
  () => import('../pages/NotificationSettingsPage.jsx'),
  'NotificationSettingsPage',
);
const InventoryPage = lazyPage(() => import('../pages/InventoryPage.jsx'), 'InventoryPage');
const SettingsPage = lazyPage(() => import('../pages/SettingsPage.jsx'), 'SettingsPage');
const AccountSettingsPage = lazyPage(
  () => import('../pages/AccountSettingsPage.jsx'),
  'AccountSettingsPage',
);
const AdminDashboardPage = lazyPage(
  () => import('../pages/AdminDashboardPage.jsx'),
  'AdminDashboardPage',
);
const OwnerDashboardPage = lazyPage(
  () => import('../pages/OwnerDashboardPage.jsx'),
  'OwnerDashboardPage',
);
const CleanerDashboardPage = lazyPage(
  () => import('../pages/CleanerDashboardPage.jsx'),
  'CleanerDashboardPage',
);
const MaintenanceDashboardPage = lazyPage(
  () => import('../pages/MaintenanceDashboardPage.jsx'),
  'MaintenanceDashboardPage',
);
const AccountantDashboardPage = lazyPage(
  () => import('../pages/AccountantDashboardPage.jsx'),
  'AccountantDashboardPage',
);
const BillingPage = lazyPage(() => import('../pages/BillingPage.jsx'), 'BillingPage');
const ComingSoonPage = lazyPage(() => import('../pages/ComingSoonPage.jsx'), 'ComingSoonPage');
const PublicBookingPage = lazyPage(() => import('../pages/PublicBookingPage.jsx'), 'PublicBookingPage');

const publicRoutes = {
  '/': { Page: LandingPage },
  '/pricing': { Page: PricingPage },
  '/login': { Page: LoginPage },
  '/signup': { Page: SignupPage },
  '/join': { Page: JoinWorkspacePage },
  '/suspended': { Page: SuspendedPage },
  '/book': { Page: PublicBookingPage },
};

const operationalRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

const allWorkspaceRoles = [
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
  roles.OWNER,
  roles.CLEANER,
  roles.MAINTENANCE,
];

const ownerVisibleRoles = [...operationalRoles, roles.OWNER, roles.ACCOUNTANT];
const staffOperationsRoles = [...operationalRoles, roles.CLEANER, roles.MAINTENANCE];
const financeRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];

const dashboardAccess = {
  '/dashboard': operationalRoles,
  '/owner-dashboard': [roles.OWNER],
  '/cleaner-dashboard': [roles.CLEANER],
  '/maintenance-dashboard': [roles.MAINTENANCE],
  '/accountant-dashboard': [roles.ACCOUNTANT],
};

const protectedRoutes = {
  '/workspace-setup': { Page: JoinWorkspacePage },
  '/dashboard': { Page: DashboardPage, access: operationalRoles },
  '/properties': { Page: PropertiesPage, access: ownerVisibleRoles },
  '/bookings': {
    Page: BookingsPage,
    access: [...operationalRoles, roles.OWNER, roles.ACCOUNTANT],
  },
  '/calendar': { Page: CalendarPage, access: allWorkspaceRoles },
  '/cleaning': { Page: CleaningPage, access: [...operationalRoles, roles.CLEANER] },
  '/maintenance': { Page: MaintenancePage, access: staffOperationsRoles },
  '/owners': { Page: OwnersPage, access: financeRoles },
  '/guests': { Page: GuestsPage, access: operationalRoles },
  '/reports': {
    Page: ReportsPage,
    access: [...operationalRoles, roles.OWNER, roles.ACCOUNTANT],
  },
  '/notifications': {
    Page: NotificationsPage,
    access: [roles.ADMIN, ...allWorkspaceRoles],
  },
  '/notification-settings': {
    Page: NotificationSettingsPage,
    access: [roles.ADMIN, ...operationalRoles],
  },
  '/settings': { Page: SettingsPage, access: operationalRoles },
  '/account': { Page: AccountSettingsPage },
  '/admin': { Page: AdminDashboardPage, access: [roles.ADMIN] },
  '/owner-dashboard': { Page: OwnerDashboardPage, access: [roles.OWNER] },
  '/cleaner-dashboard': { Page: CleanerDashboardPage, access: [roles.CLEANER] },
  '/maintenance-dashboard': { Page: MaintenanceDashboardPage, access: [roles.MAINTENANCE] },
  '/accountant-dashboard': { Page: AccountantDashboardPage, access: [roles.ACCOUNTANT] },
  '/inventory': {
    Page: InventoryPage,
    access: [...operationalRoles, roles.ACCOUNTANT, roles.CLEANER],
  },
  '/team': { Page: SettingsPage, access: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER] },
  '/billing': { Page: BillingPage, access: [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT] },
  '/smart-tools': {
    Page: ComingSoonPage,
    props: { title: 'Smart Tools / AI Tools' },
    access: operationalRoles,
  },
  '/help': {
    Page: ComingSoonPage,
    props: { title: 'Help / Support' },
    access: [roles.ADMIN, ...allWorkspaceRoles],
  },
};

export const routeAccess = {
  admin: [roles.ADMIN],
  operations: operationalRoles,
  owner: [roles.OWNER, roles.OWNER_ADMIN],
  cleaner: [roles.CLEANER],
  maintenance: [roles.MAINTENANCE],
  accountant: [roles.ACCOUNTANT],
};

function normalizePath(pathname) {
  if (!pathname) return '/';

  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  return cleanPath || '/';
}

export function navigate(path) {
  const nextPath = normalizePath(path);
  const currentPath = normalizePath(window.location.pathname);

  if (!nextPath || currentPath === nextPath) return;

  window.history.pushState({}, '', nextPath);

  if (typeof PopStateEvent === 'function') {
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.dispatchEvent(new Event('popstate'));
  }
}

function RedirectTo({ to }) {
  React.useEffect(() => {
    navigate(to);
  }, [to]);

  return <LoadingScreen />;
}

function LoadingScreen() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">PropFlow</p>
        <h1>Loading PropFlow...</h1>
        <p>Checking your secure session and workspace access.</p>
      </div>
    </div>
  );
}

function RuntimeErrorScreen({ error }) {
  return (
    <div className="auth-page">
      <div className="auth-card wide">
        <p className="eyebrow">Runtime error</p>
        <h1>PropFlow could not load this screen</h1>
        <p>
          A page failed while loading. This fallback prevents a blank white page and shows the
          actual error so the file can be fixed.
        </p>

        <div className="helper error-helper">
          {error?.message || String(error || 'Unknown runtime error')}
        </div>

        <div className="action-row">
          <button type="button" className="primary" onClick={() => navigate('/')}>
            Go to homepage
          </button>

          <button type="button" onClick={() => navigate('/login')}>
            Go to login
          </button>
        </div>
      </div>
    </div>
  );
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('[PropFlow] Route render failed', error, info);
  }

  render() {
    if (this.state.error) {
      return <RuntimeErrorScreen error={this.state.error} />;
    }

    return this.props.children;
  }
}

function renderRoute(Page, props = {}, resetKey = window.location.pathname) {
  return (
    <RouteErrorBoundary resetKey={resetKey}>
      <React.Suspense fallback={<LoadingScreen />}>
        <Page {...props} />
      </React.Suspense>
    </RouteErrorBoundary>
  );
}

function NotFoundPage({ currentUser }) {
  const fallbackPath = currentUser ? getPostLoginPath(currentUser) : '/';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or is not available for your role.</p>

        <button className="primary" type="button" onClick={() => navigate(fallbackPath)}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function isPublicPath(path) {
  return Boolean(publicRoutes[path]) || path.startsWith('/book/');
}

function getPublicRoute(path) {
  if (path.startsWith('/book/')) return { Page: PublicBookingPage };
  return publicRoutes[path];
}

function isWorkspaceSetupPath(path) {
  return path === '/workspace-setup' || path === '/join';
}

function shouldBypassWorkspaceRequirement(path) {
  return (
    path === '/workspace-setup' ||
    path === '/join' ||
    path === '/account' ||
    path === '/suspended'
  );
}

function getPropertyIdFromPath(path) {
  if (!path.startsWith('/properties/')) return null;

  const propertyId = path.split('/').filter(Boolean)[1];
  return propertyId ? decodeURIComponent(propertyId) : null;
}

function userCanAccessRoute(user, route) {
  if (!route?.access?.length) return true;
  return hasAnyRole(user, route.access);
}

function isPropFlowAdminUser(user) {
  return Boolean(user?.roles?.includes(roles.ADMIN));
}

export function AppRouter() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const { authLoading, currentUser, currentWorkspace } = useApp();

  React.useEffect(() => {
    window.addEventListener('popstate', forceRender);

    return () => {
      window.removeEventListener('popstate', forceRender);
    };
  }, []);

  const path = normalizePath(window.location.pathname);
  const propertyId = getPropertyIdFromPath(path);

  if (authLoading) return <LoadingScreen />;

  if (path === '/login/redirect') {
    return <RedirectTo to={getPostLoginPath(currentUser)} />;
  }

  if (isPublicPath(path)) {
    if (currentUser && (path === '/login' || path === '/signup')) {
      return <RedirectTo to={getPostLoginPath(currentUser)} />;
    }

    if (currentUser && currentWorkspace && path === '/join') {
      return <RedirectTo to={getPostLoginPath(currentUser)} />;
    }

    const route = getPublicRoute(path);
    return renderRoute(route.Page, route.props, path);
  }

  if (!currentUser) {
    return <RedirectTo to="/login" />;
  }

  if (currentUser.status === 'suspended' && path !== '/suspended' && path !== '/account') {
    return <RedirectTo to="/suspended" />;
  }

  const isPropFlowAdmin = isPropFlowAdminUser(currentUser);

  if (!currentWorkspace && !isPropFlowAdmin && !shouldBypassWorkspaceRequirement(path)) {
    return <RedirectTo to="/workspace-setup" />;
  }

  if (currentWorkspace && isWorkspaceSetupPath(path)) {
    return <RedirectTo to={getPostLoginPath(currentUser)} />;
  }

  if (path === '/admin' && !isPropFlowAdmin) {
    return renderRoute(SuspendedPage, { variant: 'denied' }, path);
  }

  if (dashboardAccess[path] && !hasAnyRole(currentUser, dashboardAccess[path])) {
    return <RedirectTo to={getPostLoginPath(currentUser)} />;
  }

  if (propertyId) {
    return (
      <RoleGuard allowed={allWorkspaceRoles}>
        {renderRoute(PropertyDetailPage, { propertyId }, path)}
      </RoleGuard>
    );
  }

  const route = protectedRoutes[path];

  if (!route) {
    return <NotFoundPage currentUser={currentUser} />;
  }

  if (!userCanAccessRoute(currentUser, route)) {
    return renderRoute(SuspendedPage, { variant: 'denied' }, path);
  }

  return renderRoute(route.Page, route.props, path);
}

export function RoleGuard({ allowed, children }) {
  const { currentUser } = useApp();

  if (currentUser?.status === 'suspended') {
    return renderRoute(SuspendedPage);
  }

  if (!hasAnyRole(currentUser, allowed)) {
    return renderRoute(SuspendedPage, { variant: 'denied' });
  }

  return children;
}
