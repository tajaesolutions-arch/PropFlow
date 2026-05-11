import React from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Globe2,
  History,
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
import { currencies, inviteRoleOptions, invitePermissionLevels, propertyAssignmentRoleOptions, propertyScopedInviteRoles, roleLabels, roles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { navigate } from '../routes/AppRouter.jsx';

const defaultInvite = {
  email: '',
  roles: [roles.CLEANER],
  expiresAt: '',
  message: '',
  assignedPropertyIds: [],
  permissionLevel: 'standard',
};

const assignmentRoleOptions = propertyAssignmentRoleOptions;

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

function roleBadges(value) {
  if (!Array.isArray(value) || !value.length) return '—';

  return (
    <div className="settings-role-badges">
      {value.map((role) => (
        <StatusBadge key={role} tone="info">{roleLabels[role] || role}</StatusBadge>
      ))}
    </div>
  );
}

function getPropertyName(properties, propertyId) {
  return properties.find((property) => property.id === propertyId)?.name || 'Unknown property';
}

function getAssignmentMemberName(members, userId) {
  const member = members.find((item) => getMemberId(item) === userId);
  return member ? getMemberName(member) : userId || 'Unknown member';
}

function getInviteStatus(invite) {
  if (invite?.status === 'pending' && invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }

  return invite?.status || 'pending';
}

function getStatusTone(status) {
  if (status === 'active' || status === 'accepted') return 'success';
  if (status === 'pending') return 'info';
  if (status === 'suspended' || status === 'expired') return 'warning';
  if (status === 'revoked') return 'error';
  return 'info';
}

function summarizeProperties(properties, propertyIds = []) {
  const names = Array.from(new Set(propertyIds))
    .map((propertyId) => getPropertyName(properties, propertyId))
    .filter((name) => name && name !== 'Unknown property');

  if (!names.length) return 'Workspace-level access';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

function getMemberPropertySummary(member, assignments, properties) {
  const memberId = getMemberId(member);
  const propertyIds = assignments
    .filter((assignment) => (assignment.user_id || assignment.userId) === memberId)
    .map((assignment) => assignment.property_id || assignment.propertyId)
    .filter(Boolean);

  return summarizeProperties(properties, propertyIds);
}

function humanizeAction(action) {
  return String(action || 'workspace_activity')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getActivityActorName(log, members = [], currentUser = null) {
  const actorId = log.actorUserId || log.actor_user_id;
  if (!actorId) return 'System';
  if (actorId === currentUser?.id) return currentUser.fullName || currentUser.full_name || currentUser.email || 'You';

  const member = members.find((item) => getMemberId(item) === actorId);
  return member ? getMemberName(member) : 'Workspace user';
}

function getActivityMetadataSummary(log, properties = []) {
  const metadata = log?.metadata && typeof log.metadata === 'object' ? log.metadata : {};
  const pieces = [];
  const propertyId = metadata.property_id || metadata.propertyId;
  const propertyName = propertyId ? getPropertyName(properties, propertyId) : metadata.property_name;

  if (propertyName && propertyName !== 'Unknown property') pieces.push(propertyName);
  if (metadata.title) pieces.push(metadata.title);
  if (metadata.guest_name) pieces.push(`Guest: ${metadata.guest_name}`);
  if (metadata.email) pieces.push(`Email: ${metadata.email}`);
  if (metadata.status) pieces.push(`Status: ${humanizeAction(metadata.status)}`);
  if (metadata.priority) pieces.push(`Priority: ${humanizeAction(metadata.priority)}`);
  if (metadata.start_date && metadata.end_date) pieces.push(`${metadata.start_date} to ${metadata.end_date}`);
  if (metadata.check_in && metadata.check_out) pieces.push(`${metadata.check_in} to ${metadata.check_out}`);
  if (Array.isArray(metadata.changed_fields) && metadata.changed_fields.length) {
    pieces.push(`Updated: ${metadata.changed_fields.map(humanizeAction).slice(0, 4).join(', ')}`);
  }

  return pieces.length ? pieces.join(' • ') : 'No additional details saved.';
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
    dataLoading,
    dataWarnings,
    createInvite,
    updateWorkspaceMemberStatus,
    revokeWorkspaceInvite,
    createPropertyAssignment,
    removePropertyAssignment,
    currentUser,
    isSupabaseConfigured,
  } = useApp();

  const [invite, setInvite] = React.useState(defaultInvite);
  const [lastLink, setLastLink] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [assignment, setAssignment] = React.useState(defaultAssignment);
  const [assignmentMessage, setAssignmentMessage] = React.useState('');
  const [assignmentBusy, setAssignmentBusy] = React.useState(false);
  const [memberBusyId, setMemberBusyId] = React.useState('');
  const [inviteBusyId, setInviteBusyId] = React.useState('');
  const [activityFilter, setActivityFilter] = React.useState('all');

  const canInvite = hasAnyRole(currentUser, [roles.OWNER_ADMIN]);
  const canManageMembers = hasAnyRole(currentUser, [roles.OWNER_ADMIN]);
  const canManageAssignments = hasAnyRole(currentUser, [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER]);
  const canOpenBilling = hasAnyRole(currentUser, billingAccessRoles);
  const canViewTeamAccess = hasAnyRole(currentUser, teamVisibilityRoles);
  const canViewCompanyCode = hasAnyRole(currentUser, companyCodeVisibilityRoles);
  const canViewActivityLogs = hasAnyRole(currentUser, teamVisibilityRoles);

  const activeProperties = (data.properties || []).filter((property) => property.status !== 'archived');
  const members = data.members || [];
  const invites = data.invites || [];
  const propertyAssignments = data.propertyAssignments || [];
  const activityLogs = (data.activityLogs || []).filter((log) => !currentWorkspace?.id || (log.workspace_id || log.workspaceId) === currentWorkspace.id);
  const activityActionOptions = Array.from(new Set(activityLogs.map((log) => log.action).filter(Boolean))).sort();
  const visibleActivityLogs = activityFilter === 'all' ? activityLogs : activityLogs.filter((log) => log.action === activityFilter);
  const assignableMembers = members.filter((member) => member.status === 'active');

  const workspaceName = getWorkspaceName(currentWorkspace);
  const workspaceCode = getWorkspaceCode(currentWorkspace);
  const workspaceCurrency = getWorkspaceCurrency(currentWorkspace);

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

    if (!currentWorkspace?.id) {
      setMessage('Select a workspace before creating invites.');
      return;
    }

    const normalizedEmail = invite.email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage('Enter a valid invitee email address.');
      return;
    }

    const normalizedRoles = Array.from(new Set(invite.roles.map((role) => String(role || '').trim()).filter(Boolean)));
    const invalidRoles = normalizedRoles.filter((role) => !inviteRoleOptions.includes(role));

    if (!normalizedRoles.length) {
      setMessage('Choose at least one role.');
      return;
    }

    if (normalizedRoles.length !== invite.roles.length) {
      setMessage('Remove duplicate or blank roles before creating the invite.');
      return;
    }

    if (invalidRoles.length) {
      setMessage('Select valid customer workspace roles only. PropFlow Admin cannot be invited.');
      return;
    }

    const assignedPropertyIds = Array.from(new Set(invite.assignedPropertyIds.map((propertyId) => String(propertyId || '').trim()).filter(Boolean)));
    const invalidPropertyIds = assignedPropertyIds.filter(
      (propertyId) => !activeProperties.some((property) => property.id === propertyId && property.workspace_id === currentWorkspace.id),
    );

    if (invalidPropertyIds.length) {
      setMessage('Assigned properties must belong to the current workspace.');
      return;
    }

    const needsScopedProperties = normalizedRoles.some((role) => propertyScopedInviteRoles.includes(role));
    if (needsScopedProperties && !assignedPropertyIds.length) {
      setMessage('Property Owner, Cleaner, and Maintenance invites require at least one assigned property.');
      return;
    }

    if (!needsScopedProperties && assignedPropertyIds.length) {
      setMessage('Assigned properties only apply to Property Owner, Cleaner, and Maintenance invites.');
      return;
    }

    if (!invitePermissionLevels.includes(invite.permissionLevel)) {
      setMessage('Choose a valid permission level.');
      return;
    }

    if (!isSupabaseConfigured) {
      setMessage('Supabase is not configured. Invite validation is ready, but no production invite was created.');
      return;
    }

    setBusy(true);
    setMessage('');
    setLastLink('');

    try {
      const created = await createInvite({
        email: normalizedEmail,
        roles: normalizedRoles,
        assignedPropertyIds,
        expiresAt: invite.expiresAt || null,
        message: invite.message.trim() || null,
        permissionLevel: invite.permissionLevel,
      });

      const link = buildInviteLink(created?.token);

      setLastLink(link);
      setInvite(defaultInvite);
      setMessage('Invite created. Email sending is not wired yet, so copy the one-time invite link and send it only to the invited email.');
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

    if (!isSupabaseConfigured) {
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
      await createPropertyAssignment({
        propertyId: assignment.propertyId,
        userId: assignment.userId,
        assignmentRole: assignment.assignmentRole,
      });

      setAssignment(defaultAssignment);
      setAssignmentMessage('Property assignment saved.');
      clearMessageSoon();
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

    if (!isSupabaseConfigured || !currentWorkspace?.id) {
      setAssignmentMessage('Supabase is not configured or no workspace is selected.');
      return;
    }

    setAssignmentBusy(true);
    setAssignmentMessage('');

    try {
      await removePropertyAssignment(assignmentId);

      setAssignmentMessage('Property assignment removed.');
      clearMessageSoon();
    } catch (error) {
      setAssignmentMessage(error?.message || 'Property assignment could not be removed.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  const updateMemberStatus = async (memberId, status) => {
    if (!canManageMembers) {
      setMessage('Only Workspace Owners / Company Admins can manage member lifecycle controls.');
      return;
    }

    setMemberBusyId(memberId);
    setMessage('');

    try {
      await updateWorkspaceMemberStatus(memberId, status);
      setMessage(status === 'active' ? 'Member reactivated.' : `Member ${status}.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Member status could not be updated.');
    } finally {
      setMemberBusyId('');
    }
  };

  const revokeInvite = async (inviteId) => {
    if (!canInvite) {
      setMessage('Only Workspace Owners / Company Admins can revoke invites.');
      return;
    }

    setInviteBusyId(inviteId);
    setMessage('');

    try {
      await revokeWorkspaceInvite(inviteId);
      setMessage('Pending invite revoked.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Invite could not be revoked.');
    } finally {
      setInviteBusyId('');
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

          <div className="settings-status-list">
            <span>
              <strong>Email provider: Resend</strong>
              <StatusBadge tone="warning">Backend setup required</StatusBadge>
            </span>
            <span>
              <strong>SMS provider: Twilio</strong>
              <StatusBadge tone="info">Coming soon</StatusBadge>
            </span>
            <span>
              <strong>WhatsApp provider: Twilio</strong>
              <StatusBadge tone="info">Coming soon</StatusBadge>
            </span>
          </div>

          <div className="helper">
            Provider readiness only. Real Resend/Twilio sending, API keys, webhooks, and secrets must be added server-side later and are not exposed here.
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
                <small>Customer workspace roles only. PropFlow Admin is platform-level and cannot be invited.</small>
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
                <small>Required only for Property Owner, Cleaner, and Maintenance invites.</small>
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
            <small>Shown only after creation. Send only to the invited email; invite acceptance still requires that signed-in email.</small>
          </div>
        )}
      </section>


      {canViewActivityLogs ? (
        <section className="card settings-activity-card">
          <div className="card-header">
            <div>
              <h3>Activity / Audit history</h3>
              <p>Recent RLS-visible workspace activity for authorized managers. Results are workspace-scoped and limited to the latest 50 records.</p>
            </div>
            <History size={20} className="muted" />
          </div>

          <div className="settings-activity-toolbar">
            <label>
              Filter by action
              <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
                <option value="all">All activity</option>
                {activityActionOptions.map((action) => (
                  <option key={action} value={action}>{humanizeAction(action)}</option>
                ))}
              </select>
            </label>
            <span className="helper">Workspace: {workspaceName}</span>
          </div>

          {!isSupabaseConfigured ? (
            <EmptyState
              compact
              icon={Database}
              title="Supabase is not configured"
              description="Activity logs are skipped safely in local/demo mode until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured."
            />
          ) : dataLoading ? (
            <div className="settings-activity-state" role="status">Loading recent activity…</div>
          ) : dataWarnings.some((warning) => warning.toLowerCase().includes('activity logs')) ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="Activity logs are not available"
              description="The database did not return activity logs for this role or workspace. RLS may allow only your own relevant activity, or the foundation migration may still need to be applied."
            />
          ) : visibleActivityLogs.length ? (
            <div className="settings-activity-list">
              {visibleActivityLogs.map((log) => (
                <article className="settings-activity-item" key={log.id}>
                  <div className="settings-activity-main">
                    <strong>{humanizeAction(log.action)}</strong>
                    <span>{getActivityMetadataSummary(log, activeProperties)}</span>
                  </div>
                  <div className="settings-activity-meta">
                    <span>{getActivityActorName(log, members, currentUser)}</span>
                    <span>{workspaceName}</span>
                    <time dateTime={log.created_at || log.createdAt}>{formatDate(log.created_at || log.createdAt)}</time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={History}
              title={activityFilter === 'all' ? 'No activity logs yet' : 'No matching activity'}
              description="Safe audit events will appear here after authorized users create or update records in this workspace."
            />
          )}
        </section>
      ) : (
        <section className="card">
          <EmptyState
            compact
            icon={ShieldCheck}
            title="Activity history is restricted"
            description="Broad workspace audit history is visible to Workspace Owners / Company Admins and Property Managers when Supabase RLS allows it."
          />
        </section>
      )}

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
                    render: (row) => roleBadges(row.roles),
                  },
                  {
                    key: 'assigned_properties',
                    label: 'Assigned properties',
                    render: (row) => getMemberPropertySummary(row, propertyAssignments, activeProperties),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusBadge tone={getStatusTone(row.status || 'active')}>{row.status || 'active'}</StatusBadge>,
                  },
                  {
                    key: 'created_at',
                    label: 'Joined',
                    render: (row) => formatDate(row.created_at),
                  },
                  {
                    key: 'actions',
                    label: 'Actions',
                    render: (row) =>
                      canManageMembers ? (
                        <div className="table-actions">
                          {row.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => updateMemberStatus(row.id, 'suspended')}
                              disabled={memberBusyId === row.id}
                              data-skip-create-action="true"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateMemberStatus(row.id, 'active')}
                              disabled={memberBusyId === row.id}
                              data-skip-create-action="true"
                            >
                              Reactivate
                            </button>
                          )}
                          {row.status !== 'revoked' && (
                            <button
                              type="button"
                              onClick={() => updateMemberStatus(row.id, 'revoked')}
                              disabled={memberBusyId === row.id}
                              data-skip-create-action="true"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ) : (
                        'Role editing will be added after team lifecycle controls are fully tested.'
                      ),
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
                      render: (row) => roleBadges(row.roles),
                    },
                    {
                      key: 'assigned_property_ids',
                      label: 'Assigned properties',
                      render: (row) => summarizeProperties(activeProperties, row.assigned_property_ids || row.assignedPropertyIds),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (row) => {
                        const status = getInviteStatus(row);
                        return <StatusBadge tone={getStatusTone(status)}>{status}</StatusBadge>;
                      },
                    },
                    {
                      key: 'expires_at',
                      label: 'Expires',
                      render: (row) => formatDate(row.expires_at),
                    },
                    {
                      key: 'actions',
                      label: 'Actions',
                      render: (row) => (
                        <div className="table-actions">
                          {getInviteStatus(row) === 'pending' && (
                            <button
                              type="button"
                              onClick={() => revokeInvite(row.id)}
                              disabled={inviteBusyId === row.id}
                              data-skip-create-action="true"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      ),
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
              <p>Assign active workspace members to property-specific access. Assignment roles must match the member’s current role.</p>
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
            {propertyAssignments.length ? (
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
