import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  Home,
  Hotel,
  LineChart as LineChartIcon,
  Percent,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const completedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getAmount(record, keys) {
  return keys.reduce((total, key) => {
    if (total) return total;
    return toNumber(record?.[key]);
  }, 0);
}

function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatPercent(value) {
  return `${Math.round(toNumber(value))}%`;
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

function getBookingAmount(booking) {
  return getAmount(booking, ['totalAmount', 'total_amount', 'amount', 'bookingAmount']);
}

function getMaintenanceCost(workOrder) {
  return getAmount(workOrder, ['actualCost', 'actual_cost', 'estimatedCost', 'estimated_cost']);
}

function getCleaningCost(task) {
  return getAmount(task, ['actualCost', 'actual_cost', 'estimatedCost', 'estimated_cost', 'cleaningFee', 'cleaning_fee']);
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyName(record, properties = []) {
  const propertyId = getPropertyId(record);
  const property = properties.find((item) => item.id === propertyId);

  return record?.property || property?.name || 'Unassigned property';
}

function isUpcomingDate(value) {
  const date = getDateValue(value);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return Boolean(date && date >= today);
}

function getMonthLabel(value) {
  const date = getDateValue(value);

  if (!date) return 'Unscheduled';

  return date.toLocaleDateString('en-US', {
    month: 'short',
  });
}

function buildMonthlyRevenue(bookings) {
  const monthMap = new Map();

  bookings.forEach((booking) => {
    if (cancelledStatuses.has(booking.status)) return;

    const label = getMonthLabel(booking.checkIn || booking.check_in || booking.created_at);
    const current = monthMap.get(label) || {
      month: label,
      revenue: 0,
      expenses: 0,
    };

    current.revenue += getBookingAmount(booking);
    monthMap.set(label, current);
  });

  const rows = Array.from(monthMap.values());

  if (rows.length) {
    return rows.slice(-6);
  }

  return [
    { month: 'Jan', revenue: 0, expenses: 0 },
    { month: 'Feb', revenue: 0, expenses: 0 },
    { month: 'Mar', revenue: 0, expenses: 0 },
    { month: 'Apr', revenue: 0, expenses: 0 },
    { month: 'May', revenue: 0, expenses: 0 },
    { month: 'Jun', revenue: 0, expenses: 0 },
  ];
}

function buildPropertyPerformance({ properties, bookings, maintenanceWorkOrders, cleaningTasks }) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
    const propertyMaintenance = maintenanceWorkOrders.filter((workOrder) => getPropertyId(workOrder) === property.id);
    const propertyCleaning = cleaningTasks.filter((task) => getPropertyId(task) === property.id);

    const revenue = propertyBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);
    const maintenanceCost = propertyMaintenance.reduce(
      (total, workOrder) => total + getMaintenanceCost(workOrder),
      0,
    );
    const cleaningCost = propertyCleaning.reduce((total, task) => total + getCleaningCost(task), 0);
    const openMaintenance = propertyMaintenance.filter(
      (workOrder) => !completedStatuses.has(workOrder.status),
    ).length;

    return {
      ...property,
      revenue,
      expenses: maintenanceCost + cleaningCost,
      netProfit: revenue - maintenanceCost - cleaningCost,
      bookings: propertyBookings.length,
      openMaintenance,
    };
  });
}

export function DashboardPage() {
  const { data, currentWorkspace } = useApp();
  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const properties = data.properties || [];
  const bookings = data.bookings || [];
  const cleaningTasks = data.cleaningTasks || [];
  const maintenanceWorkOrders = data.maintenanceWorkOrders || [];

  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const activeBookings = bookings.filter((booking) => !cancelledStatuses.has(booking.status));

  const urgentMaintenance = maintenanceWorkOrders.filter(
    (workOrder) => workOrder.priority === 'urgent' && !completedStatuses.has(workOrder.status),
  );

  const openMaintenance = maintenanceWorkOrders.filter(
    (workOrder) => !completedStatuses.has(workOrder.status),
  );

  const dueCleaningTasks = cleaningTasks.filter((task) => !completedStatuses.has(task.status));

  const upcomingBookings = activeBookings
    .filter((booking) => isUpcomingDate(booking.checkIn || booking.check_in))
    .slice(0, 5);

  const grossRevenue = activeBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);
  const cleaningCost = cleaningTasks.reduce((total, task) => total + getCleaningCost(task), 0);
  const maintenanceCost = maintenanceWorkOrders.reduce(
    (total, workOrder) => total + getMaintenanceCost(workOrder),
    0,
  );
  const netProfit = grossRevenue - cleaningCost - maintenanceCost;

  const bookedNights = activeBookings.reduce((total, booking) => total + getBookingNights(booking), 0);
  const availableNights = Math.max(activeProperties.length * 30, 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const issueCount = urgentMaintenance.length + openMaintenance.length + dueCleaningTasks.length;
  const operationsHealth = Math.max(100 - issueCount * 8, 0);

  const revenueChartData = buildMonthlyRevenue(activeBookings).map((row) => ({
    ...row,
    expenses: Math.round((cleaningCost + maintenanceCost) / 6),
  }));

  const propertyPerformance = buildPropertyPerformance({
    properties: activeProperties,
    bookings: activeBookings,
    maintenanceWorkOrders,
    cleaningTasks,
  }).sort((a, b) => b.revenue - a.revenue);

  const profitBreakdown = [
    { label: 'Gross revenue', value: grossRevenue },
    { label: 'Cleaning costs', value: cleaningCost },
    { label: 'Maintenance costs', value: maintenanceCost },
    { label: 'Net profit', value: netProfit },
  ];

  const hasWorkspaceData =
    activeProperties.length ||
    activeBookings.length ||
    cleaningTasks.length ||
    maintenanceWorkOrders.length;

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Workspace owner, property manager, and host command center"
    >
      {!hasWorkspaceData && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Finish your PropFlow setup</h3>
              <p>
                Start by adding your first property. Then add bookings, cleaning tasks,
                maintenance work orders, owners, and team members.
              </p>
            </div>
          </div>

          <div className="action-row">
            <button className="primary" type="button" onClick={() => navigate('/properties')}>
              Add first property
            </button>
            <button type="button" onClick={() => navigate('/settings')}>
              Invite team
            </button>
            <button type="button" onClick={() => navigate('/bookings')}>
              Add booking
            </button>
          </div>
        </section>
      )}

      <div className="stat-grid dense">
        <StatCard
          label="Gross revenue"
          value={formatCurrency(grossRevenue, currency)}
          icon={DollarSign}
          trend={`${activeBookings.length} active bookings`}
        />

        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, currency)}
          icon={TrendingUp}
          trend={`${formatCurrency(cleaningCost + maintenanceCost, currency)} tracked expenses`}
          tone={netProfit >= 0 ? 'accent' : 'warning'}
        />

        <StatCard
          label="Occupancy rate"
          value={formatPercent(occupancyRate)}
          icon={Percent}
          trend={`${bookedNights} booked nights`}
        />

        <StatCard
          label="Operations health"
          value={formatPercent(operationsHealth)}
          icon={ClipboardList}
          trend={urgentMaintenance.length ? `${urgentMaintenance.length} urgent alerts` : 'No urgent alerts'}
          tone={urgentMaintenance.length ? 'warning' : 'accent'}
        />
      </div>

      <div className="filter-bar booking-filter">
        <select aria-label="Property filter">
          <option>All properties</option>
          {activeProperties.map((property) => (
            <option key={property.id}>{property.name}</option>
          ))}
        </select>

        <select aria-label="Date range filter">
          <option>Last 30 days</option>
          <option>This month</option>
          <option>Quarter to date</option>
          <option>Year to date</option>
        </select>

        <select aria-label="Currency filter" defaultValue={currency}>
          <option>{currency}</option>
          <option>USD</option>
          <option>JMD</option>
          <option>CAD</option>
          <option>GBP</option>
          <option>EUR</option>
        </select>

        <button type="button" onClick={() => navigate('/properties')}>
          <Building2 size={16} />
          Add property
        </button>

        <button type="button" onClick={() => navigate('/bookings')}>
          <CalendarCheck size={16} />
          Add booking
        </button>

        <button type="button" onClick={() => navigate('/maintenance')}>
          <Wrench size={16} />
          Add work order
        </button>
      </div>

      <div className="chart-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Revenue vs expenses</h3>
              <p>Monthly operating snapshot for the selected workspace.</p>
            </div>
            <LineChartIcon size={20} />
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                <Line type="monotone" dataKey="revenue" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Profit breakdown</h3>
              <p>Revenue, tracked operating costs, and estimated profit.</p>
            </div>
            <Banknote size={20} />
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={profitBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Upcoming bookings</h3>
              <p>Next arrivals and reservation activity.</p>
            </div>
            <button type="button" onClick={() => navigate('/bookings')}>
              View all
            </button>
          </div>

          {upcomingBookings.length ? (
            upcomingBookings.map((booking) => (
              <div className="list-row" key={booking.id}>
                <Hotel size={18} />
                <span>
                  {booking.guestName || booking.guest_name || 'Guest booking'}
                  <small>
                    {getPropertyName(booking, properties)} · {booking.checkIn || booking.check_in}
                  </small>
                </span>
                <StatusBadge>{booking.status || 'confirmed'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No upcoming bookings yet."
              description="Add bookings manually or connect direct booking tools later."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Operations alerts</h3>
              <p>Cleaning and maintenance items that need attention.</p>
            </div>
            <button type="button" onClick={() => navigate('/maintenance')}>
              View work orders
            </button>
          </div>

          {urgentMaintenance.length ? (
            urgentMaintenance.slice(0, 5).map((workOrder) => (
              <div className="list-row" key={workOrder.id}>
                <Wrench size={18} />
                <span>
                  {workOrder.title || 'Maintenance issue'}
                  <small>{getPropertyName(workOrder, properties)}</small>
                </span>
                <StatusBadge>{workOrder.priority || 'urgent'}</StatusBadge>
              </div>
            ))
          ) : (
            <p>No urgent maintenance alerts.</p>
          )}

          {dueCleaningTasks.length > 0 && (
            <div className="helper">
              <ClipboardList size={16} />
              {dueCleaningTasks.length} cleaning task{dueCleaningTasks.length === 1 ? '' : 's'} still open.
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Property performance</h3>
            <p>Revenue, expenses, bookings, and open maintenance by property.</p>
          </div>
          <button type="button" onClick={() => navigate('/properties')}>
            Manage properties
          </button>
        </div>

        {propertyPerformance.length ? (
          <DataTable
            rows={propertyPerformance.slice(0, 8)}
            columns={[
              {
                key: 'name',
                label: 'Property',
                render: (row) => (
                  <button type="button" className="link" onClick={() => navigate(`/properties/${row.id}`)}>
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
                key: 'bookings',
                label: 'Bookings',
              },
              {
                key: 'revenue',
                label: 'Revenue',
                render: (row) => formatCurrency(row.revenue, currency),
              },
              {
                key: 'expenses',
                label: 'Expenses',
                render: (row) => formatCurrency(row.expenses, currency),
              },
              {
                key: 'netProfit',
                label: 'Net profit',
                render: (row) => formatCurrency(row.netProfit, currency),
              },
              {
                key: 'openMaintenance',
                label: 'Open maintenance',
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No properties added yet."
            description="Add your first property to start tracking performance."
          />
        )}
      </section>

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Setup checklist</h3>
              <p>Complete these steps before launch.</p>
            </div>
          </div>

          <ul className="checklist">
            <li>
              <input type="checkbox" checked={activeProperties.length > 0} readOnly />
              Add first property
            </li>
            <li>
              <input type="checkbox" checked={bookings.length > 0} readOnly />
              Add first booking
            </li>
            <li>
              <input type="checkbox" checked={cleaningTasks.length > 0} readOnly />
              Add cleaning workflow
            </li>
            <li>
              <input type="checkbox" checked={maintenanceWorkOrders.length > 0} readOnly />
              Add maintenance workflow
            </li>
            <li>
              <input type="checkbox" checked={Boolean(currentWorkspace?.defaultCurrency)} readOnly />
              Confirm workspace currency
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Workspace snapshot</h3>
              <p>{currentWorkspace?.name || 'No workspace selected'}</p>
            </div>
            <Home size={20} />
          </div>

          <div className="metadata-grid">
            <span>
              <Building2 size={16} />
              {activeProperties.length} properties
            </span>
            <span>
              <CalendarCheck size={16} />
              {activeBookings.length} bookings
            </span>
            <span>
              <ClipboardList size={16} />
              {cleaningTasks.length} cleanings
            </span>
            <span>
              <Wrench size={16} />
              {openMaintenance.length} open repairs
            </span>
          </div>

          <div className="action-row">
            <button type="button" onClick={() => navigate('/reports')}>
              View reports
            </button>
            <button type="button" onClick={() => navigate('/settings')}>
              Workspace settings
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
