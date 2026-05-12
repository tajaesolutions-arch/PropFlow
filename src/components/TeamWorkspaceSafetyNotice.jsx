import React from 'react';
import { AlertTriangle, Clock, KeyRound, LockKeyhole, Mail, ShieldCheck, UserCheck, Users } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const teamManagerRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const teamViewerRoles = [roles.HOST, roles.ACCOUNTANT];
const restrictedRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function getRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, [roles.ADMIN])) {
    return 'PropFlow Admin should see platform-level workspace/team safety status, not customer invite secrets.';
  }

  if (hasAnyRole(currentUser, [roles.OWNER_ADMIN])) {
    return 'Workspace Owners can manage team members, role assignments, suspensions, and invite recovery for their workspace.';
  }

  if (hasAnyRole(currentUser, [roles.PROPERTY_MANAGER])) {
    return 'Property Managers may help manage operational team access if workspace permissions allow it.';
  }

  if (hasAnyRole(currentUser, teamViewerRoles)) {
    return 'Hosts and Accountants should see limited workspace/team context, not full invite or permission controls.';
  }

  if (hasAnyRole(currentUser, restrictedRoles)) {
    return 'Owners, cleaners, and maintenance users should not manage workspace membership or invite links.';
  }

  return 'Team visibility should stay restricted until workspace membership and role rules are confirmed.';
}

export function TeamWorkspaceSafetyNotice() {
  const { currentUser, currentWorkspace, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const membersCount = count(data?.members);
  const canManageTeam = hasAnyRole(currentUser, teamManagerRoles);
  const canViewLimitedTeam = canManageTeam || hasAnyRole(currentUser, teamViewerRoles);
  const workspaceName = currentWorkspace?.name || currentWorkspace?.business_name || 'current workspace';

  return (
    <section className="card team-workspace-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Workspace and team safety</p>
          <h3>Team management readiness for {workspaceName}</h3>
          <p>
            Team and invite UI is setup-gated until invite email delivery, invite-token handling,
            suspension controls, and backend role enforcement are fully connected.
          </p>
        </div>
        <Users size={22} className="muted" />
      </div>

      <div className="team-workspace-grid">
        <div className="team-workspace-card">
          <Users size={18} />
          <span>
            <strong>Workspace members</strong>
            <small>{membersCount ? `${membersCount} member record${membersCount === 1 ? '' : 's'} available for this workspace.` : 'No workspace member records found yet. Show a clean empty state and invite setup state.'}</small>
          </span>
          <StatusBadge tone={membersCount ? 'info' : 'warning'}>{membersCount ? 'workspace scoped' : 'empty'}</StatusBadge>
        </div>

        <div className="team-workspace-card">
          <Mail size={18} />
          <span>
            <strong>Invite team member</strong>
            <small>Invite emails are not connected yet. Do not expose invite tokens, raw workspace codes, or secret links in the UI.</small>
          </span>
          <StatusBadge tone="warning">setup state</StatusBadge>
        </div>

        <div className="team-workspace-card">
          <Clock size={18} />
          <span>
            <strong>Invite status</strong>
            <small>Pending, accepted, and expired invite states should remain setup states until invite records are connected.</small>
          </span>
          <StatusBadge tone="info">pending model</StatusBadge>
        </div>

        <div className="team-workspace-card">
          <AlertTriangle size={18} />
          <span>
            <strong>Suspended users</strong>
            <small>Suspended users should only access account recovery or suspension information, not workspace operations.</small>
          </span>
          <StatusBadge tone="warning">policy setup state</StatusBadge>
        </div>

        <div className="team-workspace-card">
          <KeyRound size={18} />
          <span>
            <strong>Workspace code / invite link</strong>
            <small>Join codes should require a matching invite for the user email. Never display raw invite secrets.</small>
          </span>
          <StatusBadge tone="warning">secret-safe</StatusBadge>
        </div>

        <div className="team-workspace-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{getRoleMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={canViewLimitedTeam ? 'info' : 'error'}>{primaryRole || 'restricted'}</StatusBadge>
        </div>
      </div>

      <div className="team-role-grid" aria-label="Team role permission setup states">
        <div className="team-role-card">
          <UserCheck size={17} />
          <span>
            <strong>Workspace Owner / Property Manager</strong>
            <small>Can manage team access when backend invite and suspension controls are connected.</small>
          </span>
          <StatusBadge tone={canManageTeam ? 'success' : 'info'}>manage</StatusBadge>
        </div>

        <div className="team-role-card">
          <Users size={17} />
          <span>
            <strong>Host / Accountant</strong>
            <small>Limited team context only. Avoid full permission editing unless explicitly granted later.</small>
          </span>
          <StatusBadge tone="info">limited</StatusBadge>
        </div>

        <div className="team-role-card">
          <LockKeyhole size={17} />
          <span>
            <strong>Owner / Cleaner / Maintenance Crew</strong>
            <small>No workspace invite management. Access should stay task/property assignment based.</small>
          </span>
          <StatusBadge tone="warning">restricted</StatusBadge>
        </div>
      </div>

      <div className="helper team-workspace-helper">
        <LockKeyhole size={16} />
        Before enabling invites, enforce workspace_id scoping, invite expiry, matching invitee email, fixed MVP role permissions, and suspension checks server-side.
      </div>
    </section>
  );
}
