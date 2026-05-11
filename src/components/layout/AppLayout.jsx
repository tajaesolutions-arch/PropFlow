import React from 'react';

import { AuditSafetyNotice } from '../AuditSafetyNotice.jsx';
import { BillingSafetyNotice } from '../BillingSafetyNotice.jsx';
import { CalendarScheduleSafetyNotice } from '../CalendarScheduleSafetyNotice.jsx';
import { EnvironmentSetupNotice } from '../EnvironmentSetupNotice.jsx';
import { InventorySafetyNotice } from '../InventorySafetyNotice.jsx';
import { OnboardingSetupNotice } from '../OnboardingSetupNotice.jsx';
import { OwnerAssignmentSafetyNotice } from '../OwnerAssignmentSafetyNotice.jsx';
import { ReportsExportNotice } from '../ReportsExportNotice.jsx';
import { SettingsAccountSafetyNotice } from '../SettingsAccountSafetyNotice.jsx';
import { TeamWorkspaceSafetyNotice } from '../TeamWorkspaceSafetyNotice.jsx';
import { UploadSafetyNotice } from '../UploadSafetyNotice.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { hasAnyRole } from '../../lib/auth.js';
import { billingAccessRoles, roles } from '../../data/constants.js';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

const sidebarStorageKey = 'propflow.sidebarCollapsed';
const setupNoticePaths = new Set(['/admin', '/settings', '/billing', '/notification-settings']);
const uploadNoticePaths = new Set(['/properties', '/cleaning', '/maintenance', '/reports', '/billing']);
const auditNoticePaths = new Set(['/admin', '/settings', '/notification-settings']);
const onboardingNoticePaths = new Set(['/dashboard', '/workspace-setup']);
const teamWorkspaceNoticePaths = new Set(['/team', '/settings', '/admin']);
const settingsAccountNoticePaths = new Set(['/account', '/settings', '/notification-settings']);
const inventoryNoticePaths = new Set(['/inventory']);
const ownerAssignmentNoticePaths = new Set(['/owner-dashboard', '/owners', '/reports']);
const calendarScheduleNoticePaths = new Set(['/calendar', '/dashboard', '/owner-dashboard', '/cleaner-dashboard', '/maintenance-dashboard']);
const ownerAssignmentNoticeRoles = [
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
  roles.OWNER,
];
const environmentSetupNoticeRoles = [
  roles.ADMIN,
  roles.OWNER_ADMIN,
  roles.PROPERTY_MANAGER,
  roles.HOST,
  roles.ACCOUNTANT,
];

function getInitialCollapsedState() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(sidebarStorageKey) === 'true';
}

function getCurrentPath() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function shouldShowEnvironmentSetupNotice(currentUser) {
  return hasAnyRole(currentUser, environmentSetupNoticeRoles) && setupNoticePaths.has(getCurrentPath());
}
function shouldShowReportsExportNotice() { return getCurrentPath() === '/reports'; }
function shouldShowBillingSafetyNotice() { return getCurrentPath() === '/billing'; }
function shouldShowUploadSafetyNotice() { const path = getCurrentPath(); return uploadNoticePaths.has(path) || path.startsWith('/properties/'); }
function shouldShowAuditSafetyNotice() { return auditNoticePaths.has(getCurrentPath()); }
function shouldShowOnboardingSetupNotice() { return onboardingNoticePaths.has(getCurrentPath()); }
function shouldShowTeamWorkspaceSafetyNotice() { return teamWorkspaceNoticePaths.has(getCurrentPath()); }
function shouldShowSettingsAccountSafetyNotice() { return settingsAccountNoticePaths.has(getCurrentPath()); }
function shouldShowCalendarScheduleSafetyNotice() { return calendarScheduleNoticePaths.has(getCurrentPath()); }
function shouldShowInventorySafetyNotice() { return inventoryNoticePaths.has(getCurrentPath()); }
function shouldShowOwnerAssignmentSafetyNotice(currentUser) {
  if (!hasAnyRole(currentUser, ownerAssignmentNoticeRoles)) return false;

  const path = getCurrentPath();
  return ownerAssignmentNoticePaths.has(path) || path.startsWith('/properties/');
}

export function AppLayout({ title = 'Dashboard', subtitle = 'Workspace-scoped operational command center', children }) {
  const [collapsed, setCollapsed] = React.useState(getInitialCollapsedState);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { error, currentUser, data } = useApp();
  const showEnvironmentSetupNotice = shouldShowEnvironmentSetupNotice(currentUser);
  const showReportsExportNotice = shouldShowReportsExportNotice();
  const showBillingSafetyNotice = shouldShowBillingSafetyNotice();
  const showUploadSafetyNotice = shouldShowUploadSafetyNotice();
  const showAuditSafetyNotice = shouldShowAuditSafetyNotice();
  const showOnboardingSetupNotice = shouldShowOnboardingSetupNotice();
  const showTeamWorkspaceSafetyNotice = shouldShowTeamWorkspaceSafetyNotice();
  const showSettingsAccountSafetyNotice = shouldShowSettingsAccountSafetyNotice();
  const showCalendarScheduleSafetyNotice = shouldShowCalendarScheduleSafetyNotice();
  const showInventorySafetyNotice = shouldShowInventorySafetyNotice();
  const showOwnerAssignmentSafetyNotice = shouldShowOwnerAssignmentSafetyNotice(currentUser);
  const billingAccessState = data?.billingAccessState;
  const canSeeBillingWarning = hasAnyRole(currentUser, billingAccessRoles) && getCurrentPath() !== '/dashboard';

  React.useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  React.useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  React.useEffect(() => {
    const closeOnRouteChange = () => setMobileOpen(false);
    window.addEventListener('popstate', closeOnRouteChange);
    return () => window.removeEventListener('popstate', closeOnRouteChange);
  }, []);

  React.useEffect(() => {
    const closeMobileNavOnDesktop = () => {
      if (window.innerWidth > 760) setMobileOpen(false);
    };
    window.addEventListener('resize', closeMobileNavOnDesktop);
    return () => window.removeEventListener('resize', closeMobileNavOnDesktop);
  }, []);

  React.useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileOpen]);

  return (
    <div className={`app-shell ${mobileOpen ? 'nav-open' : ''}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {mobileOpen && <button type="button" className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" data-skip-create-action="true" />}
      <main className={`main ${collapsed ? 'main-expanded' : ''}`}>
        <TopBar title={title} subtitle={subtitle} setMobileOpen={setMobileOpen} />
        <div className="page-content">
          {error && <section className="workspace-load-warning" role="alert"><strong>Workspace data warning</strong><span>{error}</span></section>}
          {canSeeBillingWarning && billingAccessState?.warning && <section className="workspace-load-warning" role="alert"><strong>{billingAccessState.restricted ? 'Billing recovery mode' : 'Billing grace period'}</strong><span>{billingAccessState.restricted ? 'Workspace access may be limited until billing is resolved. Billing recovery remains available to owners and accountants.' : 'Payment needs attention before the grace period ends.'}</span></section>}
          {showEnvironmentSetupNotice && <EnvironmentSetupNotice compact />}
          {showOnboardingSetupNotice && <OnboardingSetupNotice />}
          {showCalendarScheduleSafetyNotice && <CalendarScheduleSafetyNotice />}
          {showInventorySafetyNotice && <InventorySafetyNotice />}
          {showOwnerAssignmentSafetyNotice && <OwnerAssignmentSafetyNotice />}
          {showSettingsAccountSafetyNotice && <SettingsAccountSafetyNotice />}
          {showTeamWorkspaceSafetyNotice && <TeamWorkspaceSafetyNotice />}
          {showAuditSafetyNotice && <AuditSafetyNotice />}
          {showUploadSafetyNotice && <UploadSafetyNotice />}
          {showBillingSafetyNotice && <BillingSafetyNotice />}
          {showReportsExportNotice && <ReportsExportNotice />}
          {children}
        </div>
      </main>
    </div>
  );
}
