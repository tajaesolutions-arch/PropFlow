import React from 'react';
import {
  Building2,
  Copy,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { roleLabels, roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { navigate } from '../routes/AppRouter.jsx';

const workspaceSettingsRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

function roleList(roles = []) {
  if (!Array.isArray(roles) || !roles.length) {
    return 'No workspace role yet';
  }

  return roles.map((role) => roleLabels[role] || role).join(', ');
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getWorkspaceName(workspace) {
  return workspace?.name || workspace?.business_name || workspace?.businessName || 'Workspace';
}

function getWorkspaceStatus(workspace) {
  return workspace?.status || workspace?.account_status || 'active';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function getWorkspaceCode(workspace) {
  return workspace?.code || workspace?.company_code || '—';
}

function getUserName(currentUser) {
  return currentUser?.name || currentUser?.full_name || currentUser?.email || 'Account user';
}

function getUserEmail(currentUser) {
  return currentUser?.email || 'No email available';
}

function getUserStatus(currentUser) {
  return currentUser?.status || 'active';
}

function getInitials(value) {
  return String(value || 'PF')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();

  if (['active', 'approved', 'ready'].includes(status)) return 'success';
  if (['pending', 'invited', 'trialing'].includes(status)) return 'warning';
  if (['suspended', 'restricted', 'blocked', 'revoked'].includes(status)) return 'error';

  return 'info';
}

async function copyToClipboard(value) {
  if (!value || !navigator.clipboard?.writeText) return false;

  await navigator.clipboard.writeText(value);
  return true;
}

function AccountProfileCard({ currentUser, primaryRoleLabel }) {
  const displayName = getUserName(currentUser);
  const email = getUserEmail(currentUser);

  return (
    <section className="card account-profile-card">
      <div className="account-profile-header">
        <div className="account-profile-avatar" aria-hidden="true">
          {getInitials(displayName) || 'PF'}
        </div>

        <div>
          <h3>{displayName}</h3>
          <p>{email}</p>
        </div>

        <StatusBadge tone={statusTone(getUserStatus(currentUser))}>
          {getUserStatus(currentUser)}
        </StatusBadge>
      </div>

      <div className="account-profile-grid">
        <span>
          <UserRound size={16} />
          <strong>{primaryRoleLabel}</strong>
          <small>Primary role</small>
        </span>

        <span>
          <ShieldCheck size={16} />
          <strong>{roleList(currentUser?.roles)}</strong>
          <small>Workspace roles</small>
        </span>

        <span>
          <Mail size={16} />
          <strong>{email}</strong>
          <small>Email</small>
        </span>

        <span>
          <KeyRound size={16} />
          <strong>{currentUser?.id || '—'}</strong>
          <small>User ID</small>
        </span>
      </div>
    </section>
  );
}

export function AccountSettingsPage() {
  const {
    currentUser,
    currentWorkspace,
    workspaces,
    memberships,
    signOut,
  } = useApp();

  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const primaryRole = resolvePrimaryRole(currentUser);
  const primaryRoleLabel = roleLabels[primaryRole] || 'No workspace role';
  const userWorkspaces = workspaces || [];
  const userMemberships = memberships || [];
  const canOpenWorkspaceSettings = hasAnyRole(currentUser, workspaceSettingsRoles);

  const handleSignOut = async () => {
    setBusy(true);
    setMessage('');

    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      setMessage(error.message || 'Could not sign out.');
      setBusy(false);
    }
  };

  const copyWorkspaceCode = async () => {
    if (!canOpenWorkspaceSettings) {
      setMessage('Workspace code is available to workspace administrators only.');
      window.setTimeout(() => setMessage(''), 3000);
      return;
    }

    const copied = await copyToClipboard(getWorkspaceCode(currentWorkspace));

    setMessage(copied ? 'Workspace code copied.' : 'Workspace code could not be copied.');

    window.setTimeout(() => setMessage(''), 3000);
  };

  return (
    <AppLayout
      title="Account settings"
      subtitle="Profile, role access, workspace membership, and secure session controls."
    >
      {message && (
        <section
          className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}
          role="status"
        >
          {message}
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard
          label="Account status"
          value={getUserStatus(currentUser)}
          icon={ShieldCheck}
          tone={statusTone(getUserStatus(currentUser))}
        />

        <StatCard label="Primary role" value={primaryRoleLabel} icon={UserRound} />
        <StatCard label="Workspaces" value={userWorkspaces.length} icon={Building2} />
        <StatCard label="Membership records" value={userMemberships.length} icon={Users} />
      </section>

      <AccountProfileCard currentUser={currentUser} primaryRoleLabel={primaryRoleLabel} />

      <section className="card account-session-card">
        <div className="card-header">
          <div>
            <h3>Session controls</h3>
            <p>Sign out from the current browser session.</p>
          </div>
          <LogOut size={20} className="muted" />
        </div>

        <div className="account-session-actions">
          <button
            className="danger"
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            data-skip-create-action="true"
          >
            <LogOut size={16} />
            {busy ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Current workspace</h3>
              <p>The workspace currently loaded for this session.</p>
            </div>
            <Building2 size={20} className="muted" />
          </div>

          {currentWorkspace ? (
            <div className="account-workspace-grid">
              <span>
                <Building2 size={16} />
                <strong>{getWorkspaceName(currentWorkspace)}</strong>
                <small>Workspace name</small>
              </span>

              <span>
                <ShieldCheck size={16} />
                <strong>{getWorkspaceStatus(currentWorkspace)}</strong>
                <small>Status</small>
              </span>

              <span>
                <KeyRound size={16} />
                <strong>{getWorkspaceCurrency(currentWorkspace)}</strong>
                <small>Default currency</small>
              </span>

              {canOpenWorkspaceSettings ? (
                <span>
                  <Copy size={16} />
                  <strong>{getWorkspaceCode(currentWorkspace)}</strong>
                  <small>Company code</small>
                </span>
              ) : (
                <span>
                  <Lock size={16} />
                  <strong>Hidden</strong>
                  <small>Company code is admin-only</small>
                </span>
              )}

              {canOpenWorkspaceSettings ? (
                <>
                  <button
                    type="button"
                    onClick={copyWorkspaceCode}
                    disabled={!currentWorkspace}
                    data-skip-create-action="true"
                  >
                    <Copy size={16} />
                    Copy workspace code
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    data-skip-create-action="true"
                  >
                    Open workspace settings
                  </button>
                </>
              ) : (
                <div className="helper">
                  Workspace code and workspace settings are managed by authorized workspace administrators.
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              compact
              icon={Building2}
              title="No workspace selected"
              description="Create or join a workspace to access PropFlow workspace features."
              action={
                <button type="button" onClick={() => navigate('/workspace-setup')} data-skip-create-action="true">
                  Create or join workspace
                </button>
              }
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Account security</h3>
              <p>Security settings and profile editing are intentionally limited in the MVP.</p>
            </div>
            <ShieldCheck size={20} className="muted" />
          </div>

          <div className="account-security-list">
            <span>
              <strong>Password changes</strong>
              <StatusBadge tone="info">Supabase Auth flow later</StatusBadge>
            </span>

            <span>
              <strong>Profile editing</strong>
              <StatusBadge tone="info">planned</StatusBadge>
            </span>

            <span>
              <strong>MFA / 2FA</strong>
              <StatusBadge tone="warning">not configured</StatusBadge>
            </span>

            <span>
              <strong>Account deletion</strong>
              <StatusBadge tone="info">admin-safe flow later</StatusBadge>
            </span>
          </div>

          <div className="helper">
            Password changes, profile editing, MFA, and account deletion should be added through
            Supabase Auth-safe flows in a later account-management phase.
          </div>
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Workspace memberships</h3>
            <p>All workspace membership records available to this account.</p>
          </div>
          <Users size={20} className="muted" />
        </div>

        {userMemberships.length ? (
          <DataTable
            rows={userMemberships.map((membership, index) => ({
              id: membership.id || `${membership.workspace_id || 'workspace'}-${index}`,
              ...membership,
            }))}
            columns={[
              {
                key: 'workspace',
                label: 'Workspace',
                render: (row) => getWorkspaceName(row.workspaces || row.workspace),
              },
              {
                key: 'roles',
                label: 'Roles',
                render: (row) => roleList(row.roles),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => (
                  <StatusBadge tone={statusTone(row.status || 'active')}>
                    {row.status || 'active'}
                  </StatusBadge>
                ),
              },
              {
                key: 'created_at',
                label: 'Joined',
                render: (row) => formatDate(row.created_at),
              },
            ]}
          />
        ) : (
          <EmptyState
            compact
            icon={Users}
            title="No workspace memberships yet"
            description="Create a workspace or join an existing workspace with a valid invite."
          />
        )}
      </section>
    </AppLayout>
  );
}
