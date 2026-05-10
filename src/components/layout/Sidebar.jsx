import React from 'react';
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  HelpCircle,
  Home,
  FileText,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { navigate } from '../../routes/AppRouter.jsx';
import { useApp } from '../../lib/AppContext.jsx';
import { roles, roleLabels } from '../../data/constants.js';
import { getPostLoginPath, hasAnyRole, resolvePrimaryRole } from '../../lib/auth.js';

const operationalRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const billingAccessRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT];
const teamAccessRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];

const operationalNav = [
  {
    section: 'Operations',
    items: [
      ['/dashboard', 'Dashboard', LayoutDashboard],
      ['/properties', 'Properties', Building2],
      ['/bookings', 'Bookings', CalendarDays],
      ['/calendar', 'Calendar', CalendarDays],
      ['/cleaning', 'Cleaning', ClipboardCheck],
      ['/maintenance', 'Maintenance', Wrench],
    ],
  },
  {
    section: 'Workspace',
    items: [
      ['/owners', 'Owners', Home],
      ['/guests', 'Guests / CRM', Users],
      ['/expenses', 'Expenses', Receipt],
      ['/reports', 'Reports', BarChart3],
      ['/files', 'Files / Documents', FileText],
      ['/inventory', 'Supplies / Inventory', Boxes],
      ['/team', 'Team', Users, teamAccessRoles],
      ['/smart-tools', 'Smart Tools / AI', Sparkles],
    ],
  },
  {
    section: 'Account',
    items: [
      ['/notifications', 'Notifications', Bell],
      ['/settings', 'Settings', Settings],
      ['/billing', 'Billing', CreditCard, billingAccessRoles],
      ['/help', 'Help / Support', HelpCircle],
    ],
  },
];

const ownerNav = [
  {
    section: 'Owner Portal',
    items: [
      ['/owner-dashboard', 'Owner Dashboard', Home],
      ['/properties', 'Assigned Properties', Building2],
      ['/reports', 'Reports', BarChart3],
      ['/files', 'Files / Documents', FileText],
      ['/owner-dashboard?section=maintenance', 'Maintenance Updates', Wrench],
    ],
  },
  {
    section: 'Account',
    items: [
      ['/notifications', 'Notifications', Bell],
      ['/account', 'Account', Settings],
    ],
  },
];

const cleanerNav = [
  {
    section: 'Cleaner Portal',
    items: [
      ['/cleaner-dashboard', 'Cleaner Dashboard', ClipboardCheck],
      ['/cleaning', 'Cleaning Tasks', ClipboardCheck],
    ],
  },
  {
    section: 'Account',
    items: [
      ['/notifications', 'Notifications', Bell],
      ['/account', 'Account', Settings],
    ],
  },
];

const maintenanceNav = [
  {
    section: 'Maintenance Portal',
    items: [
      ['/maintenance-dashboard', 'Maintenance Dashboard', Wrench],
    ],
  },
  {
    section: 'Account',
    items: [
      ['/notifications', 'Notifications', Bell],
      ['/account', 'Account', Settings],
    ],
  },
];

const accountantNav = [
  {
    section: 'Finance',
    items: [
      ['/accountant-dashboard', 'Accountant Dashboard', BarChart3],
      ['/properties', 'Properties', Building2],
      ['/expenses', 'Expenses', Receipt],
      ['/reports', 'Reports', BarChart3],
      ['/files', 'Files / Documents', FileText],
      ['/inventory', 'Supplies / Inventory', Boxes],
      ['/billing', 'Billing', CreditCard],
    ],
  },
  {
    section: 'Account',
    items: [
      ['/notifications', 'Notifications', Bell],
      ['/account', 'Account', Settings],
    ],
  },
];

const adminNav = [
  {
    section: 'Platform',
    items: [
      ['/admin', 'Admin Dashboard', Shield],
      ['/billing', 'Billing', CreditCard],
      ['/notifications', 'Notifications', Bell],
    ],
  },
  {
    section: 'Account',
    items: [['/account', 'Account', Settings]],
  },
];

const roleNav = {
  [roles.ADMIN]: adminNav,
  [roles.OWNER]: ownerNav,
  [roles.CLEANER]: cleanerNav,
  [roles.MAINTENANCE]: maintenanceNav,
  [roles.ACCOUNTANT]: accountantNav,
};

function filterNavByAccess(sections, currentUser) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const allowedRoles = item[3];
        return !allowedRoles || hasAnyRole(currentUser, allowedRoles);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

function getSidebarNav(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);
  const sections = operationalRoles.includes(primaryRole) ? operationalNav : roleNav[primaryRole] || operationalNav;

  return filterNavByAccess(sections, currentUser);
}

function getSidebarSearchTarget(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);

  if (primaryRole === roles.ADMIN) return '/admin';
  if (primaryRole === roles.OWNER) return '/properties';
  if (primaryRole === roles.CLEANER) return '/cleaning';
  if (primaryRole === roles.MAINTENANCE) return '/maintenance-dashboard';
  if (primaryRole === roles.ACCOUNTANT) return '/properties';

  return '/properties';
}

function getSidebarSearchLabel(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);

  if (primaryRole === roles.ADMIN) return 'Search platform';
  if (primaryRole === roles.OWNER) return 'Search assigned properties';
  if (primaryRole === roles.CLEANER) return 'Search cleaning tasks';
  if (primaryRole === roles.MAINTENANCE) return 'Search assigned work orders';
  if (primaryRole === roles.ACCOUNTANT) return 'Search finance properties';

  return 'Search workspace';
}

function getSidebarWorkspaceTarget(currentUser, currentWorkspace) {
  if (!currentWorkspace?.id) return '/workspace-setup';

  const primaryRole = resolvePrimaryRole(currentUser);

  if ([roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST].includes(primaryRole)) {
    return '/settings';
  }

  if (primaryRole === roles.ADMIN) return '/admin';

  return '/account';
}

function normalizePath(pathname) {
  if (!pathname) return '/';

  const pathOnly = String(pathname).split(/[?#]/)[0];
  return pathOnly === '/' ? '/' : pathOnly.replace(/\/+$/, '') || '/';
}

function isActivePath(currentPath, href) {
  const path = normalizePath(currentPath);
  const cleanHref = normalizePath(href);

  if (href.includes('?section=')) {
    return false;
  }

  if (cleanHref === '/dashboard') {
    return path === '/dashboard';
  }

  if (cleanHref === '/properties') {
    return path === '/properties' || path.startsWith('/properties/');
  }

  if (cleanHref === '/maintenance') {
    return path === '/maintenance' || path.startsWith('/maintenance/');
  }

  if (cleanHref === '/book') {
    return path === '/book' || path.startsWith('/book/');
  }

  return path === cleanHref || path.startsWith(`${cleanHref}/`);
}

function getInitials(value) {
  return String(value || 'PF')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getWorkspaceName(currentWorkspace) {
  return currentWorkspace?.name || currentWorkspace?.business_name || 'No workspace selected';
}

function getWorkspaceMeta(currentWorkspace, currentUser) {
  if (!currentWorkspace?.id) return 'Create or join workspace';

  const role = resolvePrimaryRole(currentUser);
  return roleLabels[role] || 'Workspace member';
}

function NavButton({ href, label, Icon, active, collapsed, onNavigate }) {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      onClick={() => onNavigate(href)}
      title={collapsed ? label : undefined}
      data-skip-create-action="true"
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

export function Sidebar({ collapsed = false, setCollapsed, mobileOpen = false, setMobileOpen }) {
  const { currentUser, currentWorkspace } = useApp();
  const path = normalizePath(window.location.pathname);
  const navSections = getSidebarNav(currentUser);
  const searchTarget = getSidebarSearchTarget(currentUser);
  const searchLabel = getSidebarSearchLabel(currentUser);
  const workspaceTarget = getSidebarWorkspaceTarget(currentUser, currentWorkspace);

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

  const goTo = (href) => {
    navigate(href);
    closeMobileMenu();
  };

  const workspaceName = getWorkspaceName(currentWorkspace);
  const workspaceMeta = getWorkspaceMeta(currentWorkspace, currentUser);
  const workspaceInitials = getInitials(workspaceName);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand">
        <button
          type="button"
          className="brand-button"
          onClick={() => {
            goTo(getPostLoginPath(currentUser));
          }}
          aria-label="Go to dashboard"
          data-skip-create-action="true"
        >
          <div className="brand-mark">PF</div>
          <span>PropFlow</span>
        </button>

        <button
          type="button"
          className="mobile-close"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
          data-skip-create-action="true"
        >
          <X size={18} />
        </button>
      </div>

      <button
        type="button"
        className="sidebar-workspace"
        onClick={() => goTo(workspaceTarget)}
        title={collapsed ? workspaceName : undefined}
        data-skip-create-action="true"
      >
        <div className="sidebar-workspace-mark">{workspaceInitials || 'PF'}</div>
        <span>
          <strong>{workspaceName}</strong>
          <small>{workspaceMeta}</small>
        </span>
      </button>

      <button
        type="button"
        className="sidebar-search"
        onClick={() => goTo(searchTarget)}
        title={collapsed ? searchLabel : undefined}
        data-skip-create-action="true"
      >
        <Search size={16} />
        <span>{searchLabel}</span>
      </button>

      <nav aria-label="Main navigation">
        {navSections.map((section) => (
          <React.Fragment key={section.section}>
            <div className="sidebar-section">{section.section}</div>

            {section.items.map(([href, label, Icon]) => (
              <NavButton
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActivePath(path, href)}
                collapsed={collapsed}
                onNavigate={goTo}
              />
            ))}
          </React.Fragment>
        ))}
      </nav>

      <button
        type="button"
        className="collapse-btn"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        data-skip-create-action="true"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        <span>{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </aside>
  );
}
