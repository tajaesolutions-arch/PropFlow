import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { SearchBox } from '../SearchBox.jsx';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher.jsx';
import { AccountMenu } from '../AccountMenu.jsx';
import { navigate } from '../../routes/AppRouter.jsx';
export function TopBar({ title, setMobileOpen }) {
  return <header className="topbar"><div className="title-wrap"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div><h1>{title}</h1><p>Workspace-scoped operational command center</p></div></div><SearchBox /><select className="date-filter"><option>Last 30 days</option><option>This month</option><option>Quarter to date</option></select><WorkspaceSwitcher /><button className="icon-btn" onClick={() => navigate('/notifications')}><Bell size={18} /></button><AccountMenu /></header>;
}
