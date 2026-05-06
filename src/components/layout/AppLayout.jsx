import React from 'react';
import { useApp } from '../../lib/AppContext.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

export function AppLayout({ title, children }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { error } = useApp();
  return <div className="app-shell"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><main className={`main ${collapsed ? 'main-expanded' : ''}`}><TopBar title={title} setMobileOpen={setMobileOpen} /><div className="page-content">{error && <section className="workspace-load-warning" role="alert"><strong>Workspace data warning</strong><span>{error}</span></section>}{children}</div></main></div>;
}
