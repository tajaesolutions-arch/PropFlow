import React from 'react';
import { Building2, CalendarDays, ClipboardCheck, LayoutDashboard, Wrench, Users, Bell, Settings, BarChart3, Home, Shield, Menu, X, CreditCard, HelpCircle, Boxes, Sparkles } from 'lucide-react';
import { navigate } from '../../routes/AppRouter.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { roles } from '../../data/constants.js';
const operationalNav = [
  ['/dashboard', 'Dashboard', LayoutDashboard], ['/properties', 'Properties', Building2], ['/bookings', 'Bookings', CalendarDays], ['/cleaning', 'Cleaning', ClipboardCheck], ['/maintenance', 'Maintenance', Wrench], ['/owners', 'Owners', Home], ['/guests', 'Guests / CRM', Users], ['/reports', 'Reports', BarChart3], ['/inventory', 'Supplies / Inventory', Boxes], ['/team', 'Team', Users], ['/smart-tools', 'Smart Tools / AI', Sparkles], ['/notifications', 'Notifications', Bell], ['/settings', 'Settings', Settings], ['/billing', 'Billing', CreditCard], ['/help', 'Help / Support', HelpCircle]
];
const roleNav = { [roles.OWNER]: [['/owner-dashboard','Owner Dashboard',Home],['/properties','Properties',Building2],['/maintenance','Maintenance',Wrench],['/account','Account',Settings]], [roles.CLEANER]: [['/cleaner-dashboard','Cleaner Dashboard',ClipboardCheck],['/cleaning','Cleaning',ClipboardCheck],['/maintenance','Report Issues',Wrench],['/account','Account',Settings]], [roles.MAINTENANCE]: [['/maintenance-dashboard','Maintenance Dashboard',Wrench],['/maintenance','Work Orders',Wrench],['/account','Account',Settings]], [roles.ACCOUNTANT]: [['/accountant-dashboard','Accountant Dashboard',BarChart3],['/properties','Properties',Building2],['/reports','Reports',BarChart3],['/account','Account',Settings]], [roles.ADMIN]: [['/admin','Admin',Shield],['/account','Account',Settings]] };
export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { currentUser } = useApp();
  const path = window.location.pathname;
  const primary = currentUser?.roles?.[0];
  const nav = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST].includes(primary) ? operationalNav : (roleNav[primary] || operationalNav);
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}><div className="brand"><div className="brand-mark">PF</div><span>PropFlow</span><button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={18} /></button></div><nav>{nav.map(([href, label, Icon]) => <button key={href} className={path.startsWith(href) ? 'active' : ''} onClick={() => { navigate(href); setMobileOpen(false); }}><Icon size={18} /><span>{label}</span></button>)}</nav><button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}><Menu size={18} /><span>{collapsed ? 'Expand' : 'Collapse'}</span></button></aside>;
}
