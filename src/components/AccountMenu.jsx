import React from 'react';
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { roleLabels } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';
import { resolvePrimaryRole } from '../lib/auth.js';

export function AccountMenu() {
  const { currentUser, signOut } = useApp();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  const primaryRole = resolvePrimaryRole(currentUser);
  const roleLabel = roleLabels[primaryRole] || 'No workspace role';
  const displayName = currentUser?.name || currentUser?.email || 'Account';

  React.useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, []);

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };

  return (
    <div className="account-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="account-menu"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserRound size={18} />

        <span>
          {displayName}
          <small>{roleLabel}</small>
        </span>

        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="account-dropdown" role="menu">
          <div className="account-dropdown-header">
            <strong>{displayName}</strong>
            <small>{currentUser?.email || roleLabel}</small>
          </div>

          <button type="button" onClick={() => goTo('/account')} role="menuitem">
            <UserRound size={16} />
            Account settings
          </button>

          <button type="button" onClick={() => goTo('/notifications')} role="menuitem">
            <Bell size={16} />
            Notifications
          </button>

          <button type="button" onClick={() => goTo('/billing')} role="menuitem">
            <CreditCard size={16} />
            Billing
          </button>

          <button type="button" onClick={() => goTo('/settings')} role="menuitem">
            <SettingsIcon size={16} />
            Workspace settings
          </button>

          <button type="button" className="danger-menu-item" onClick={handleSignOut} role="menuitem">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
