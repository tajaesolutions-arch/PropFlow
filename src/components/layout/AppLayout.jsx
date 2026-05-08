import React from 'react';

import { BillingSafetyNotice } from '../BillingSafetyNotice.jsx';
import { EnvironmentSetupNotice } from '../EnvironmentSetupNotice.jsx';
import { ReportsExportNotice } from '../ReportsExportNotice.jsx';
import { UploadSafetyNotice } from '../UploadSafetyNotice.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

const sidebarStorageKey = 'propflow.sidebarCollapsed';
const setupNoticePaths = new Set(['/admin', '/settings', '/billing', '/notifications', '/notification-settings']);
const uploadNoticePaths = new Set(['/properties', '/cleaning', '/maintenance', '/reports', '/billing']);

function getInitialCollapsedState() {
  if (typeof window === 'undefined') return false;

  return window.localStorage.getItem(sidebarStorageKey) === 'true';
}

function getCurrentPath() {
  if (typeof window === 'undefined') return '/';

  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function shouldShowEnvironmentSetupNotice() {
  return setupNoticePaths.has(getCurrentPath());
}

function shouldShowReportsExportNotice() {
  return getCurrentPath() === '/reports';
}

function shouldShowBillingSafetyNotice() {
  return getCurrentPath() === '/billing';
}

function shouldShowUploadSafetyNotice() {
  const path = getCurrentPath();

  return uploadNoticePaths.has(path) || path.startsWith('/properties/');
}

export function AppLayout({
  title = 'Dashboard',
  subtitle = 'Workspace-scoped operational command center',
  children,
}) {
  const [collapsed, setCollapsed] = React.useState(getInitialCollapsedState);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { error } = useApp();
  const showEnvironmentSetupNotice = shouldShowEnvironmentSetupNotice();
  const showReportsExportNotice = shouldShowReportsExportNotice();
  const showBillingSafetyNotice = shouldShowBillingSafetyNotice();
  const showUploadSafetyNotice = shouldShowUploadSafetyNotice();

  React.useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  React.useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  React.useEffect(() => {
    const closeOnRouteChange = () => {
      setMobileOpen(false);
    };

    window.addEventListener('popstate', closeOnRouteChange);

    return () => {
      window.removeEventListener('popstate', closeOnRouteChange);
    };
  }, []);

  React.useEffect(() => {
    const closeMobileNavOnDesktop = () => {
      if (window.innerWidth > 760) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', closeMobileNavOnDesktop);

    return () => {
      window.removeEventListener('resize', closeMobileNavOnDesktop);
    };
  }, []);

  React.useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className={`app-shell ${mobileOpen ? 'nav-open' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          data-skip-create-action="true"
        />
      )}

      <main className={`main ${collapsed ? 'main-expanded' : ''}`}>
        <TopBar title={title} subtitle={subtitle} setMobileOpen={setMobileOpen} />

        <div className="page-content">
          {error && (
            <section className="workspace-load-warning" role="alert">
              <strong>Workspace data warning</strong>
              <span>{error}</span>
            </section>
          )}

          {showEnvironmentSetupNotice && <EnvironmentSetupNotice compact />}
          {showUploadSafetyNotice && <UploadSafetyNotice />}
          {showBillingSafetyNotice && <BillingSafetyNotice />}
          {showReportsExportNotice && <ReportsExportNotice />}

          {children}
        </div>
      </main>
    </div>
  );
}
