import React from 'react';
import { Bell, CreditCard, DollarSign, KeyRound, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const settingsManagerRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const limitedSettingsRoles = [roles.HOST, roles.ACCOUNTANT, roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

function getRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, [roles.ADMIN])) {
    return 'PropFlow Admin can review platform-level setup safety, but customer workspace settings should stay workspace-scoped.';
  }

  if (hasAnyRole(currentUser, [roles.OWNER_ADMIN])) {
    return 'Workspace Owners can manage workspace settings when backend save flows and permission checks are connected.';
  }

  if (hasAnyRole(currentUser, [roles.PROPERTY_MANAGER])) {
    return 'Property Managers may manage operational settings when workspace permissions allow it.';
  }

  if (hasAnyRole(currentUser, limitedSettingsRoles)) {
    return 'This role should only see account/profile-safe settings and limited workspace context.';
  }

  return 'Settings visibility should remain restricted until workspace role rules are confirmed.';
}

export function SettingsAccountSafetyNotice() {
  const { currentUser, currentWorkspace } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const accountStatus = currentUser?.status || 'active';
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || currentWorkspace?.currency || 'not set';
  const canManageSettings = hasAnyRole(currentUser, settingsManagerRoles);
  const isSuspended = String(accountStatus).toLowerCase() === 'suspended';

  return (
    <section className="card settings-account-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Settings safety</p>
          <h3>Account and workspace settings readiness</h3>
          <p>
            Settings UI is placeholder-safe until profile editing, password changes, notification preferences,
            currency updates, and role permission writes are connected through secure backend flows.
          </p>
        </div>
        <UserRound size={22} className="muted" />
      </div>

      <div className="settings-account-grid">
        <div className="settings-account-card">
          <UserRound size={18} />
          <span>
            <strong>Profile editing</strong>
            <small>Profile information can be displayed, but save/update writes should remain disabled until a safe account update flow exists.</small>
          </span>
          <StatusBadge tone="warning">placeholder</StatusBadge>
        </div>

        <div className="settings-account-card">
          <KeyRound size={18} />
          <span>
            <strong>Password and security</strong>
            <small>Password reset, MFA, and account deletion should use Supabase Auth-safe flows, not custom frontend-only writes.</small>
          </span>
          <StatusBadge tone="warning">not connected</StatusBadge>
        </div>

        <div className="settings-account-card">
          <Bell size={18} />
          <span>
            <strong>Notification preferences</strong>
            <small>Email, SMS, WhatsApp, and in-app preferences should stay placeholder-safe until provider settings are stored securely.</small>
          </span>
          <StatusBadge tone="info">preference model pending</StatusBadge>
        </div>

        <div className="settings-account-card">
          <DollarSign size={18} />
          <span>
            <strong>Currency and workspace defaults</strong>
            <small>Current default currency: {workspaceCurrency}. Future updates must remain workspace-scoped and audit logged.</small>
          </span>
          <StatusBadge tone={workspaceCurrency === 'not set' ? 'warning' : 'info'}>{workspaceCurrency}</StatusBadge>
        </div>

        <div className="settings-account-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role and permission settings</strong>
            <small>{getRoleMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={canManageSettings ? 'info' : 'warning'}>{primaryRole || 'restricted'}</StatusBadge>
        </div>

        <div className="settings-account-card">
          <CreditCard size={18} />
          <span>
            <strong>Suspended account recovery</strong>
            <small>
              {isSuspended
                ? 'This account should only access suspension/account recovery information until restored.'
                : 'If suspended later, workspace operations should be blocked and recovery messaging should remain visible.'}
            </small>
          </span>
          <StatusBadge tone={isSuspended ? 'error' : 'success'}>{accountStatus}</StatusBadge>
        </div>
      </div>

      <div className="helper settings-account-helper">
        <Save size={16} />
        Save buttons should stay disabled or placeholder-only until backend validation, workspace scoping, RLS, and audit logging are implemented.
      </div>
    </section>
  );
}
