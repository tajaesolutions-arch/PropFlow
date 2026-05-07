import React from 'react';
import {
  Bell,
  Copy,
  CreditCard,
  Database,
  Globe2,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { currencies, inviteRoleOptions, roleLabels, roles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';

const defaultInvite = {
  email: '',
  roles: [roles.CLEANER],
  expiresAt: '',
  message: '',
  assignedPropertyIds: [],
  permissionLevel: 'standard',
};

function buildInviteLink(token) {
  if (!token || typeof window === 'undefined') return '';
  return `${window.location.origin}/join?invite=${token}`;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getMemberName(member) {
  return (
    member.profile?.full_name ||
    member.profiles?.full_name ||
    member.full_name ||
    member.user_id ||
    'Workspace member'
  );
}

function getMemberEmail(member) {
  return member.profile?.email || member.profiles?.email || member.email || '—';
}

function roleList(value) {
  if (!Array.isArray(value) || !value.length) return '—';
  return value.map((role) => roleLabels[role] || role).join(', ');
}

async function copyToClipboard(value) {
  if (!value) return;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
}

export function SettingsPage() {
  const {
    currentWorkspace,
    data,
    createInvite,
    currentUser,
    isSupabaseConfigured,
  } = useApp();

  const [invite, setInvite] = React.useState(defaultInvite);
  const [lastLink, setLastLink] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const canInvite = hasAnyRole(currentUser, [roles.OWNER_ADMIN]);
  const activeProperties = (data.properties || []).filter((property) => property.status !== 'archived');

  const setInviteField = (key) => (event) => {
    setInvite((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const setInviteRoles = (event) => {
    const selectedRoles = [...event.target.selectedOptions].map((option) => option.value);

    setInvite((value) => ({
      ...value,
      roles: selectedRoles.length ? selectedRoles : [roles.CLEANER],
    }));
  };

  const setAssignedProperties = (event) => {
    setInvite((value) => ({
      ...value,
      assignedPropertyIds: [...event.target.selectedOptions].map((option) => option.value),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!canInvite) {
      setMessage('Your role cannot invite team members in this workspace.');
      return;
    }

    if (!invite.email.trim()) {
      setMessage('Enter the invitee email address.');
      return;
    }

    if (!invite.roles.length) {
      setMessage('Choose at least one role.');
      return;
    }

    setBusy(true);
    setMessage('');
    setLastLink('');

    try {
      const created = await createInvite({
        email: invite.email,
        roles: invite.roles,
        assignedPropertyIds: invite.assignedPropertyIds,
        expiresAt: invite.expiresAt || null,
        message: invite.message,
        permissionLevel: invite.permissionLevel,
      });

      const link = buildInviteLink(created?.token);

      setLastLink(link);
      setInvite(defaultInvite);
      setMessage(
        'Invite created. Email sending is not wired yet, so copy and send the invite link manually.',
      );
    } catch (error) {
      setMessage(error.message || 'Invite creation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout title="Settings" subtitle="Workspace settings, team access, billing, notifications, and setup status">
      <div className="settings-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace settings</h3>
              <p>Core workspace identity and company code.</p>
            </div>
            <Globe2 size={20} />
          </div>

          <label>
            Workspace name
            <input value={currentWorkspace?.name || ''} readOnly />
          </label>

          <label>
            Company code
            <input value={currentWorkspace?.code || ''} readOnly />
          </label>

          <label>
            Country
            <input value={currentWorkspace?.country || ''} readOnly />
          </label>

          <label>
            Business email
            <input value={currentWorkspace?.business_email || currentWorkspace?.businessEmail || ''} readOnly />
          </label>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Currency settings</h3>
              <p>Workspace default currency for reports, dashboards, and financial records.</p>
            </div>
            <Globe2 size={20} />
          </div>

          <label>
            Default currency
            <select value={currentWorkspace?.defaultCurrency || 'USD'} disabled>
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>

          <div className="helper">
            Live exchange-rate conversion should be connected through a secure backend provider in
            a later finance/billing task.
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Subscription / billing</h3>
              <p>Stripe subscription controls and grace-period enforcement.</p>
            </div>
            <CreditCard size={20} />
          </div>

          <button type="button" disabled>
            Manage billing coming soon
          </button>

          <div className="helper">
            Billing is currently a safe placeholder. Next phase should connect Stripe checkout,
            billing portal, subscription status, failed-payment warnings, and grace-period access.
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Notifications</h3>
              <p>Email, SMS, WhatsApp, and in-app notification providers.</p>
            </div>
            <Bell size={20} />
          </div>

          <div className="helper">
            Resend and Twilio provider configuration should be added server-side. No provider
            secrets should be exposed in frontend code.
          </div>

          <button type="button" disabled>
            Notification provider settings coming soon
          </button>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Supabase configuration</h3>
              <p>Database, auth, and storage connection status.</p>
            </div>
            <Database size={20} />
          </div>

          {isSupabaseConfigured ? (
            <p className="helper">
              <ShieldCheck size={16} />
              Supabase client is configured.
            </p>
          ) : (
            <p className="helper error-helper">
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Safe reset tools</h3>
              <p>Reset actions should be handled carefully in production.</p>
            </div>
            <ShieldCheck size={20} />
          </div>

          <button type="button" disabled>
            Reset sample data unavailable
          </button>

          <button type="button" disabled>
            Reset workspace data unavailable
          </button>

          <div className="helper">
            Demo/sample reset tools are disabled because PropFlow is now moving toward real
            Supabase data. Production reset tools should require confirmation, permissions, and
            audit logging.
          </div>
        </section>

        <section className="card full">
          <div className="card-header">
            <div>
              <h3>Team invites</h3>
              <p>
                Only Workspace Owners can invite team members. PropFlow Admin is intentionally not
                available here.
              </p>
            </div>
            <Users size={20} />
          </div>

          {canInvite ? (
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Email address
                  <input
                    value={invite.email}
                    onChange={setInviteField('email')}
                    type="email"
                    required
                  />
                </label>

                <label>
                  Roles
                  <select multiple value={invite.roles} onChange={setInviteRoles}>
                    {inviteRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Assigned properties
                  <select
                    multiple
                    value={invite.assignedPropertyIds}
                    onChange={setAssignedProperties}
                  >
                    {activeProperties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Invite expiration date
                  <input
                    value={invite.expiresAt}
                    onChange={setInviteField('expiresAt')}
                    type="datetime-local"
                  />
                </label>

                <label>
                  Permission level
                  <select value={invite.permissionLevel} onChange={setInviteField('permissionLevel')}>
                    <option value="standard">Standard</option>
                    <option value="limited">Limited</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>

                <label className="full">
                  Optional message
                  <textarea value={invite.message} onChange={setInviteField('message')} />
                </label>
              </div>

              <div className="action-row">
                <button className="primary" disabled={busy}>
                  <Send size={16} />
                  {busy ? 'Creating invite…' : 'Create invite'}
                </button>
              </div>
            </form>
          ) : (
            <p className="helper">Your role cannot invite team members in this workspace.</p>
          )}

          {message && (
            <p className={message.toLowerCase().includes('failed') ? 'helper error-helper' : 'helper'}>
              {message}
            </p>
          )}

          {lastLink && (
            <div className="helper">
              <span>{lastLink}</span>
              <button type="button" onClick={() => copyToClipboard(lastLink)}>
                <Copy size={16} />
                Copy invite link
              </button>
            </div>
          )}
        </section>

        <section className="card full">
          <div className="card-header">
            <div>
              <h3>Members</h3>
              <p>Current workspace users and role assignments.</p>
            </div>
          </div>

          <DataTable
            rows={(data.members || []).map((member, index) => ({
              id: member.id || `${member.workspace_id || 'member'}-${member.user_id || index}`,
              ...member,
            }))}
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (row) => getMemberName(row),
              },
              {
                key: 'email',
                label: 'Email',
                render: (row) => getMemberEmail(row),
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
            ]}
          />
        </section>

        <section className="card full">
          <div className="card-header">
            <div>
              <h3>Invites</h3>
              <p>Pending and accepted workspace invitations.</p>
            </div>
          </div>

          <DataTable
            rows={(data.invites || []).map((inviteRow, index) => ({
              id: inviteRow.id || inviteRow.token || `invite-${index}`,
              ...inviteRow,
            }))}
            columns={[
              {
                key: 'email',
                label: 'Email',
              },
              {
                key: 'roles',
                label: 'Roles',
                render: (row) => roleList(row.roles),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge>{row.status || 'pending'}</StatusBadge>,
              },
              {
                key: 'expires_at',
                label: 'Expires',
                render: (row) => formatDate(row.expires_at),
              },
              {
                key: 'token',
                label: 'Invite link',
                render: (row) => {
                  const link = buildInviteLink(row.token);

                  return (
                    <button type="button" onClick={() => copyToClipboard(link)}>
                      <Copy size={16} />
                      Copy link
                    </button>
                  );
                },
              },
            ]}
          />
        </section>
      </div>
    </AppLayout>
  );
}
