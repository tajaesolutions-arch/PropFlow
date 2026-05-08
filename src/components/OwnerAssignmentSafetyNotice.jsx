import React from 'react';
import { Building2, Eye, FileText, LockKeyhole, ShieldCheck, UserRound, Wrench } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const assignmentManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const ownerRole = [roles.OWNER];

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function getAssignedOwnerId(property) {
  return property?.assignedOwnerId || property?.assigned_owner_id || property?.ownerId || property?.owner_id || '';
}

function getOwnerAssignmentMessage(currentUser) {
  if (hasAnyRole(currentUser, assignmentManagerRoles)) {
    return 'Workspace Owners, Property Managers, and Hosts may view assignment status and prepare owner-property assignments when backend rules are connected.';
  }

  if (hasAnyRole(currentUser, ownerRole)) {
    return 'Property Owners should only see properties explicitly assigned to their owner account.';
  }

  return 'Owner/property assignment visibility should remain restricted unless the role has a clear operational reason.';
}

export function OwnerAssignmentSafetyNotice() {
  const { currentUser, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const properties = Array.isArray(data?.properties) ? data.properties : [];
  const ownerReports = Array.isArray(data?.ownerReports) ? data.ownerReports : [];
  const assignedPropertiesCount = properties.filter((property) => Boolean(getAssignedOwnerId(property))).length;
  const unassignedPropertiesCount = Math.max(properties.length - assignedPropertiesCount, 0);
  const canManageAssignments = hasAnyRole(currentUser, assignmentManagerRoles);
  const isOwner = hasAnyRole(currentUser, ownerRole);

  return (
    <section className="card owner-assignment-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Owner/property assignment safety</p>
          <h3>Assigned-property visibility and owner access</h3>
          <p>
            Owner-facing screens should only show assigned-property data. Assignment controls stay placeholder-safe until backend ownership rules and RLS are implemented.
          </p>
        </div>
        <UserRound size={22} className="muted" />
      </div>

      <div className="owner-assignment-grid">
        <div className="owner-assignment-card">
          <Building2 size={18} />
          <span>
            <strong>Assigned properties</strong>
            <small>{assignedPropertiesCount ? `${assignedPropertiesCount} property record${assignedPropertiesCount === 1 ? '' : 's'} include owner assignment fields.` : 'No owner-assigned property records found yet. Owner dashboards should show a clean empty state.'}</small>
          </span>
          <StatusBadge tone={assignedPropertiesCount ? 'info' : 'warning'}>{assignedPropertiesCount ? 'assignment fields' : 'empty'}</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <LockKeyhole size={18} />
          <span>
            <strong>Unassigned property data</strong>
            <small>Property Owners must not see unassigned properties, operational records, reports, or private workspace data.</small>
          </span>
          <StatusBadge tone={unassignedPropertiesCount && isOwner ? 'error' : 'info'}>{unassignedPropertiesCount} unassigned</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <Eye size={18} />
          <span>
            <strong>Owner access mode</strong>
            <small>Owner portals should remain view-only. Owners should not edit bookings, cleaning, maintenance, reports, or property operations.</small>
          </span>
          <StatusBadge tone="warning">view-only</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <FileText size={18} />
          <span>
            <strong>Owner reports</strong>
            <small>{ownerReports.length ? `${ownerReports.length} owner report record${ownerReports.length === 1 ? '' : 's'} found. Reports must stay assigned-property scoped.` : 'Owner report visibility remains placeholder-safe until report publishing is connected.'}</small>
          </span>
          <StatusBadge tone={ownerReports.length ? 'info' : 'warning'}>{ownerReports.length ? 'scope required' : 'placeholder'}</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <Wrench size={18} />
          <span>
            <strong>Operational records</strong>
            <small>Maintenance, cleaning, booking, and expense records must be filtered to assigned properties for owner views.</small>
          </span>
          <StatusBadge tone="info">assigned scope</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{getOwnerAssignmentMessage(currentUser)}</small>
          </span>
          <StatusBadge tone={canManageAssignments ? 'success' : 'info'}>{primaryRole || 'role checked'}</StatusBadge>
        </div>
      </div>

      <div className="helper owner-assignment-helper">
        <LockKeyhole size={16} />
        Before enabling real assignments, enforce owner_id/property_id scoping, assigned-property filters, view-only owner permissions, report scope checks, and Supabase RLS.
      </div>
    </section>
  );
}
