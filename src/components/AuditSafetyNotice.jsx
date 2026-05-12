import React from 'react';
import { Activity, Eye, LockKeyhole, ShieldCheck, UserRound, Users } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const platformAuditRoles = [roles.ADMIN];
const workspaceAuditRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const staffSelfAuditRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE, roles.ACCOUNTANT];

function getAuditVisibilityMessage(currentUser) {
  if (hasAnyRole(currentUser, platformAuditRoles)) {
    return 'PropFlow Admin should eventually see platform-wide audit events across workspaces, with strict internal-only access.';
  }

  if (hasAnyRole(currentUser, workspaceAuditRoles)) {
    return 'Workspace leaders should eventually see audit events scoped only to their active workspace.';
  }

  if (hasAnyRole(currentUser, staffSelfAuditRoles)) {
    return 'Staff and property owners should only see their own relevant activity or assigned-record history.';
  }

  return 'Audit visibility should remain restricted until role rules are fully implemented.';
}

export function AuditSafetyNotice() {
  const { currentUser } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const isPlatformAuditRole = hasAnyRole(currentUser, platformAuditRoles);
  const isWorkspaceAuditRole = hasAnyRole(currentUser, workspaceAuditRoles);

  return (
    <section className="card audit-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Activity log and audit history</p>
          <h3>Audit logging safety status</h3>
          <p>
            Audit history is setup-gated until real append-only audit logging, workspace scoping,
            and role-based audit visibility are implemented in the backend.
          </p>
        </div>
        <Activity size={22} className="muted" />
      </div>

      <div className="audit-safety-grid">
        <div className="audit-safety-card">
          <Activity size={18} />
          <span>
            <strong>Current audit state</strong>
            <small>No real audit events are being created from this UI. Activity log tables should remain empty-state safe.</small>
          </span>
          <StatusBadge tone="warning">not connected</StatusBadge>
        </div>

        <div className="audit-safety-card">
          <LockKeyhole size={18} />
          <span>
            <strong>Workspace scoping</strong>
            <small>Every future audit event must include workspace_id unless it is an internal platform-level event.</small>
          </span>
          <StatusBadge tone="warning">required</StatusBadge>
        </div>

        <div className="audit-safety-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{getAuditVisibilityMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={isPlatformAuditRole || isWorkspaceAuditRole ? 'info' : 'warning'}>
            {primaryRole || 'restricted'}
          </StatusBadge>
        </div>
      </div>

      <div className="audit-visibility-grid" aria-label="Audit visibility setup states">
        <div className="audit-visibility-card">
          <ShieldCheck size={17} />
          <span>
            <strong>PropFlow Admin audit view</strong>
            <small>Platform-wide audit visibility should be internal-only and never exposed to customer roles.</small>
          </span>
          <StatusBadge tone={isPlatformAuditRole ? 'success' : 'info'}>platform setup state</StatusBadge>
        </div>

        <div className="audit-visibility-card">
          <Users size={17} />
          <span>
            <strong>Workspace Owner audit view</strong>
            <small>Workspace audit history should show only events for the active workspace/company.</small>
          </span>
          <StatusBadge tone="info">workspace setup state</StatusBadge>
        </div>

        <div className="audit-visibility-card">
          <UserRound size={17} />
          <span>
            <strong>Staff self-activity view</strong>
            <small>Cleaners, maintenance users, and property owners should only see assigned or self-related events.</small>
          </span>
          <StatusBadge tone="info">self only</StatusBadge>
        </div>
      </div>

      <div className="helper audit-safety-helper">
        <Eye size={16} />
        Do not display cross-workspace activity, customer-wide platform logs, or audit records before backend RLS and append-only logging are implemented.
      </div>
    </section>
  );
}
