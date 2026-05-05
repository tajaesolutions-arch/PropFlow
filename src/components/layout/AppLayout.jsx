import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
export function AppLayout({ title, children }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return <div className="app-shell"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><main className={`main ${collapsed ? 'main-expanded' : ''}`}><TopBar title={title} setMobileOpen={setMobileOpen} /><div className="page-content">{children}</div></main></div>;
}
