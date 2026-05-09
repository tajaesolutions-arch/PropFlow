import React from 'react';
import { Building2, Eye, FileText, LockKeyhole, ShieldCheck, UserRound, Wrench } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const assignmentManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const ownerRole = [roles.OWNER];

function getAssignedOwnerId(property) {
  return property?.assignedOwnerId || property?.assigned_owner_id || property?.ownerId || property?.owner_id || '';
}

function getRecordPropertyId(record) {
  return record?.propertyId || record?.property_id || '';
}

function getReportOwnerId(report) {
  return report?.ownerId || report?.owner_id || report?.contactId || report?.contact_id || '';
}

function getVisibleOwnerAssignmentData({ properties = [], ownerReports = [], currentUser }) {
  if (hasAnyRole(currentUser, assignmentManagerRoles)) {
    const assignedProperties = properties.filter((property) => Boolean(getAssignedOwnerId(property)));

    return {
      properties,
      assignedProperties,
      unassignedPropertiesCount: Math.max(properties.length - assignedProperties.length, 0),
      ownerReports,
      visibilityLabel: 'workspace assignment view',
    };
  }

  if (hasAnyRole(currentUser, ownerRole)) {
    const assignedProperties = properties.filter((property) => getAssignedOwnerId(property) === currentUser?.id);
    const assignedPropertyIds = new Set(assignedProperties.map((property) => property.id).filter(Boolean));
    const visibleOwnerReports = ownerReports.filter((report) => {
      const propertyId = getRecordPropertyId(report);
      const reportOwnerId = getReportOwnerId(report);

      if (propertyId) return assignedPropertyIds.has(propertyId);
      if (reportOwnerId) return reportOwnerId === currentUser?.id;

      return false;
    });

    return {
      properties: assignedProperties,
      assignedProperties,
      unassignedPropertiesCount: 0,
      ownerReports: visibleOwnerReports,
      visibilityLabel: 'assigned owner view',
    };
  }

  return {
    properties: [],
    assignedProperties: [],
    unassignedPropertiesCount: 0,
    ownerReports: [],
    visibilityLabel: 'restricted view',
  };
}

function getOwnerAssignmentMessage(currentUser) {
  if (hasAnyRole(currentUser, assignmentManagerRoles)) {
    return 'Workspace Owners, Property Managers, and Hosts may view assignment status and prepare owner-property assignments when backend rules are connected.';
  }

  if (hasAnyRole(currentUser, ownerRole)) {
    return 'Property Owners see assignment status for properties explicitly assigned to their owner account only.';
  }

  return 'Owner/property assignment visibility should remain restricted unless the role has a clear operational reason.';
}

export function OwnerAssignmentSafetyNotice() {
  const { currentUser, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const allProperties = Array.isArray(data?.properties) ? data.properties : [];
  const allOwnerReports = Array.isArray(data?.ownerReports) ? data.ownerReports : [];
  const visibleData = getVisibleOwnerAssignmentData({
    properties: allProperties,
    ownerReports: allOwnerReports,
    currentUser,
  });
  const assignedPropertiesCount = visibleData.assignedProperties.length;
  const unassignedPropertiesCount = visibleData.unassignedPropertiesCount;
  const ownerReportsCount = visibleData.ownerReports.length;
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
            <strong>{isOwner ? 'Assigned properties visible' : 'Assigned properties'}</strong>
            <small>{assignedPropertiesCount ? `${assignedPropertiesCount} visible property record${assignedPropertiesCount === 1 ? '' : 's'} include owner assignment fields.` : isOwner ? 'No properties are assigned to this owner account yet.' : 'No owner-assigned property records found yet. Owner dashboards should show a clean empty state.'}</small>
          </span>
          <StatusBadge tone={assignedPropertiesCount ? 'info' : 'warning'}>{assignedPropertiesCount ? visibleData.visibilityLabel : 'empty'}</StatusBadge>
        </div>

        <div className="owner-assignment-card">
          <LockKeyhole size={18} />
          <span>
            <strong>Unassigned property data</strong>
            <small>{isOwner ? 'Unassigned workspace property counts stay hidden from owner-facing views.' : 'Property Owners must not see unassigned properties, operational records, reports, or private workspace data.'}</small>
          </span>
          <StatusBadge tone={unassignedPropertiesCount && isOwner ? 'error' : 'info'}>
            {isOwner ? 'hidden' : `${unassignedPropertiesCount} unassigned`}
          </StatusBadge>
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
            <small>{ownerReportsCount ? `${ownerReportsCount} visible owner report record${ownerReportsCount === 1 ? '' : 's'} found. Reports must stay assigned-property scoped.` : 'Owner report visibility remains placeholder-safe until report publishing is connected.'}</small>
          </span>
          <StatusBadge tone={ownerReportsCount ? 'info' : 'warning'}>{ownerReportsCount ? 'visible scope' : 'placeholder'}</StatusBadge>
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
