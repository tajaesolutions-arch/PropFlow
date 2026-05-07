import React from 'react';
import { getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { roles } from '../data/constants.js';

function lazyPage(importer, exportName) {
  return React.lazy(() =>
    importer().then((module) => ({
      default: module[exportName],
    })),
  );
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
const AccountSettingsPage = lazyPage(() => import('../pages/AccountSettingsPage.jsx'), 'AccountSettingsPage');
const AdminDashboardPage = lazyPage(() => import('../pages/AdminDashboardPage.jsx'), 'AdminDashboardPage');
const OwnerDashboardPage = lazyPage(() => import('../pages/OwnerDashboardPage.jsx'), 'OwnerDashboardPage');
const CleanerDashboardPage = lazyPage(() => import('../pages/CleanerDashboardPage.jsx'), 'CleanerDashboardPage');
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

const dashboardAccess = {
  '/dashboard': [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  '/owner-dashboard': [roles.OWNER],
  '/cleaner-dashboard': [roles.CLEANER],
  '/maintenance-dashboard': [roles.MAINTENANCE],
  '/accountant-dashboard': [roles.ACCOUNTANT],
};

const protectedRoutes = {
  '/workspace-setup': { Page: JoinWorkspacePage },
  '/dashboard': { Page: DashboardPage },
  '/properties': { Page: PropertiesPage },
  '/bookings': { Page: BookingsPage },
  '/calendar': { Page: CalendarPage },
  '/cleaning': { Page: CleaningPage },
  '/maintenance': { Page: MaintenancePage },
  '/owners': { Page: OwnersPage },
  '/guests': { Page: GuestsPage },
  '/reports': { Page: ReportsPage },
  '/notifications': { Page: NotificationsPage },
  '/notification-settings': { Page: NotificationSettingsPage },
  '/settings': { Page: SettingsPage },
  '/account': { Page: AccountSettingsPage },
  '/admin': { Page: AdminDashboardPage },
  '/owner-dashboard': { Page: OwnerDashboardPage },
  '/cleaner-dashboard': { Page: CleanerDashboardPage },
  '/maintenance-dashboard': { Page: MaintenanceDashboardPage },
  '/accountant-dashboard': { Page: AccountantDashboardPage },
  '/inventory': { Page: InventoryPage },
  '/team': { Page: SettingsPage },
  '/billing': { Page: BillingPage },
  '/smart-tools': {
    Page: ComingSoonPage,
    props: { title: 'Smart Tools / AI Tools' },
  },
  '/help': {
    Page: ComingSoonPage,
    props: { title: 'Help / Support' },
  },
};

export const routeAccess = {
  admin: [roles.ADMIN],
  operations: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  owner: [roles.OWNER, roles.OWNER_ADMIN],
  cleaner: [roles.CLEANER],
  maintenance: [roles.MAINTENANCE],
  accountant: [roles.ACCOUNTANT],
};

export function navigate(path) {
  if (!path || window.location.pathname === path) return;

  window.history.pushState({}, '', path);

  if (typeof PopStateEvent === 'function') {
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.dispatchEvent(new Event('popstate'));
  }
}

function LoadingScreen() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Loading PropFlow…</h1>
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
          A page failed while loading. This screen is shown instead of a blank white page so the
          error can be fixed.
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

function renderRoute(Page, props = {}) {
  return (
    <RouteErrorBoundary>
      <React.Suspense fallback={<LoadingScreen />}>
        <Page {...props} />
      </React.Suspense>
    </RouteErrorBoundary>
  );
}

function NotFoundPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or is not available for your role.</p>
        <button className="primary" type="button" onClick={() => navigate('/dashboard')}>
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
  return path === '/workspace-setup' || path === '/join' || path === '/account' || path === '/suspended';
}

function getPropertyIdFromPath(path) {
  if (!path.startsWith('/properties/')) return null;

  const propertyId = path.split('/').filter(Boolean)[1];
  return propertyId || null;
}

export function AppRouter() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const { authLoading, currentUser, currentWorkspace } = useApp();

  React.useEffect(() => {
    window.addEventListener('popstate', forceRender);
    return () => window.removeEventListener('popstate', forceRender);
  }, []);

  const path = window.location.pathname;
  const propertyId = getPropertyIdFromPath(path);

  if (authLoading) return <LoadingScreen />;

  if (path === '/login/redirect') {
    navigate(getPostLoginPath(currentUser));
    return null;
  }

  if (isPublicPath(path)) {
    if (currentUser && (path === '/login' || path === '/signup')) {
      navigate(getPostLoginPath(currentUser));
      return null;
    }

    if (currentUser && currentWorkspace && path === '/join') {
      navigate(getPostLoginPath(currentUser));
      return null;
    }

    const route = getPublicRoute(path);
    return renderRoute(route.Page, route.props);
  }

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (currentUser.status === 'suspended' && path !== '/suspended' && path !== '/account') {
    navigate('/suspended');
    return null;
  }

  const isPropFlowAdmin = currentUser.roles?.includes(roles.ADMIN);

  if (!currentWorkspace && !isPropFlowAdmin && !shouldBypassWorkspaceRequirement(path)) {
    navigate('/workspace-setup');
    return null;
  }

  if (currentWorkspace && isWorkspaceSetupPath(path)) {
    navigate(getPostLoginPath(currentUser));
    return null;
  }

  if (path === '/admin' && !isPropFlowAdmin) {
    return renderRoute(SuspendedPage, { variant: 'denied' });
  }

  if (dashboardAccess[path] && !hasAnyRole(currentUser, dashboardAccess[path])) {
    navigate(getPostLoginPath(currentUser));
    return null;
  }

  if (propertyId) {
    return (
      <RoleGuard
        allowed={[
          roles.OWNER_ADMIN,
          roles.PROPERTY_MANAGER,
          roles.HOST,
          roles.OWNER,
          roles.ACCOUNTANT,
          roles.CLEANER,
          roles.MAINTENANCE,
        ]}
      >
        {renderRoute(PropertyDetailPage, { propertyId })}
      </RoleGuard>
    );
  }

  const route = protectedRoutes[path];

  if (!route) {
    return <NotFoundPage />;
  }

  return renderRoute(route.Page, route.props);
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
