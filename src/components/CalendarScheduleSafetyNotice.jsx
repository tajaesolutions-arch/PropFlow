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

function getRoleMessage(currentUser) {
  if (hasAnyRole(currentUser, operationsRoles)) {
    return 'Operational roles can view workspace schedules when records are scoped to the active workspace.';
  }

  if (hasAnyRole(currentUser, ownerScheduleRoles)) {
    return 'Property Owners should only see calendars for assigned properties and owner-visible records.';
  }

  if (hasAnyRole(currentUser, cleanerScheduleRoles)) {
    return 'Cleaners should only see assigned cleaning schedules and relevant check-in/check-out context.';
  }

  if (hasAnyRole(currentUser, maintenanceScheduleRoles)) {
    return 'Maintenance users should only see assigned work orders, due dates, and relevant property access notes.';
  }

  return 'Calendar visibility should remain restricted until role and assignment rules are confirmed.';
}

export function CalendarScheduleSafetyNotice() {
  const { currentUser, data } = useApp();
  const primaryRole = resolvePrimaryRole(currentUser);
  const bookingsCount = count(data?.bookings) + count(data?.leases);
  const cleaningCount = count(data?.cleaningTasks);
  const maintenanceCount = count(data?.maintenanceWorkOrders);
  const hasAnyScheduleRecords = bookingsCount + cleaningCount + maintenanceCount > 0;

  return (
    <section className="card calendar-schedule-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Calendar and schedule safety</p>
          <h3>Schedule readiness and visibility</h3>
          <p>
            Calendar views use current workspace records only. External calendar integrations and iCal imports are intentionally not connected yet.
          </p>
        </div>
        <CalendarDays size={22} className="muted" />
      </div>

      <div className="calendar-schedule-grid">
        <div className="calendar-schedule-card">
          <CalendarDays size={18} />
          <span>
            <strong>Calendar data</strong>
            <small>{hasAnyScheduleRecords ? 'Schedule records exist for this workspace.' : 'No bookings, leases, cleaning tasks, or maintenance due dates found yet.'}</small>
          </span>
          <StatusBadge tone={hasAnyScheduleRecords ? 'info' : 'warning'}>{hasAnyScheduleRecords ? 'workspace records' : 'empty state'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <Clock size={18} />
          <span>
            <strong>Bookings and check-ins</strong>
            <small>Upcoming bookings, check-ins, and check-outs should come from real workspace booking or lease records.</small>
          </span>
          <StatusBadge tone={bookingsCount ? 'info' : 'warning'}>{bookingsCount ? `${bookingsCount} records` : 'placeholder'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <ClipboardCheck size={18} />
          <span>
            <strong>Cleaning schedule</strong>
            <small>Cleaner views should show only assigned cleaning tasks and relevant turnover context.</small>
          </span>
          <StatusBadge tone={cleaningCount ? 'info' : 'warning'}>{cleaningCount ? `${cleaningCount} tasks` : 'placeholder'}</StatusBadge>
        </div>

        <div className="calendar-schedule-card">
          <Wrench size={18} />
          <span>
            <strong>Maintenance due dates</strong>
            <small>Maintenance views should show only assigned work orders and due-date reminders.</small>
          </span>
          <StatusBadge tone={maintenanceCount ? 'info' : 'warning'}>{maintenanceCount ? `${maintenanceCount} work orders` : 'placeholder'}</StatusBadge>
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
