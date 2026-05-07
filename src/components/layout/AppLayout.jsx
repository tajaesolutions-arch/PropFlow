import React from 'react';

import { useApp } from '../../lib/AppContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

export function AppLayout({
  title = 'Dashboard',
  subtitle = 'Workspace-scoped operational command center',
  children,
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { error } = useApp();

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

          {children}
        </div>
      </main>
    </div>
  );
}
