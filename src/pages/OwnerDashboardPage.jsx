import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  Eye,
  FileText,
  Percent,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate, formatPercent } from '../lib/formatters.js';
import { roles } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const closedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const ownerVisibleReportStatuses = new Set(['released', 'published', 'sent', 'delivered', 'completed']);

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyName(record, properties = []) {
  const propertyId = getPropertyId(record);
  const property = properties.find((item) => item.id === propertyId);

  return record?.property || property?.name || 'Assigned property';
}

function getBookingAmount(booking) {
  return toNumber(booking.totalAmount || booking.total_amount || booking.amount);
}

function getOwnerPayout(booking) {
  return toNumber(booking.ownerPayout || booking.owner_payout);
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

function getBookingCheckIn(booking) {
  return booking.checkIn || booking.check_in || '';
}

function getMaintenanceDue(workOrder) {
  return workOrder.due || workOrder.due_date || workOrder.created_at || '';
}

function getCleaningDate(task) {
  return task.scheduledFor || task.scheduled_for || task.created_at || '';
}

function isOwnerRole(currentUser) {
  return currentUser?.roles?.includes(roles.OWNER);
}

function getAssignedOwnerId(property) {
  return (
    property.assignedOwnerId ||
    property.assigned_owner_id ||
    property.ownerId ||
    property.owner_id ||
    ''
  );
}

function isAssignedToCurrentOwner(property, currentUser) {
  if (!isOwnerRole(currentUser)) return true;

  const assignedOwnerId = getAssignedOwnerId(property);

  if (!assignedOwnerId) return false;

  return assignedOwnerId === currentUser?.id;
}

function isOwnerVisibleReportStatus(report) {
  const status = String(report.status || '').toLowerCase();
  return ownerVisibleReportStatuses.has(status);
}

function canOwnerSeeReport(report, assignedPropertyIds, currentUser) {
  if (!isOwnerRole(currentUser)) return true;

  if (!isOwnerVisibleReportStatus(report)) return false;

  const propertyId = getPropertyId(report);
  const ownerId = report.owner_id || report.ownerId || report.contact_id || report.contactId;

  if (propertyId) return assignedPropertyIds.has(propertyId);
  if (ownerId) return ownerId === currentUser?.id;

  return false;
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();

  if (['cancelled', 'missed', 'urgent', 'overdue'].includes(status)) return 'error';
  if (['pending', 'scheduled', 'reported', 'in_progress', 'waiting_parts'].includes(status)) return 'warning';
  if (['active', 'confirmed', 'completed', 'guest_ready', 'released', 'published', 'sent', 'delivered'].includes(status)) return 'success';

  return 'info';
}

function buildOwnerPropertyRows({ properties, bookings, maintenanceWorkOrders, cleaningTasks, currency }) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
    const propertyMaintenance = maintenanceWorkOrders.filter(
      (workOrder) => getPropertyId(workOrder) === property.id,
    );
    const propertyCleaning = cleaningTasks.filter((task) => getPropertyId(task) === property.id);

    const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
    const ownerPayout = propertyBookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
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
      ownerPayout,
      expenses,
      netProfit,
      maintenanceCost,
      cleaningCost,
      openMaintenance,
      bookings: propertyBookings.length,
      bookedNights,
      occupancy,
    };
  });
}

function OwnerPropertyCard({ property }) {
  return (
    <article className="card owner-dashboard-property-card">
      <div className="owner-dashboard-property-top">
        <div className="owner-dashboard-property-icon">
          <Building2 size={22} />
        </div>

        <StatusBadge tone={statusTone(property.status || 'active')}>{property.status || 'active'}</StatusBadge>
      </div>

      <div>
        <h3>{property.name || 'Assigned property'}</h3>
        <p>{[property.city, property.state, property.country].filter(Boolean).join(', ') || property.address || 'No location saved'}</p>
      </div>

      <div className="owner-dashboard-property-meta">
        <span>
          <strong>{formatCurrency(property.revenue, property.currency)}</strong>
          <small>Revenue</small>
        </span>

        <span>
          <strong>{formatCurrency(property.ownerPayout, property.currency)}</strong>
          <small>Owner payout</small>
        </span>

        <span>
          <strong>{formatPercent(property.occupancy)}</strong>
          <small>Occupancy</small>
        </span>

        <span>
          <strong>{property.openMaintenance}</strong>
          <small>Open repairs</small>
        </span>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/properties/${property.id}`)}
        data-skip-create-action="true"
      >
        <Eye size={16} />
        View property
      </button>
    </article>
  );
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

  const assignedReports = (data.ownerReports || []).filter((report) =>
    canOwnerSeeReport(report, assignedPropertyIds, currentUser),
  );

  const propertyRows = buildOwnerPropertyRows({
    properties: assignedProperties,
    bookings: assignedBookings,
    maintenanceWorkOrders: assignedMaintenance,
    cleaningTasks: assignedCleaningTasks,
    currency,
  }).sort((a, b) => b.revenue - a.revenue);

  const grossRevenue = propertyRows.reduce((sum, property) => sum + property.revenue, 0);
  const totalExpenses = propertyRows.reduce((sum, property) => sum + property.expenses, 0);
  const netProfit = grossRevenue - totalExpenses;
  const ownerPayout = propertyRows.reduce((sum, property) => sum + property.ownerPayout, 0);

  const bookedNights = assignedBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
  const availableNights = Math.max(assignedProperties.length * 30, 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const openMaintenance = assignedMaintenance.filter(
    (workOrder) => !closedStatuses.has(workOrder.status),
  );

  const completedCleaning = assignedCleaningTasks.filter((task) =>
    ['completed', 'guest_ready'].includes(task.status),
  );

  const upcomingBookings = assignedBookings
    .filter((booking) => {
      const checkIn = getDateValue(getBookingCheckIn(booking));
      return checkIn && checkIn >= new Date();
    })
    .sort((a, b) => getDateValue(getBookingCheckIn(a)) - getDateValue(getBookingCheckIn(b)))
    .slice(0, 6);

  return (
    <AppLayout
      title="Owner dashboard"
      subtitle="View-only property performance, owner payout, reports, maintenance updates, and cleaning history."
    >
      <section className="card owner-dashboard-notice">
        <div className="card-header">
          <div>
            <h3>Owner portal access</h3>
            <p>
              Property owners should only see assigned properties, revenue, expenses, owner payout,
              maintenance updates, cleaning history, published reports, and property health information.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>

        <div className="helper">
          This page is intentionally view-only. Draft/internal reports stay hidden until they are released, published, sent, delivered, or completed by the property manager.
        </div>
      </section>

      <section className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={Banknote} />

        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, currency)}
          icon={Banknote}
          tone={netProfit >= 0 ? 'accent' : 'warning'}
        />

        <StatCard label="Occupancy rate" value={formatPercent(occupancyRate)} icon={Percent} />

        <StatCard label="Owner payout" value={formatCurrency(ownerPayout, currency)} icon={Banknote} />
      </section>

      {assignedProperties.length ? (
        <>
          <section className="owner-dashboard-property-grid">
            {propertyRows.slice(0, 6).map((property) => (
              <OwnerPropertyCard key={property.id} property={property} />
            ))}
          </section>

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
                      data-skip-create-action="true"
                    >
                      {row.name}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge tone={statusTone(row.status || 'active')}>{row.status || 'active'}</StatusBadge>,
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
                  key: 'ownerPayout',
                  label: 'Owner payout',
                  render: (row) => formatCurrency(row.ownerPayout, row.currency),
                },
                {
                  key: 'occupancy',
                  label: 'Occupancy',
                  render: (row) => formatPercent(row.occupancy),
                },
                {
                  key: 'openMaintenance',
                  label: 'Open maintenance',
                  render: (row) =>
                    row.openMaintenance ? (
                      <StatusBadge tone="warning">{row.openMaintenance} open</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">clear</StatusBadge>
                    ),
                },
              ]}
            />
          </section>

          <section className="panel-grid two">
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Upcoming bookings</h3>
                  <p>Upcoming stays for assigned properties.</p>
                </div>
                <CalendarCheck size={20} className="muted" />
              </div>

              {upcomingBookings.length ? (
                upcomingBookings.map((booking) => (
                  <div className="list-row" key={booking.id}>
                    <span>
                      <strong>{booking.guestName || booking.guest_name || 'Guest booking'}</strong>
                      <small>{getPropertyName(booking, assignedProperties)} · {formatDate(getBookingCheckIn(booking))}</small>
                    </span>
                    <StatusBadge tone={statusTone(booking.status || 'confirmed')}>{booking.status || 'confirmed'}</StatusBadge>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={CalendarCheck}
                  title="No upcoming bookings"
                  description="Upcoming assigned-property bookings will appear here."
                />
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Maintenance updates</h3>
                  <p>Open repairs and recent maintenance items.</p>
                </div>
                <Wrench size={20} className="muted" />
              </div>

              {assignedMaintenance.length ? (
                assignedMaintenance.slice(0, 6).map((workOrder) => (
                  <div className="list-row" key={workOrder.id}>
                    <span>
                      <strong>{workOrder.title || 'Maintenance issue'}</strong>
                      <small>{getPropertyName(workOrder, assignedProperties)} · {formatDate(getMaintenanceDue(workOrder))}</small>
                    </span>
                    <StatusBadge tone={statusTone(workOrder.status || workOrder.priority || 'reported')}>
                      {workOrder.status || workOrder.priority || 'reported'}
                    </StatusBadge>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={Wrench}
                  title="No maintenance updates"
                  description="Maintenance updates for assigned properties will appear here."
                />
              )}
            </section>
          </section>

          <section className="panel-grid two">
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Cleaning history</h3>
                  <p>Completed and upcoming cleaning activity.</p>
                </div>
                <CalendarCheck size={20} className="muted" />
              </div>

              {assignedCleaningTasks.length ? (
                assignedCleaningTasks.slice(0, 6).map((task) => (
                  <div className="list-row" key={task.id}>
                    <span>
                      <strong>{getPropertyName(task, assignedProperties)}</strong>
                      <small>{formatDate(getCleaningDate(task))}</small>
                    </span>
                    <StatusBadge tone={statusTone(task.status || 'scheduled')}>{task.status || 'scheduled'}</StatusBadge>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={CalendarCheck}
                  title="No cleaning history"
                  description="Cleaning history for assigned properties will appear here."
                />
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Owner reports</h3>
                  <p>Reports prepared and released by the property manager.</p>
                </div>
                <FileText size={20} className="muted" />
              </div>

              {assignedReports.length ? (
                assignedReports.slice(0, 6).map((report) => (
                  <div className="list-row" key={report.id}>
                    <span>
                      <strong>{report.title || 'Owner report'}</strong>
                      <small>{report.startDate || report.start_date ? `${formatDate(report.startDate || report.start_date)} – ${formatDate(report.endDate || report.end_date, 'Not set')}` : formatDate(report.created_at, 'Report period not set')}</small>
                    </span>
                    <StatusBadge tone={statusTone(report.status || 'released')}>{report.status || 'released'}</StatusBadge>
                  </div>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No released owner reports"
                  description="Released, published, sent, delivered, or completed owner reports for assigned properties will appear here. Draft/internal reports stay hidden."
                />
              )}
            </section>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Property health</h3>
                <p>Simple view-only health indicators for assigned properties.</p>
              </div>
              <Building2 size={20} className="muted" />
            </div>

            <div className="metadata-grid owner-dashboard-health-grid">
              <span>
                <Building2 size={16} />
                <strong>{assignedProperties.length}</strong>
                <small>Assigned properties</small>
              </span>

              <span>
                <CalendarCheck size={16} />
                <strong>{completedCleaning.length}</strong>
                <small>Completed cleanings</small>
              </span>

              <span>
                <Wrench size={16} />
                <strong>{openMaintenance.length}</strong>
                <small>Open repairs</small>
              </span>

              <span>
                <Banknote size={16} />
                <strong>{formatCurrency(totalExpenses, currency)}</strong>
                <small>Expenses</small>
              </span>
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          eyebrow="Owner portal"
          icon={Building2}
          title="No assigned properties yet"
          description="Your property manager has not assigned properties to this owner account."
        />
      )}
    </AppLayout>
  );
}
