import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  ClipboardList,
  DollarSign,
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
import { billingManageRoles } from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';
import { getBillingStatus } from '../lib/billingStatus.js';
import { navigate } from '../routes/AppRouter.jsx';

const completedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const dateRangeOptions = [
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'quarter_to_date', label: 'Quarter to date' },
  { value: 'year_to_date', label: 'Year to date' },
  { value: 'all_time', label: 'All time' },
];
const currencyOptions = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];

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
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(toNumber(value));
  } catch {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(toNumber(value));
  }
}

function formatPercent(value) {
  return `${Math.round(toNumber(value))}%`;
}

function formatDate(value, fallback = '—') {
  const date = getDateValue(value);

  if (!date) return fallback;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function getDateRange(rangeKey) {
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  if (rangeKey === 'all_time') {
    return { start: null, end: null };
  }

  if (rangeKey === 'this_month') {
    return { start: startOfMonth(today), end };
  }

  if (rangeKey === 'quarter_to_date') {
    return { start: startOfQuarter(today), end };
  }

  if (rangeKey === 'year_to_date') {
    return { start: startOfYear(today), end };
  }

  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { start, end };
}

function isDateInRange(value, range) {
  if (!range?.start && !range?.end) return true;

  const date = getDateValue(value);
  if (!date) return false;

  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;

  return true;
}

function daysBetween(start, end) {
  const startDate = getDateValue(start);
  const endDate = getDateValue(end);

  if (!startDate || !endDate || endDate <= startDate) return 0;

  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function daysInRange(range) {
  if (!range?.start || !range?.end) return 30;

  return Math.max(daysBetween(range.start, range.end) + 1, 1);
}

function getBookingDate(booking) {
  return booking.checkIn || booking.check_in || booking.created_at;
}

function getCleaningDate(task) {
  return task.scheduledFor || task.scheduled_for || task.created_at;
}

function getMaintenanceDate(workOrder) {
  return workOrder.due || workOrder.due_date || workOrder.created_at;
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

function matchesProperty(record, propertyId) {
  return propertyId === 'all' || getPropertyId(record) === propertyId;
}

function isUpcomingDate(value) {
  const date = getDateValue(value);
  const today = startOfDay(new Date());

  return Boolean(date && date >= today);
}

function monthKey(value) {
  const date = getDateValue(value);
  if (!date) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
  });
}

function getRecentMonthKeys(count = 6) {
  const keys = [];
  const date = new Date();
  date.setDate(1);

  for (let index = count - 1; index >= 0; index -= 1) {
    const nextDate = new Date(date.getFullYear(), date.getMonth() - index, 1);
    keys.push(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  }

  return keys;
}

function buildMonthlyRevenue(bookings, maintenanceWorkOrders, cleaningTasks) {
  const monthMap = new Map();

  const ensureMonth = (key) => {
    const current = monthMap.get(key) || {
      key,
      month: monthLabelFromKey(key),
      revenue: 0,
      expenses: 0,
    };

    monthMap.set(key, current);
    return current;
  };

  bookings.forEach((booking) => {
    if (cancelledStatuses.has(booking.status)) return;

    const key = monthKey(getBookingDate(booking));
    if (!key) return;

    ensureMonth(key).revenue += getBookingAmount(booking);
  });

  maintenanceWorkOrders.forEach((workOrder) => {
    const key = monthKey(getMaintenanceDate(workOrder));
    if (!key) return;

    ensureMonth(key).expenses += getMaintenanceCost(workOrder);
  });

  cleaningTasks.forEach((task) => {
    const key = monthKey(getCleaningDate(task));
    if (!key) return;

    ensureMonth(key).expenses += getCleaningCost(task);
  });

  if (!monthMap.size) {
    return getRecentMonthKeys().map((key) => ({
      key,
      month: monthLabelFromKey(key),
      revenue: 0,
      expenses: 0,
    }));
  }

  return Array.from(monthMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6)
    .map(({ key, ...row }) => row);
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

function filterRecords({ records, selectedPropertyId, dateRange, getRecordDate }) {
  return records.filter((record) => matchesProperty(record, selectedPropertyId) && isDateInRange(getRecordDate(record), dateRange));
}

export function DashboardPage() {
  const { data, currentWorkspace, currentUser } = useApp();
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const billingStatus = getBillingStatus(data.subscription, currentUser);
  const showBillingWarning = hasAnyRole(currentUser, billingManageRoles) && (billingStatus.isInGracePeriod || billingStatus.isRestricted);
  const [filters, setFilters] = React.useState({
    propertyId: 'all',
    dateRange: 'last_30_days',
    currency: workspaceCurrency,
  });

  React.useEffect(() => {
    setFilters((current) => ({
      ...current,
      currency: current.currency || workspaceCurrency,
    }));
  }, [workspaceCurrency]);

  const selectedDateRange = getDateRange(filters.dateRange);
  const displayCurrency = filters.currency || workspaceCurrency;

  const properties = data.properties || [];
  const bookings = data.bookings || [];
  const cleaningTasks = data.cleaningTasks || [];
  const maintenanceWorkOrders = data.maintenanceWorkOrders || [];

  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const filteredProperties = filters.propertyId === 'all'
    ? activeProperties
    : activeProperties.filter((property) => property.id === filters.propertyId);

  const activeBookings = filterRecords({
    records: bookings.filter((booking) => !cancelledStatuses.has(booking.status)),
    selectedPropertyId: filters.propertyId,
    dateRange: selectedDateRange,
    getRecordDate: getBookingDate,
  });

  const filteredCleaningTasks = filterRecords({
    records: cleaningTasks,
    selectedPropertyId: filters.propertyId,
    dateRange: selectedDateRange,
    getRecordDate: getCleaningDate,
  });

  const filteredMaintenanceWorkOrders = filterRecords({
    records: maintenanceWorkOrders,
    selectedPropertyId: filters.propertyId,
    dateRange: selectedDateRange,
    getRecordDate: getMaintenanceDate,
  });

  const urgentMaintenance = filteredMaintenanceWorkOrders.filter(
    (workOrder) => workOrder.priority === 'urgent' && !completedStatuses.has(workOrder.status),
  );

  const openMaintenance = filteredMaintenanceWorkOrders.filter(
    (workOrder) => !completedStatuses.has(workOrder.status),
  );

  const dueCleaningTasks = filteredCleaningTasks.filter((task) => !completedStatuses.has(task.status));

  const upcomingBookings = activeBookings
    .filter((booking) => isUpcomingDate(booking.checkIn || booking.check_in))
    .sort((a, b) => getDateValue(getBookingDate(a)) - getDateValue(getBookingDate(b)))
    .slice(0, 5);

  const grossRevenue = activeBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);
  const cleaningCost = filteredCleaningTasks.reduce((total, task) => total + getCleaningCost(task), 0);
  const maintenanceCost = filteredMaintenanceWorkOrders.reduce(
    (total, workOrder) => total + getMaintenanceCost(workOrder),
    0,
  );
  const netProfit = grossRevenue - cleaningCost - maintenanceCost;

  const bookedNights = activeBookings.reduce((total, booking) => total + getBookingNights(booking), 0);
  const availableNights = Math.max(filteredProperties.length * daysInRange(selectedDateRange), 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const issueCount = urgentMaintenance.length + openMaintenance.length + dueCleaningTasks.length;
  const operationsHealth = Math.max(100 - issueCount * 8, 0);

  const revenueChartData = buildMonthlyRevenue(
    activeBookings,
    filteredMaintenanceWorkOrders,
    filteredCleaningTasks,
  );

  const propertyPerformance = buildPropertyPerformance({
    properties: filteredProperties,
    bookings: activeBookings,
    maintenanceWorkOrders: filteredMaintenanceWorkOrders,
    cleaningTasks: filteredCleaningTasks,
  }).sort((a, b) => b.revenue - a.revenue);

  const profitBreakdown = [
    { label: 'Gross revenue', value: grossRevenue },
    { label: 'Cleaning costs', value: cleaningCost },
    { label: 'Maintenance costs', value: maintenanceCost },
    { label: 'Net profit', value: netProfit },
  ];

  const hasWorkspaceData =
    activeProperties.length ||
    bookings.length ||
    cleaningTasks.length ||
    maintenanceWorkOrders.length;

  const filteredResultCount =
    filteredProperties.length +
    activeBookings.length +
    filteredCleaningTasks.length +
    filteredMaintenanceWorkOrders.length;

  const selectedRangeLabel = dateRangeOptions.find((option) => option.value === filters.dateRange)?.label || 'Selected range';

  const updateFilter = (key) => (event) => {
    setFilters((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Workspace owner, property manager, and host command center"
    >
      {showBillingWarning && (
        <section className={`workspace-load-warning ${billingStatus.isRestricted ? 'error' : ''}`} role="alert">
          <strong>{billingStatus.isRestricted ? 'Billing recovery required' : 'Billing grace period'}</strong>
          <span>{billingStatus.userMessage}</span>
          <button type="button" onClick={() => navigate('/billing')} data-skip-create-action="true">
            Manage billing — Coming soon
          </button>
        </section>
      )}

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

      <section className="card compact">
        <div className="card-header">
          <div>
            <h3>Dashboard filters</h3>
            <p>
              Showing {filteredResultCount} matching workspace records for {selectedRangeLabel.toLowerCase()}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilters({ propertyId: 'all', dateRange: 'last_30_days', currency: workspaceCurrency })}
          >
            Reset filters
          </button>
        </div>

        <div className="filter-bar booking-filter">
          <select aria-label="Property filter" value={filters.propertyId} onChange={updateFilter('propertyId')}>
            <option value="all">All properties</option>
            {activeProperties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>

          <select aria-label="Date range filter" value={filters.dateRange} onChange={updateFilter('dateRange')}>
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select aria-label="Currency display filter" value={displayCurrency} onChange={updateFilter('currency')}>
            {[...new Set([workspaceCurrency, ...currencyOptions])].map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>

          <button type="button" data-create-action="property">
            <Building2 size={16} />
            Add property
          </button>

          <button type="button" data-create-action="booking">
            <CalendarCheck size={16} />
            Add booking
          </button>

          <button type="button" data-create-action="maintenance">
            <Wrench size={16} />
            Add work order
          </button>
        </div>
      </section>

      <div className="stat-grid dense">
        <StatCard
          label="Gross revenue"
          value={formatCurrency(grossRevenue, displayCurrency)}
          icon={DollarSign}
          trend={`${activeBookings.length} matching bookings`}
        />

        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, displayCurrency)}
          icon={TrendingUp}
          trend={`${formatCurrency(cleaningCost + maintenanceCost, displayCurrency)} tracked expenses`}
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

      {!filteredResultCount && hasWorkspaceData && (
        <EmptyState
          title="No dashboard records match these filters"
          description="Try another property, date range, or reset filters to see more workspace data."
          compact
        />
      )}

      <div className="chart-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Revenue vs expenses</h3>
              <p>Filtered monthly operating snapshot for the selected workspace.</p>
            </div>
            <LineChartIcon size={20} />
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value, displayCurrency)} />
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
              <p>Filtered revenue, expenses, and profit totals.</p>
            </div>
            <Banknote size={20} />
          </div>

          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={profitBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value, displayCurrency)} />
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
              <p>Future check-ins matching the selected property and date range.</p>
            </div>
            <Hotel size={20} />
          </div>

          {upcomingBookings.length ? (
            <div className="stack-list">
              {upcomingBookings.map((booking) => (
                <div className="stack-item" key={booking.id}>
                  <div>
                    <strong>{booking.guestName || booking.guest_name || 'Guest booking'}</strong>
                    <small>{getPropertyName(booking, properties)}</small>
                  </div>
                  <div className="right-detail">
                    <span>{formatDate(booking.checkIn || booking.check_in)}</span>
                    <StatusBadge>{booking.status || 'confirmed'}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No upcoming bookings"
              description="No future bookings match the active dashboard filters."
              compact
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Operational alerts</h3>
              <p>Cleaning and maintenance items matching the dashboard filters.</p>
            </div>
            <Wrench size={20} />
          </div>

          <div className="stack-list">
            <div className="stack-item">
              <div>
                <strong>Urgent maintenance</strong>
                <small>{urgentMaintenance.length} urgent filtered work orders</small>
              </div>
              <StatusBadge tone={urgentMaintenance.length ? 'warning' : 'success'}>
                {urgentMaintenance.length ? 'Needs attention' : 'Clear'}
              </StatusBadge>
            </div>

            <div className="stack-item">
              <div>
                <strong>Open maintenance</strong>
                <small>{openMaintenance.length} open filtered work orders</small>
              </div>
              <StatusBadge tone={openMaintenance.length ? 'warning' : 'success'}>
                {openMaintenance.length ? 'Open' : 'Clear'}
              </StatusBadge>
            </div>

            <div className="stack-item">
              <div>
                <strong>Cleaning due</strong>
                <small>{dueCleaningTasks.length} filtered cleaning tasks not completed</small>
              </div>
              <StatusBadge tone={dueCleaningTasks.length ? 'warning' : 'success'}>
                {dueCleaningTasks.length ? 'Due' : 'Clear'}
              </StatusBadge>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Property performance</h3>
            <p>Filtered performance table recalculated from local workspace data.</p>
          </div>
        </div>

        <DataTable
          compact
          rows={propertyPerformance}
          empty="No property performance records match the active filters."
          columns={[
            {
              key: 'name',
              label: 'Property',
              render: (property) => (
                <div>
                  <strong>{property.name || 'Property'}</strong>
                  <small>{property.city || property.country || property.propertyType || property.property_type || 'No location set'}</small>
                </div>
              ),
            },
            {
              key: 'revenue',
              label: 'Revenue',
              render: (property) => formatCurrency(property.revenue, displayCurrency),
            },
            {
              key: 'expenses',
              label: 'Expenses',
              render: (property) => formatCurrency(property.expenses, displayCurrency),
            },
            {
              key: 'netProfit',
              label: 'Net profit',
              render: (property) => formatCurrency(property.netProfit, displayCurrency),
            },
            { key: 'bookings', label: 'Bookings' },
            { key: 'openMaintenance', label: 'Open maintenance' },
            {
              key: 'status',
              label: 'Status',
              render: (property) => <StatusBadge>{property.status || 'active'}</StatusBadge>,
            },
          ]}
        />
      </section>
    </AppLayout>
  );
}
