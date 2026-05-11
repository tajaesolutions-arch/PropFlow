import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Home,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

import { canAccessPlatformAdmin, getPostLoginPath, hasAnyRole } from '../lib/auth.js';
import { getWorkspaceBillingGate, useApp } from '../lib/AppContext.jsx';
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
const LeasesPage = lazyPage(() => import('../pages/LeasesPage.jsx'), 'LeasesPage');
const DirectBookingsPage = lazyPage(() => import('../pages/DirectBookingsPage.jsx'), 'DirectBookingsPage');
const CalendarImportsPage = lazyPage(() => import('../pages/CalendarImportsPage.jsx'), 'CalendarImportsPage');
const CalendarPage = lazyPage(() => import('../pages/CalendarPage.jsx'), 'CalendarPage');
const CleaningPage = lazyPage(() => import('../pages/CleaningPage.jsx'), 'CleaningPage');
const MaintenancePage = lazyPage(() => import('../pages/MaintenancePage.jsx'), 'MaintenancePage');
const OwnersPage = lazyPage(() => import('../pages/OwnersPage.jsx'), 'OwnersPage');
const GuestsPage = lazyPage(() => import('../pages/GuestsPage.jsx'), 'GuestsPage');
const ReportsPage = lazyPage(() => import('../pages/ReportsPage.jsx'), 'ReportsPage');
const ExpensesPage = lazyPage(() => import('../pages/ExpensesPage.jsx'), 'ExpensesPage');
const FilesPage = lazyPage(() => import('../pages/FilesPage.jsx'), 'FilesPage');
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
const PublicDirectBookingPage = lazyPage(() => import('../pages/PublicDirectBookingPage.jsx'), 'PublicDirectBookingPage');

const publicRoutes = {
  '/': { Page: LandingPage },
  '/pricing': { Page: PricingPage },
  '/login': { Page: LoginPage },
  '/signup': { Page: SignupPage },
  '/join': { Page: JoinWorkspacePage },
  '/suspended': { Page: SuspendedPage },
  '/book': { Page: PublicDirectBookingPage },
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
const propertyDetailRoles = ownerVisibleRoles;
const bookingPageRoles = [...operationalRoles, roles.ACCOUNTANT];
const leasePageRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const maintenancePageRoles = operationalRoles;
const financeRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const filesPageRoles = [...operationalRoles, roles.ACCOUNTANT, roles.OWNER];
const inventoryPageRoles = financeRoles;
const calendarManagerRoles = operationalRoles;
const directBookingManagerRoles = operationalRoles;
const calendarImportManagerRoles = operationalRoles;

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
    access: bookingPageRoles,
  },
  '/leases': { Page: LeasesPage, access: leasePageRoles },
  '/direct-bookings': { Page: DirectBookingsPage, access: directBookingManagerRoles },
  '/calendar-imports': { Page: CalendarImportsPage, access: calendarImportManagerRoles },
  '/calendar': { Page: CalendarPage, access: calendarManagerRoles },
  '/cleaning': { Page: CleaningPage, access: [...operationalRoles, roles.CLEANER] },
  '/maintenance': { Page: MaintenancePage, access: maintenancePageRoles },
  '/owners': { Page: OwnersPage, access: financeRoles },
  '/guests': { Page: GuestsPage, access: operationalRoles },
  '/reports': {
    Page: ReportsPage,
    access: [...operationalRoles, roles.OWNER, roles.ACCOUNTANT],
  },
  '/expenses': { Page: ExpensesPage, access: financeRoles },
  '/files': { Page: FilesPage, access: filesPageRoles },
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
    access: inventoryPageRoles,
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

  return <LoadingScreen title="Redirecting PropFlow..." subtitle="Sending you to the correct workspace screen." />;
}

function LoadingScreen({
  title = 'Loading PropFlow...',
  subtitle = 'Checking your secure session and workspace access.',
}) {
  return (
    <div className="auth-page router-state-page">
      <div className="auth-card router-state-card">
        <div className="router-state-icon">
          <Loader2 size={30} className="router-spinner" />
        </div>

        <p className="eyebrow">PropFlow</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>

        <div className="router-state-grid">
          <span>
            <ShieldCheck size={16} />
            Secure session
          </span>

          <span>
            <Building2 size={16} />
            Workspace access
          </span>

          <span>
            <Lock size={16} />
            Role permissions
          </span>
        </div>
      </div>
    </div>
  );
}

function RuntimeErrorScreen({ error }) {
  const errorMessage = error?.message || String(error || 'Unknown runtime error');

  return (
    <div className="auth-page router-state-page router-error-page">
      <div className="auth-card wide router-state-card">
        <div className="router-state-icon error">
          <AlertTriangle size={30} />
        </div>

        <p className="eyebrow">Runtime error</p>
        <h1>PropFlow could not load this screen</h1>
        <p>
          A page failed while loading. This fallback prevents a blank white page and shows the
          actual error so the file can be fixed.
        </p>

        <div className="helper error-helper">
          {errorMessage}
        </div>

        <div className="router-error-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            Reload page
          </button>

          <button type="button" onClick={() => navigate('/')}>
            <Home size={16} />
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
    <div className="auth-page router-state-page">
      <div className="auth-card wide router-state-card">
        <div className="router-state-icon warning">
          <ShieldAlert size={30} />
        </div>

        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>
          The page you are looking for does not exist, was moved, or is not available for your
          current role.
        </p>

        <div className="router-state-grid">
          <span>
            <ShieldCheck size={16} />
            Role checked
          </span>

          <span>
            <Building2 size={16} />
            Workspace checked
          </span>

          <span>
            <Lock size={16} />
            Access protected
          </span>
        </div>

        <div className="router-error-actions">
          <button className="primary" type="button" onClick={() => navigate(fallbackPath)}>
            <ArrowRight size={16} />
            Back to dashboard
          </button>

          <button type="button" onClick={() => navigate('/account')}>
            Account settings
          </button>
        </div>
      </div>
    </div>
  );
}


const billingRecoveryPaths = new Set(['/billing', '/account', '/settings', '/notification-settings', '/suspended']);

function BillingRestrictedScreen({ currentUser }) {
  const canRecover = hasAnyRole(currentUser, [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT]);
  return (
    <div className="auth-page router-state-page">
      <div className="auth-card wide router-state-card">
        <div className="router-state-icon warning"><ShieldAlert size={30} /></div>
        <p className="eyebrow">Billing recovery required</p>
        <h1>Workspace access is temporarily limited</h1>
        <p>
          This workspace is past its billing grace period. Operational staff access is limited until a Workspace Owner resolves billing.
        </p>
        <div className="router-error-actions">
          {canRecover && <button className="primary" type="button" onClick={() => navigate('/billing')}>Open billing recovery</button>}
          <button type="button" onClick={() => navigate('/account')}>Account settings</button>
        </div>
      </div>
    </div>
  );
}

function isPublicPath(path) {
  return Boolean(publicRoutes[path]) || path.startsWith('/book/');
}

function getPublicRoute(path) {
  if (path.startsWith('/book/')) return { Page: PublicDirectBookingPage };
  return publicRoutes[path];
}

function isWorkspaceSetupPath(path) {
  return path === '/workspace-setup' || path === '/join';
}

function shouldSkipWorkspaceRequirement(path) {
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
  return canAccessPlatformAdmin(user);
}

function RoleGuard({ allowed, children }) {
  const { currentUser } = useApp();

  if (!hasAnyRole(currentUser, allowed)) {
    return renderRoute(SuspendedPage, { variant: 'denied' });
  }

  return children;
}

export function AppRouter() {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const { authLoading, currentUser, currentWorkspace, data } = useApp();

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

    if (currentUser && currentWorkspace && path === '/join' && !window.location.search) {
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

  if (!currentWorkspace && !isPropFlowAdmin && !shouldSkipWorkspaceRequirement(path)) {
    return <RedirectTo to="/workspace-setup" />;
  }

  if (currentWorkspace && isWorkspaceSetupPath(path)) {
    return <RedirectTo to={getPostLoginPath(currentUser)} />;
  }

  if (path === '/admin' && !isPropFlowAdmin) {
    return renderRoute(SuspendedPage, { variant: 'denied' }, path);
  }

  const billingGate = getWorkspaceBillingGate(currentWorkspace, data?.subscription, currentUser);
  if (billingGate.restricted && !billingRecoveryPaths.has(path) && !isPropFlowAdmin) {
    if (billingGate.recoveryOnly && hasAnyRole(currentUser, [roles.OWNER_ADMIN, roles.ACCOUNTANT])) {
      return <RedirectTo to="/billing" />;
    }
    return <BillingRestrictedScreen currentUser={currentUser} />;
  }

  if (dashboardAccess[path] && !hasAnyRole(currentUser, dashboardAccess[path])) {
    return <RedirectTo to={getPostLoginPath(currentUser)} />;
  }

  if (propertyId) {
    return (
      <RoleGuard allowed={propertyDetailRoles}>
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
