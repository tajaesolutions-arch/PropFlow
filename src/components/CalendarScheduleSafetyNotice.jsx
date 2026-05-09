import React from 'react';
import { CalendarDays, ClipboardCheck, Clock, Home, LockKeyhole, ShieldCheck, Wrench } from 'lucide-react';

import { roles } from '../data/constants.js';
import { hasAnyRole, resolvePrimaryRole } from '../lib/auth.js';
import { useApp } from '../lib/AppContext.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const operationsRoles = [roles.ADMIN, roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const ownerScheduleRoles = [roles.OWNER];
const cleanerScheduleRoles = [roles.CLEANER];
const maintenanceScheduleRoles = [roles.MAINTENANCE];

function count(array) {
  return Array.isArray(array) ? array.length : 0;
}

function getRecordPropertyId(record) {
  return record?.propertyId || record?.property_id || '';
}

function getAssignedOwnerId(property) {
  return (
    property?.assignedOwnerId ||
    property?.assigned_owner_id ||
    property?.ownerId ||
    property?.owner_id ||
    ''
  );
}

function getAssignedCleanerId(task) {
  return task?.assignedCleanerId || task?.assigned_cleaner_id || task?.cleanerId || task?.cleaner_id || '';
}

function getAssignedMaintenanceId(workOrder) {
  return (
    workOrder?.assignedMaintenanceId ||
    workOrder?.assigned_maintenance_id ||
    workOrder?.maintenanceId ||
    workOrder?.maintenance_id ||
    ''
  );
}

function hasAssignmentData(records, getter) {
  return Array.isArray(records) && records.some((record) => Boolean(getter(record)));
}

function getOwnerAssignedPropertyIds(properties = [], currentUser) {
  return new Set(
    properties
      .filter((property) => getAssignedOwnerId(property) === currentUser?.id)
      .map((property) => property.id)
      .filter(Boolean),
  );
}

function getVisibleScheduleRecords({ data, currentUser }) {
  const bookings = [...(data?.bookings || []), ...(data?.leases || [])];
  const cleaningTasks = data?.cleaningTasks || [];
  const maintenanceWorkOrders = data?.maintenanceWorkOrders || [];
  const properties = data?.properties || [];

  if (hasAnyRole(currentUser, operationsRoles)) {
    return {
      bookings,
      cleaningTasks,
      maintenanceWorkOrders,
      visibilityLabel: 'workspace records',
    };
  }

  if (hasAnyRole(currentUser, ownerScheduleRoles)) {
    const assignedPropertyIds = getOwnerAssignedPropertyIds(properties, currentUser);

    return {
      bookings: bookings.filter((booking) => assignedPropertyIds.has(getRecordPropertyId(booking))),
      cleaningTasks: cleaningTasks.filter((task) => assignedPropertyIds.has(getRecordPropertyId(task))),
      maintenanceWorkOrders: maintenanceWorkOrders.filter((workOrder) =>
        assignedPropertyIds.has(getRecordPropertyId(workOrder)),
      ),
      visibilityLabel: 'assigned-property records',
    };
  }

  if (hasAnyRole(currentUser, cleanerScheduleRoles)) {
    const hasCleanerData = hasAssignmentData(cleaningTasks, getAssignedCleanerId);
    const visibleCleaningTasks = hasCleanerData
      ? cleaningTasks.filter((task) => getAssignedCleanerId(task) === currentUser?.id)
      : cleaningTasks;
    const visiblePropertyIds = new Set(visibleCleaningTasks.map(getRecordPropertyId).filter(Boolean));

    return {
      bookings: bookings.filter((booking) => visiblePropertyIds.has(getRecordPropertyId(booking))),
      cleaningTasks: visibleCleaningTasks,
      maintenanceWorkOrders: [],
      visibilityLabel: hasCleanerData ? 'assigned cleaning records' : 'cleaning records',
    };
  }

  if (hasAnyRole(currentUser, maintenanceScheduleRoles)) {
    const hasMaintenanceData = hasAssignmentData(maintenanceWorkOrders, getAssignedMaintenanceId);
    const visibleMaintenanceWorkOrders = hasMaintenanceData
      ? maintenanceWorkOrders.filter((workOrder) => getAssignedMaintenanceId(workOrder) === currentUser?.id)
      : maintenanceWorkOrders;

    return {
      bookings: [],
      cleaningTasks: [],
      maintenanceWorkOrders: visibleMaintenanceWorkOrders,
      visibilityLabel: hasMaintenanceData ? 'assigned work-order records' : 'maintenance records',
    };
  }

  return {
    bookings: [],
    cleaningTasks: [],
    maintenanceWorkOrders: [],
    visibilityLabel: 'restricted records',
  };
}

function getRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, operationsRoles)) {
    return 'Operational roles can view workspace schedules when records are scoped to the active workspace.';
  }

  if (hasAnyRole(currentUser, ownerScheduleRoles)) {
    return 'Property Owners see schedule counts for assigned properties only.';
  }

  if (hasAnyRole(currentUser, cleanerScheduleRoles)) {
    return 'Cleaners see assigned cleaning schedules and relevant turnover context only.';
  }

  if (hasAnyRole(currentUser, maintenanceScheduleRoles)) {
    return 'Maintenance users see assigned work-order due dates and relevant repair context only.';
  }

  return 'Calendar visibility should remain restricted until role and assignment rules are confirmed.';
}

export function CalendarScheduleSafetyNotice() {
  const { currentUser, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const visibleScheduleRecords = getVisibleScheduleRecords({ data, currentUser });
  const bookingsCount = count(visibleScheduleRecords.bookings);
  const cleaningCount = count(visibleScheduleRecords.cleaningTasks);
  const maintenanceCount = count(visibleScheduleRecords.maintenanceWorkOrders);
  const hasAnyScheduleRecords = bookingsCount + cleaningCount + maintenanceCount > 0;

  return (
    <section className="card calendar-schedule-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Calendar and schedule safety</p>
          <h3>Schedule readiness and visibility</h3>
          <p>
            Schedule counts are scoped to the current role. External calendar integrations and iCal imports are intentionally not connected yet.
          </p>
        </div>
        <CalendarDays size={22} className="muted" />
      </div>

      <div className="calendar-schedule-grid">
        <div className="calendar-schedule-card">
          <CalendarDays size={18} />
          <span>
            <strong>Calendar data</strong>
            <small>{hasAnyScheduleRecords ? 'Visible schedule records exist for this role.' : 'No visible bookings, leases, cleaning tasks, or maintenance due dates found yet.'}</small>
          </span>
          <StatusBadge tone={hasAnyScheduleRecords ? 'info' : 'warning'}>{hasAnyScheduleRecords ? visibleScheduleRecords.visibilityLabel : 'empty state'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <Clock size={18} />
          <span>
            <strong>Bookings and check-ins</strong>
            <small>Upcoming bookings, check-ins, and check-outs should come from visible booking or lease records only.</small>
          </span>
          <StatusBadge tone={bookingsCount ? 'info' : 'warning'}>{bookingsCount ? `${bookingsCount} visible` : 'none visible'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <ClipboardCheck size={18} />
          <span>
            <strong>Cleaning schedule</strong>
            <small>Cleaner views should show only assigned cleaning tasks and relevant turnover context.</small>
          </span>
          <StatusBadge tone={cleaningCount ? 'info' : 'warning'}>{cleaningCount ? `${cleaningCount} visible` : 'none visible'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <Wrench size={18} />
          <span>
            <strong>Maintenance due dates</strong>
            <small>Maintenance views should show only assigned work orders and due-date reminders.</small>
          </span>
          <StatusBadge tone={maintenanceCount ? 'info' : 'warning'}>{maintenanceCount ? `${maintenanceCount} visible` : 'none visible'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <ShieldCheck size={18} />
          <span>
            <strong>Role visibility</strong>
            <small>{getRoleMessage(currentUser)}</small>
          </span>
          <StatusBadge tone="info">{primaryRole || 'role checked'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <Home size={18} />
          <span>
            <strong>External calendars</strong>
            <small>iCal imports, Airbnb, Booking.com, Vrbo, and external sync should stay disabled until backend sync is implemented.</small>
          </span>
          <StatusBadge tone="warning">not connected</StatusBadge>
        </div>
      </div>

      <div className="helper calendar-schedule-helper">
        <LockKeyhole size={16} />
        Before adding external calendar sync, enforce workspace_id scoping, assigned-property filtering, role visibility, duplicate protection, and safe import error handling.
      </div>
    </section>
  );
}
