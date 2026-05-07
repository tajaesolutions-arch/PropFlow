import React from 'react';
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  HelpCircle,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { navigate } from '../../routes/AppRouter.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { roles } from '../../data/constants.js';
import { resolvePrimaryRole } from '../../lib/auth.js';

const operationalNav = [
  ['/dashboard', 'Dashboard', LayoutDashboard],
  ['/properties', 'Properties', Building2],
  ['/bookings', 'Bookings', CalendarDays],
  ['/calendar', 'Calendar', CalendarDays],
  ['/cleaning', 'Cleaning', ClipboardCheck],
  ['/maintenance', 'Maintenance', Wrench],
  ['/owners', 'Owners', Home],
  ['/guests', 'Guests / CRM', Users],
  ['/reports', 'Reports', BarChart3],
  ['/inventory', 'Supplies / Inventory', Boxes],
  ['/team', 'Team', Users],
  ['/smart-tools', 'Smart Tools / AI', Sparkles],
  ['/notifications', 'Notifications', Bell],
  ['/settings', 'Settings', Settings],
  ['/billing', 'Billing', CreditCard],
  ['/help', 'Help / Support', HelpCircle],
];

const ownerNav = [
  ['/owner-dashboard', 'Owner Dashboard', Home],
  ['/properties', 'Assigned Properties', Building2],
  ['/reports', 'Reports', BarChart3],
  ['/maintenance', 'Maintenance Updates', Wrench],
  ['/account', 'Account', Settings],
];

const cleanerNav = [
  ['/cleaner-dashboard', 'Cleaner Dashboard', ClipboardCheck],
  ['/cleaning', 'Cleaning Tasks', ClipboardCheck],
  ['/maintenance', 'Report Issues', Wrench],
  ['/notifications', 'Notifications', Bell],
  ['/account', 'Account', Settings],
];

const maintenanceNav = [
  ['/maintenance-dashboard', 'Maintenance Dashboard', Wrench],
  ['/maintenance', 'Work Orders', Wrench],
  ['/notifications', 'Notifications', Bell],
  ['/account', 'Account', Settings],
];

const accountantNav = [
  ['/accountant-dashboard', 'Accountant Dashboard', BarChart3],
  ['/properties', 'Properties', Building2],
  ['/reports', 'Reports', BarChart3],
  ['/billing', 'Billing', CreditCard],
  ['/account', 'Account', Settings],
];

const adminNav = [
  ['/admin', 'Admin Dashboard', Shield],
  ['/billing', 'Billing', CreditCard],
  ['/notifications', 'Notifications', Bell],
  ['/account', 'Account', Settings],
];

const roleNav = {
  [roles.ADMIN]: adminNav,
  [roles.OWNER]: ownerNav,
  [roles.CLEANER]: cleanerNav,
  [roles.MAINTENANCE]: maintenanceNav,
  [roles.ACCOUNTANT]: accountantNav,
};

function getSidebarNav(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);

  if ([roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST].includes(primaryRole)) {
    return operationalNav;
  }

  return roleNav[primaryRole] || operationalNav;
}

function isActivePath(currentPath, href) {
  if (href === '/dashboard') {
    return currentPath === '/dashboard';
  }

  if (href === '/maintenance') {
    return currentPath === '/maintenance' || currentPath.startsWith('/maintenance/');
  }

  if (href === '/properties') {
    return currentPath === '/properties' || currentPath.startsWith('/properties/');
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar({ collapsed = false, setCollapsed, mobileOpen = false, setMobileOpen }) {
  const { currentUser } = useApp();
  const path = window.location.pathname;
  const nav = getSidebarNav(currentUser);

  const closeMobileMenu = () => {
    if (typeof setMobileOpen === 'function') {
      setMobileOpen(false);
    }
  };

  const toggleCollapsed = () => {
    if (typeof setCollapsed === 'function') {
      setCollapsed(!collapsed);
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <button
          type="button"
          className="brand-button"
          onClick={() => {
            navigate('/dashboard');
            closeMobileMenu();
          }}
          aria-label="Go to dashboard"
        >
          <div className="brand-mark">PF</div>
          <span>PropFlow</span>
        </button>

        <button
          type="button"
          className="mobile-close"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav aria-label="Main navigation">
        {nav.map(([href, label, Icon]) => (
          <button
            key={href}
            type="button"
            className={isActivePath(path, href) ? 'active' : ''}
            onClick={() => {
              navigate(href);
              closeMobileMenu();
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <button type="button" className="collapse-btn" onClick={toggleCollapsed}>
        <Menu size={18} />
        <span>{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </aside>
  );
}
