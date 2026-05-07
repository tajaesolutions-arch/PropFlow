import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  FileText,
  Percent,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatPercent } from '../lib/formatters.js';
import { roles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const closedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getBookingAmount(booking) {
  return toNumber(booking.totalAmount || booking.total_amount || booking.amount);
}

function getMaintenanceCost(workOrder) {
  return toNumber(
    workOrder.actualCost ||
      workOrder.actual_cost ||
      workOrder.estimatedCost ||
      workOrder.estimated_cost,
  );
}

function getCleaningCost(task) {
  return toNumber(
    task.actualCost ||
      task.actual_cost ||
      task.estimatedCost ||
      task.estimated_cost ||
      task.cleaningFee ||
      task.cleaning_fee,
  );
}

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function daysBetween(start, end) {
  const startDate = getDateValue(start);
  const endDate = getDateValue(end);

  if (!startDate || !endDate || endDate <= startDate) {
    return 0;
  }

  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function getBookingNights(booking) {
  return daysBetween(booking.checkIn || booking.check_in, booking.checkOut || booking.check_out);
}

function isOwnerRole(currentUser) {
  return currentUser?.roles?.includes(roles.OWNER);
}

function isAssignedToCurrentOwner(property, currentUser) {
  if (!isOwnerRole(currentUser)) return true;

  const assignedOwnerId =
    property.assignedOwnerId ||
    property.assigned_owner_id ||
    property.ownerId ||
    property.owner_id;

  if (!assignedOwnerId) return false;

  return assignedOwnerId === currentUser?.id;
}

function buildOwnerPropertyRows({ properties, bookings, maintenanceWorkOrders, cleaningTasks, currency }) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
    const propertyMaintenance = maintenanceWorkOrders.filter(
      (workOrder) => getPropertyId(workOrder) === property.id,
    );
    const propertyCleaning = cleaningTasks.filter((task) => getPropertyId(task) === property.id);

    const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
    const maintenanceCost = propertyMaintenance.reduce(
      (sum, workOrder) => sum + getMaintenanceCost(workOrder),
      0,
    );
    const cleaningCost = propertyCleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
    const expenses = maintenanceCost + cleaningCost;
    const netProfit = revenue - expenses;
    const openMaintenance = propertyMaintenance.filter(
      (workOrder) => !closedStatuses.has(workOrder.status),
    ).length;
    const bookedNights = propertyBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
    const occupancy = Math.min((bookedNights / 30) * 100, 100);

    return {
      ...property,
      currency: property.currency || currency,
      revenue,
      expenses,
      netProfit,
      maintenanceCost,
      cleaningCost,
      openMaintenance,
      bookings: propertyBookings.length,
      occupancy,
    };
  });
}

export function OwnerDashboardPage() {
  const { data, currentWorkspace, currentUser } = useApp();

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const assignedProperties = (data.properties || [])
    .filter((property) => property.status !== 'archived')
    .filter((property) => isAssignedToCurrentOwner(property, currentUser));

  const assignedPropertyIds = new Set(assignedProperties.map((property) => property.id));

  const assignedBookings = (data.bookings || []).filter(
    (booking) => assignedPropertyIds.has(getPropertyId(booking)) && !cancelledStatuses.has(booking.status),
  );

  const assignedCleaningTasks = (data.cleaningTasks || []).filter((task) =>
    assignedPropertyIds.has(getPropertyId(task)),
  );

  const assignedMaintenance = (data.maintenanceWorkOrders || []).filter((workOrder) =>
    assignedPropertyIds.has(getPropertyId(workOrder)),
  );

  const assignedReports = (data.ownerReports || []).filter((report) => {
    const propertyId = getPropertyId(report);
    return !propertyId || assignedPropertyIds.has(propertyId);
  });

  const propertyRows = buildOwnerPropertyRows({
    properties: assignedProperties,
    bookings: assignedBookings,
    maintenanceWorkOrders: assignedMaintenance,
    cleaningTasks: assignedCleaningTasks,
    currency,
  });

  const grossRevenue = propertyRows.reduce((sum, property) => sum + property.revenue, 0);
  const totalExpenses = propertyRows.reduce((sum, property) => sum + property.expenses, 0);
  const netProfit = grossRevenue - totalExpenses;
  const ownerPayout = assignedBookings.reduce(
    (sum, booking) => sum + toNumber(booking.ownerPayout || booking.owner_payout),
    0,
  );

  const bookedNights = assignedBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
  const availableNights = Math.max(assignedProperties.length * 30, 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const openMaintenance = assignedMaintenance.filter(
    (workOrder) => !closedStatuses.has(workOrder.status),
  );

  const completedCleaning = assignedCleaningTasks.filter((task) =>
    ['completed', 'guest_ready'].includes(task.status),
  );

  return (
    <AppLayout title="Owner dashboard" subtitle="View-only property performance and owner updates">
      <p className="page-note">
        Property owners only see assigned properties, revenue, expenses, owner payout, maintenance
        updates, cleaning history, reports, and property health information.
      </p>

      <div className="stat-grid dense">
        <StatCard
          label="Gross revenue"
          value={formatCurrency(grossRevenue, currency)}
          icon={Banknote}
        />

        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, currency)}
          icon={Banknote}
          tone={netProfit >= 0 ? 'accent' : 'warning'}
        />

        <StatCard
          label="Occupancy rate"
          value={formatPercent(occupancyRate)}
          icon={Percent}
        />

        <StatCard
          label="Owner payout"
          value={formatCurrency(ownerPayout, currency)}
          icon={Banknote}
        />
      </div>

      {assignedProperties.length ? (
        <>
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Assigned properties</h3>
                <p>Financial and operational snapshot for properties assigned to this owner.</p>
              </div>
            </div>

            <DataTable
              rows={propertyRows}
              columns={[
                {
                  key: 'name',
                  label: 'Property',
                  render: (row) => (
                    <button
                      type="button"
                      className="link"
                      onClick={() => navigate(`/properties/${row.id}`)}
                    >
                      {row.name}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge>,
                },
                {
                  key: 'revenue',
                  label: 'Revenue',
                  render: (row) => formatCurrency(row.revenue, row.currency),
                },
                {
                  key: 'expenses',
                  label: 'Expenses',
                  render: (row) => formatCurrency(row.expenses, row.currency),
                },
                {
                  key: 'netProfit',
                  label: 'Net profit',
                  render: (row) => formatCurrency(row.netProfit, row.currency),
                },
                {
                  key: 'occupancy',
                  label: 'Occupancy',
                  render: (row) => formatPercent(row.occupancy),
                },
                {
                  key: 'openMaintenance',
                  label: 'Open maintenance',
                },
              ]}
            />
          </section>

          <div className="panel-grid two">
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Maintenance updates</h3>
                  <p>Open repairs and recent maintenance items.</p>
                </div>
                <Wrench size={20} />
              </div>

              {assignedMaintenance.length ? (
                assignedMaintenance.slice(0, 6).map((workOrder) => (
                  <div className="list-row" key={workOrder.id}>
                    <span>
                      {workOrder.title || 'Maintenance issue'}
                      <small>{workOrder.property || 'Assigned property'}</small>
                    </span>
                    <StatusBadge>{workOrder.status || workOrder.priority || 'reported'}</StatusBadge>
                  </div>
                ))
              ) : (
                <p>No maintenance updates yet.</p>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Cleaning history</h3>
                  <p>Completed and upcoming cleaning activity.</p>
                </div>
                <CalendarCheck size={20} />
              </div>

              {assignedCleaningTasks.length ? (
                assignedCleaningTasks.slice(0, 6).map((task) => (
                  <div className="list-row" key={task.id}>
                    <span>
                      {task.property || 'Assigned property'}
                      <small>{task.scheduledFor || task.scheduled_for || 'Not scheduled'}</small>
                    </span>
                    <StatusBadge>{task.status || 'scheduled'}</StatusBadge>
                  </div>
                ))
              ) : (
                <p>No cleaning history yet.</p>
              )}
            </section>
          </div>

          <div className="panel-grid two">
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Owner reports</h3>
                  <p>Reports prepared by the property manager.</p>
                </div>
                <FileText size={20} />
              </div>

              {assignedReports.length ? (
                assignedReports.slice(0, 6).map((report) => (
                  <div className="list-row" key={report.id}>
                    <span>
                      {report.title || 'Owner report'}
                      <small>{report.period || report.created_at || 'Report period not set'}</small>
                    </span>
                    <StatusBadge>{report.status || 'ready'}</StatusBadge>
                  </div>
                ))
              ) : (
                <p>No owner reports published yet.</p>
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Property health</h3>
                  <p>Simple view-only health indicators for assigned properties.</p>
                </div>
                <Building2 size={20} />
              </div>

              <div className="metadata-grid">
                <span>
                  <Building2 size={16} />
                  {assignedProperties.length} assigned properties
                </span>
                <span>
                  <CalendarCheck size={16} />
                  {completedCleaning.length} completed cleanings
                </span>
                <span>
                  <Wrench size={16} />
                  {openMaintenance.length} open repairs
                </span>
                <span>
                  <Banknote size={16} />
                  {formatCurrency(totalExpenses, currency)} expenses
                </span>
              </div>
            </section>
          </div>
        </>
      ) : (
        <EmptyState
          title="No assigned properties yet."
          description="Your property manager has not assigned properties to this owner account."
        />
      )}
    </AppLayout>
  );
}
