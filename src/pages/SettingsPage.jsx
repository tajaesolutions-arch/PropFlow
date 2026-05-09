import React from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Globe2,
  KeyRound,
  Link2,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { currencies, inviteRoleOptions, roleLabels, roles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { navigate } from '../routes/AppRouter.jsx';

const defaultInvite = {
  email: '',
  roles: [roles.CLEANER],
  expiresAt: '',
  message: '',
  assignedPropertyIds: [],
  permissionLevel: 'standard',
};

const assignmentRoleOptions = [
  roles.OWNER,
  roles.CLEANER,
  roles.MAINTENANCE,
  roles.HOST,
  roles.ACCOUNTANT,
];

const billingAccessRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.ACCOUNTANT];
const teamVisibilityRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const companyCodeVisibilityRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];

const defaultAssignment = {
  userId: '',
  propertyId: '',
  assignmentRole: roles.CLEANER,
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

function getWorkspaceName(workspace) {
  return workspace?.name || workspace?.business_name || workspace?.businessName || 'No workspace selected';
}

function getWorkspaceCode(workspace) {
  return workspace?.code || workspace?.company_code || '';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function getMemberId(member) {
  return member.user_id || member.userId || member.id;
}

function getMemberName(member) {
  return (
    member.profile?.full_name ||
    member.profiles?.full_name ||
    member.full_name ||
    member.profile?.email ||
    member.profiles?.email ||
    member.email ||
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

function getPropertyName(properties, propertyId) {
  return properties.find((property) => property.id === propertyId)?.name || 'Unknown property';
}

function getAssignmentMemberName(members, userId) {
  const member = members.find((item) => getMemberId(item) === userId);
  return member ? getMemberName(member) : userId || 'Unknown member';
}

async function copyToClipboard(value) {
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  return false;
}

function SettingCard({ icon: Icon, title, description, children }) {
  return (
    <section className="card settings-card">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <Icon size={20} className="muted" />
      </div>

      {children}
    </section>
  );
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

  const [assignment, setAssignment] = React.useState(defaultAssignment);
  const [propertyAssignments, setPropertyAssignments] = React.useState([]);
  const [assignmentMessage, setAssignmentMessage] = React.useState('');
  const [assignmentBusy, setAssignmentBusy] = React.useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = React.useState(false);

  const canInvite = hasAnyRole(currentUser, [roles.OWNER_ADMIN]);
  const canManageAssignments = hasAnyRole(currentUser, [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER]);
  const canOpenBilling = hasAnyRole(currentUser, billingAccessRoles);
  const canViewTeamAccess = hasAnyRole(currentUser, teamVisibilityRoles);
  const canViewCompanyCode = hasAnyRole(currentUser, companyCodeVisibilityRoles);

  const activeProperties = (data.properties || []).filter((property) => property.status !== 'archived');
  const members = data.members || [];
  const invites = data.invites || [];
  const assignableMembers = members.filter((member) => member.status !== 'revoked');

  const workspaceName = getWorkspaceName(currentWorkspace);
  const workspaceCode = getWorkspaceCode(currentWorkspace);
  const workspaceCurrency = getWorkspaceCurrency(currentWorkspace);

  const loadPropertyAssignments = React.useCallback(async () => {
    if (!canViewTeamAccess || !isSupabaseConfigured || !supabase || !currentWorkspace?.id) {
      setPropertyAssignments([]);
      return;
    }

    setAssignmentsLoading(true);
    setAssignmentMessage('');

    try {
      const { data: rows, error } = await supabase
        .from('property_assignments')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPropertyAssignments(rows || []);
    } catch (error) {
      setPropertyAssignments([]);
      setAssignmentMessage(error?.message || 'Property assignments could not be loaded.');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [canViewTeamAccess, currentWorkspace?.id, isSupabaseConfigured]);

  React.useEffect(() => {
    loadPropertyAssignments();
  }, [loadPropertyAssignments]);

  const clearMessageSoon = () => {
    window.setTimeout(() => {
      setMessage('');
      setAssignmentMessage('');
    }, 3000);
  };

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

  const setAssignmentField = (key) => (event) => {
    setAssignment((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submitInvite = async (event) => {
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
        email: invite.email.trim(),
        roles: invite.roles,
        assignedPropertyIds: invite.assignedPropertyIds,
        expiresAt: invite.expiresAt || null,
        message: invite.message.trim() || null,
        permissionLevel: invite.permissionLevel,
      });

      const link = buildInviteLink(created?.token);

      setLastLink(link);
      setInvite(defaultInvite);
      setMessage('Invite created. Email sending is not wired yet, so copy and send the invite link manually.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Invite creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyInviteLink = async () => {
    const copied = await copyToClipboard(lastLink);

    if (copied) {
      setMessage('Invite link copied.');
      clearMessageSoon();
    }
  };

  const copyWorkspaceCode = async () => {
    if (!canViewCompanyCode) {
      setMessage('Company code is visible to workspace owners and property managers only.');
      clearMessageSoon();
      return;
    }

    const copied = await copyToClipboard(workspaceCode);

    if (copied) {
      setMessage('Company code copied.');
      clearMessageSoon();
    }
  };

  const submitAssignment = async (event) => {
    event.preventDefault();

    if (!canManageAssignments) {
      setAssignmentMessage('Your role cannot manage property assignments in this workspace.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setAssignmentMessage('Supabase is not configured. Add Supabase environment variables before saving assignments.');
      return;
    }

    if (!currentWorkspace?.id) {
      setAssignmentMessage('Select a workspace before saving assignments.');
      return;
    }

    if (!assignment.userId || !assignment.propertyId || !assignment.assignmentRole) {
      setAssignmentMessage('Choose a member, property, and assignment role.');
      return;
    }

    setAssignmentBusy(true);
    setAssignmentMessage('');

    try {
      const { error } = await supabase.from('property_assignments').upsert(
        {
          workspace_id: currentWorkspace.id,
          property_id: assignment.propertyId,
          user_id: assignment.userId,
          assignment_role: assignment.assignmentRole,
          created_by: currentUser?.id || null,
        },
        { onConflict: 'property_id,user_id,assignment_role', ignoreDuplicates: true },
      );

      if (error) throw error;

      setAssignment(defaultAssignment);
      setAssignmentMessage('Property assignment saved.');
      clearMessageSoon();
      await loadPropertyAssignments();
    } catch (error) {
      setAssignmentMessage(error?.message || 'Property assignment could not be saved.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  const removeAssignment = async (assignmentId) => {
    if (!canManageAssignments) {
      setAssignmentMessage('Your role cannot remove property assignments in this workspace.');
      return;
    }

    if (!isSupabaseConfigured || !supabase || !currentWorkspace?.id) {
      setAssignmentMessage('Supabase is not configured or no workspace is selected.');
      return;
    }

    setAssignmentBusy(true);
    setAssignmentMessage('');

    try {
      const { error } = await supabase
        .from('property_assignments')
        .delete()
        .eq('id', assignmentId)
        .eq('workspace_id', currentWorkspace.id);

      if (error) throw error;

      setAssignmentMessage('Property assignment removed.');
      clearMessageSoon();
      await loadPropertyAssignments();
    } catch (error) {
      setAssignmentMessage(error?.message || 'Property assignment could not be removed.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  return (
    <AppLayout
      title="Settings"
      subtitle="Workspace settings, team access, billing, notifications, property assignments, and setup status."
    >
      {(message || assignmentMessage) && (
        <section
          className={
            [message, assignmentMessage].join(' ').toLowerCase().includes('failed') ||
            [message, assignmentMessage].join(' ').toLowerCase().includes('cannot') ||
            [message, assignmentMessage].join(' ').toLowerCase().includes('could not')
              ? 'helper error-helper'
              : 'helper'
          }
          role="status"
        >
          {message || assignmentMessage}
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard
          label="Workspace"
          value={workspaceName}
          subtitle={canViewCompanyCode ? workspaceCode || 'No company code' : 'Company code restricted'}
          icon={Globe2}
        />
        <StatCard
          label="Team access"
          value={canViewTeamAccess ? members.length : 'Restricted'}
          subtitle={canViewTeamAccess ? `${invites.length} invites tracked` : 'Owner/manager only'}
          icon={Users}
        />
        <StatCard
          label="Properties"
          value={activeProperties.length}
          subtitle={canViewTeamAccess ? `${propertyAssignments.length} assignments` : 'Assignment history restricted'}
          icon={Building2}
        />
        <StatCard
          label="Supabase"
          value={isSupabaseConfigured ? 'Connected' : 'Missing'}
          subtitle="Auth, database, and storage"
          icon={Database}
          tone={isSupabaseConfigured ? 'accent' : 'warning'}
        />
      </section>

      <section className="settings-grid">
        <SettingCard
          icon={Globe2}
          title="Workspace settings"
          description="Core workspace identity and company code."
        >
          <div className="form-grid">
            <label>
              Workspace name
              <input value={workspaceName} readOnly />
            </label>

            <label>
              Company code
              {canViewCompanyCode ? (
                <div className="settings-copy-field">
                  <input value={workspaceCode} readOnly />
                  <button
                    type="button"
                    onClick={copyWorkspaceCode}
                    disabled={!workspaceCode}
                    data-skip-create-action="true"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ) : (
                <input value="Hidden — owner/manager only" readOnly />
              )}
            </label>

            <label>
              Country
              <input value={currentWorkspace?.country || ''} readOnly />
            </label>

            <label>
              Business email
              <input value={currentWorkspace?.business_email || currentWorkspace?.businessEmail || ''} readOnly />
            </label>
          </div>

          {!canViewCompanyCode && (
            <div className="helper">
              Company codes are visible to workspace owners and property managers only. Hosts can use workspace settings without invite-code access.
            </div>
          )}
        </SettingCard>

        <SettingCard
          icon={Globe2}
          title="Currency settings"
          description="Workspace default currency for reports, dashboards, and financial records."
        >
          <label>
            Default currency
            <select value={workspaceCurrency} disabled>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <div className="helper">
            Live exchange-rate conversion should be connected through a secure backend provider in a later finance task.
          </div>
        </SettingCard>

        <SettingCard
          icon={CreditCard}
          title="Subscription / billing"
          description="Stripe subscription controls and grace-period enforcement."
        >
          {canOpenBilling ? (
            <button type="button" onClick={() => navigate('/billing')} data-skip-create-action="true">
              Open billing page
            </button>
          ) : (
            <div className="helper">
              Billing controls are available to Workspace Owners and Accountants. Property Managers and Hosts can continue using workspace settings without billing access.
            </div>
          )}

          <div className="helper">
            Billing page should connect Stripe checkout, billing portal, subscription status, failed-payment warnings, and grace-period access.
          </div>
        </SettingCard>

        <SettingCard
          icon={Bell}
          title="Notifications"
          description="Email, SMS, WhatsApp, and in-app notification providers."
        >
          <button
            type="button"
            onClick={() => navigate('/notification-settings')}
            data-skip-create-action="true"
          >
            Open notification settings
          </button>

          <div className="helper">
            Resend and Twilio provider configuration should be added server-side. No provider secrets should be exposed in frontend code.
          </div>
        </SettingCard>

        <SettingCard
          icon={Database}
          title="Supabase configuration"
          description="Database, auth, and storage connection status."
        >
          {isSupabaseConfigured ? (
            <div className="helper">
              <ShieldCheck size={16} />
              Supabase environment variables are configured.
            </div>
          ) : (
            <div className="helper error-helper">
              <KeyRound size={16} />
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.
            </div>
          )}

          <div className="settings-status-list">
            <span>
              <strong>Authentication</strong>
              <StatusBadge tone={isSupabaseConfigured ? 'success' : 'warning'}>
                {isSupabaseConfigured ? 'ready' : 'missing env'}
              </StatusBadge>
            </span>

            <span>
              <strong>Private storage</strong>
              <StatusBadge tone={isSupabaseConfigured ? 'success' : 'warning'}>
                {isSupabaseConfigured ? 'ready' : 'pending'}
              </StatusBadge>
            </span>

            <span>
              <strong>Workspace RLS</strong>
              <StatusBadge tone="info">database enforced</StatusBadge>
            </span>
          </div>
        </SettingCard>
      </section>

      <section className="card settings-invite-card">
        <div className="card-header">
          <div>
            <h3>Invite team member</h3>
            <p>
              Create workspace invites for staff, owners, property managers, hosts, accountants, cleaners, and maintenance crew.
            </p>
          </div>

          <Send size={20} className="muted" />
        </div>

        {canInvite ? (
          <form className="settings-invite-form" onSubmit={submitInvite}>
            <div className="form-grid">
              <label>
                Invitee email
                <input
                  type="email"
                  value={invite.email}
                  onChange={setInviteField('email')}
                  placeholder="name@example.com"
                  required
                />
              </label>

              <label>
                Roles
                <select multiple value={invite.roles} onChange={setInviteRoles}>
                  {inviteRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role] || role}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Assigned properties
                <select multiple value={invite.assignedPropertyIds} onChange={setAssignedProperties}>
                  {activeProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Expiration date
                <input type="date" value={invite.expiresAt} onChange={setInviteField('expiresAt')} />
              </label>

              <label>
                Permission level
                <select value={invite.permissionLevel} onChange={setInviteField('permissionLevel')}>
                  <option value="standard">Standard</option>
                  <option value="limited">Limited</option>
                </select>
              </label>

              <label className="full">
                Message
                <textarea
                  value={invite.message}
                  onChange={setInviteField('message')}
                  rows={3}
                  placeholder="Optional message shown with the invite."
                />
              </label>
            </div>

            <div className="settings-form-actions">
              <button type="submit" className="primary" disabled={busy} data-skip-create-action="true">
                <Send size={16} />
                {busy ? 'Creating invite…' : 'Create invite'}
              </button>
            </div>
          </form>
        ) : (
          <EmptyState
            compact
            icon={Users}
            title="Invite access restricted"
            description="Only workspace owners/company admins can create team invites."
          />
        )}

        {lastLink && canInvite && (
          <div className="settings-invite-link">
            <Link2 size={16} />
            <input value={lastLink} readOnly />
            <button type="button" onClick={copyInviteLink} data-skip-create-action="true">
              <Copy size={16} />
              Copy
            </button>
          </div>
        )}
      </section>

      {canViewTeamAccess ? (
        <section className="panel-grid two">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Workspace members</h3>
                <p>Current users connected to this workspace.</p>
              </div>
              <Users size={20} className="muted" />
            </div>

            {members.length ? (
              <DataTable
                rows={members}
                columns={[
                  {
                    key: 'member',
                    label: 'Member',
                    render: (row) => (
                      <span>
                        <strong>{getMemberName(row)}</strong>
                        <small>{getMemberEmail(row)}</small>
                      </span>
                    ),
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
                compact
                icon={Users}
                title="No team members loaded"
                description="Workspace members will appear here after invites are accepted."
              />
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Invite history</h3>
                <p>Pending, accepted, expired, and revoked invites.</p>
              </div>
              <Send size={20} className="muted" />
            </div>

            {canInvite ? (
              invites.length ? (
                <DataTable
                  rows={invites}
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
                  ]}
                />
              ) : (
                <EmptyState
                  compact
                  icon={Send}
                  title="No invites yet"
                  description="Created invites will appear here."
                />
              )
            ) : (
              <EmptyState
                compact
                icon={Send}
                title="Invite history restricted"
                description="Invite history is visible to workspace owners/company admins only."
              />
            )}
          </section>
        </section>
      ) : (
        <section className="card">
          <EmptyState
            compact
            icon={Users}
            title="Team access is restricted"
            description="Workspace member lists, member emails, invite history, and assignment history are visible to workspace owners and property managers only."
          />
        </section>
      )}

      {canViewTeamAccess && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property assignments</h3>
              <p>Assign owners, cleaners, maintenance crew, hosts, or accountants to specific properties.</p>
            </div>

            <Building2 size={20} className="muted" />
          </div>

          {canManageAssignments ? (
            <form className="settings-assignment-form" onSubmit={submitAssignment}>
              <label>
                Member
                <select value={assignment.userId} onChange={setAssignmentField('userId')} required>
                  <option value="">Select member</option>
                  {assignableMembers.map((member) => (
                    <option key={getMemberId(member)} value={getMemberId(member)}>
                      {getMemberName(member)} — {roleList(member.roles)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Property
                <select value={assignment.propertyId} onChange={setAssignmentField('propertyId')} required>
                  <option value="">Select property</option>
                  {activeProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Assignment role
                <select value={assignment.assignmentRole} onChange={setAssignmentField('assignmentRole')} required>
                  {assignmentRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role] || role}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="primary" disabled={assignmentBusy} data-skip-create-action="true">
                <CheckCircle2 size={16} />
                {assignmentBusy ? 'Saving…' : 'Save assignment'}
              </button>
            </form>
          ) : (
            <EmptyState
              compact
              icon={Building2}
              title="Assignment access restricted"
              description="Only workspace owners and property managers can manage property assignments."
            />
          )}

          <div className="settings-assignment-table">
            {assignmentsLoading ? (
              <div className="helper">Loading property assignments…</div>
            ) : propertyAssignments.length ? (
              <DataTable
                rows={propertyAssignments}
                columns={[
                  {
                    key: 'member',
                    label: 'Member',
                    render: (row) => getAssignmentMemberName(members, row.user_id || row.userId),
                  },
                  {
                    key: 'property',
                    label: 'Property',
                    render: (row) => getPropertyName(activeProperties, row.property_id || row.propertyId),
                  },
                  {
                    key: 'assignment_role',
                    label: 'Role',
                    render: (row) => roleLabels[row.assignment_role] || row.assignment_role || '—',
                  },
                  {
                    key: 'created_at',
                    label: 'Created',
                    render: (row) => formatDate(row.created_at),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (row) =>
                      canManageAssignments ? (
                        <button
                          type="button"
                          onClick={() => removeAssignment(row.id)}
                          disabled={assignmentBusy}
                          data-skip-create-action="true"
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                compact
                icon={Building2}
                title="No property assignments yet"
                description="Saved property assignments will appear here."
              />
            )}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
