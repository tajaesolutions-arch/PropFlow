import React from 'react';
import { Building2, CalendarDays, ClipboardCheck, LayoutDashboard, Wrench, Users, Bell, Settings, BarChart3, Home, UserRound, Shield, Menu, X } from 'lucide-react';
import { navigate } from '../../routes/AppRouter.jsx';
const nav = [
  ['/dashboard', 'Dashboard', LayoutDashboard], ['/properties', 'Properties', Building2], ['/bookings', 'Bookings', CalendarDays], ['/cleaning', 'Cleaning', ClipboardCheck], ['/maintenance', 'Maintenance', Wrench], ['/owners', 'Owners', Home], ['/guests', 'Guests / CRM', Users], ['/reports', 'Reports', BarChart3], ['/notifications', 'Notifications', Bell], ['/settings', 'Settings', Settings], ['/admin', 'Admin', Shield]
];
export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const path = window.location.pathname;
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}><div className="brand"><div className="brand-mark">PF</div><span>PropFlow</span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div><nav>{nav.map(([href, label, Icon]) => <button key={href} className={path.startsWith(href) ? 'active' : ''} onClick={() => { navigate(href); setMobileOpen(false); }}><Icon size={18} /><span>{label}</span></button>)}</nav><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}><Menu size={18} /><span>{collapsed ? 'Expand' : 'Collapse'}</span></button></aside>;
}
