import React from 'react';
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  UserRound,
} from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { roleLabels, roles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';
import { resolvePrimaryRole } from '../lib/auth.js';

function getInitials(value) {
  return String(value || 'PF')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function shouldShowWorkspaceSettings(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);

  return [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST].includes(primaryRole);
}

function shouldShowBilling(currentUser) {
  const primaryRole = resolvePrimaryRole(currentUser);

  return [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT].includes(primaryRole);
}

export function AccountMenu() {
  const { currentUser, signOut } = useApp();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const menuRef = React.useRef(null);

  const primaryRole = resolvePrimaryRole(currentUser);
  const roleLabel = roleLabels[primaryRole] || 'No workspace role';
  const displayName = currentUser?.name || currentUser?.email || 'Account';
  const email = currentUser?.email || 'No email available';
  const initials = getInitials(displayName);

  React.useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setOpen(false);

    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('[PropFlow] Sign out failed', error);
      setSigningOut(false);
    }
  };

  return (
    <div className="account-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="account-menu"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        data-skip-create-action="true"
      >
        <span className="account-avatar" aria-hidden="true">
          {initials || 'PF'}
        </span>

        <span className="account-menu-copy">
          <strong>{displayName}</strong>
          <small>{roleLabel}</small>
        </span>

        <ChevronDown className={open ? 'account-chevron open' : 'account-chevron'} size={16} />
      </button>

      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-header">
            <span className="account-dropdown-avatar" aria-hidden="true">
              {initials || 'PF'}
            </span>

            <span>
              <strong>{displayName}</strong>
              <small>{email}</small>
              <small>{roleLabel}</small>
            </span>
          </div>

          {currentUser?.roles?.includes(roles.ADMIN) && (
            <button
              type="button"
              onClick={() => goTo('/admin')}
              role="menuitem"
              data-skip-create-action="true"
            >
              <Shield size={16} />
              PropFlow admin
            </button>
          )}

          <button
            type="button"
            onClick={() => goTo('/account')}
            role="menuitem"
            data-skip-create-action="true"
          >
            <UserRound size={16} />
            Account settings
          </button>

          <button
            type="button"
            onClick={() => goTo('/notifications')}
            role="menuitem"
            data-skip-create-action="true"
          >
            <Bell size={16} />
            Notifications
          </button>

          {shouldShowBilling(currentUser) && (
            <button
              type="button"
              onClick={() => goTo('/billing')}
              role="menuitem"
              data-skip-create-action="true"
            >
              <CreditCard size={16} />
              Billing
            </button>
          )}

          {shouldShowWorkspaceSettings(currentUser) && (
            <button
              type="button"
              onClick={() => goTo('/settings')}
              role="menuitem"
              data-skip-create-action="true"
            >
              <SettingsIcon size={16} />
              Workspace settings
            </button>
          )}

          <button
            type="button"
            className="danger-menu-item"
            onClick={handleSignOut}
            role="menuitem"
            disabled={signingOut}
            data-skip-create-action="true"
          >
            <LogOut size={16} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
