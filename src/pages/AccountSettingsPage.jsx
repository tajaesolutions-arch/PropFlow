import React from 'react';
import {
  Building2,
  LogOut,
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
import { roleLabels } from '../data/constants.js';
import { resolvePrimaryRole } from '../lib/auth.js';
import { navigate } from '../routes/AppRouter.jsx';

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
  return workspace?.name || workspace?.business_name || 'Workspace';
}

function getWorkspaceStatus(workspace) {
  return workspace?.status || workspace?.account_status || 'active';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
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

  return (
    <AppLayout title="Account settings" subtitle="Profile, role access, workspace membership, and session controls">
      <div className="stat-grid dense">
        <StatCard label="Account status" value={currentUser?.status || 'unknown'} icon={ShieldCheck} />
        <StatCard label="Primary role" value={primaryRoleLabel} icon={UserRound} />
        <StatCard label="Workspaces" value={userWorkspaces.length} icon={Building2} />
        <StatCard label="Membership records" value={userMemberships.length} icon={Users} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Profile</h3>
            <p>Your authenticated profile and current workspace role information.</p>
          </div>
          <UserRound size={20} />
        </div>

        <div className="form-grid">
          <label>
            Name
            <input value={currentUser?.name || ''} readOnly />
          </label>

          <label>
            Email
            <input value={currentUser?.email || ''} readOnly />
          </label>

          <label>
            Status
            <input value={currentUser?.status || 'unknown'} readOnly />
          </label>

          <label>
            Primary role
            <input value={primaryRoleLabel} readOnly />
          </label>

          <label className="full">
            Roles in this workspace
            <input value={roleList(currentUser?.roles)} readOnly />
          </label>
        </div>

        {message && (
          <p className={message.toLowerCase().includes('could not') ? 'helper error-helper' : 'helper'}>
            {message}
          </p>
        )}

        <div className="action-row">
          <button className="danger" type="button" onClick={handleSignOut} disabled={busy}>
            <LogOut size={16} />
            {busy ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Current workspace</h3>
            <p>The workspace currently loaded for this session.</p>
          </div>
          <Building2 size={20} />
        </div>

        {currentWorkspace ? (
          <div className="metadata-grid">
            <span>
              <Building2 size={16} />
              {getWorkspaceName(currentWorkspace)}
            </span>

            <span>
              <StatusBadge>{getWorkspaceStatus(currentWorkspace)}</StatusBadge>
            </span>

            <span>
              Currency: {getWorkspaceCurrency(currentWorkspace)}
            </span>

            <span>
              Code: {currentWorkspace.code || currentWorkspace.company_code || '—'}
            </span>
          </div>
        ) : (
          <EmptyState
            title="No workspace selected."
            description="Create or join a workspace to access PropFlow workspace features."
            action={
              <button type="button" onClick={() => navigate('/workspace-setup')}>
                Create or join workspace
              </button>
            }
          />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Workspace memberships</h3>
            <p>All workspace membership records available to this account.</p>
          </div>
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
                render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge>,
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
            title="No workspace memberships yet."
            description="Create a workspace or join an existing workspace with a valid invite."
          />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Account security</h3>
            <p>Security settings and profile editing are intentionally limited in the MVP.</p>
          </div>
          <ShieldCheck size={20} />
        </div>

        <div className="helper">
          Password changes, profile editing, MFA, and account deletion should be added through
          Supabase Auth-safe flows in a later account-management phase.
        </div>
      </section>
    </AppLayout>
  );
}
