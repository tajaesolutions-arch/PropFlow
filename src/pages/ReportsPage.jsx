import React from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Home,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { hasAnyRole } from '../lib/auth.js';
import { roles } from '../data/constants.js';
import { formatCurrency, formatDate, formatPercent } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';

const reportManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];

const reportTypes = [
  {
    id: 'owner_statement',
    title: 'Owner Statement',
    category: 'Owner',
    description: 'Revenue, expenses, owner payout, maintenance, cleaning, and assigned property summary.',
    ownerVisible: true,
  },
  {
    id: 'revenue_report',
    title: 'Revenue Report',
    category: 'Finance',
    description: 'Booking revenue, payment status, direct-booking revenue, and property-level totals.',
    ownerVisible: false,
  },
  {
    id: 'expense_report',
    title: 'Expense Report',
    category: 'Finance',
    description: 'Maintenance, cleaning, supplies, taxes, platform fees, and other tracked expenses.',
    ownerVisible: false,
  },
  {
    id: 'occupancy_report',
    title: 'Occupancy Report',
    category: 'Operations',
    description: 'Booked nights, available nights, occupancy rate, check-ins, and check-outs.',
    ownerVisible: true,
  },
  {
    id: 'maintenance_cost_report',
    title: 'Maintenance Cost Report',
    category: 'Maintenance',
    description: 'Estimated cost, actual cost, open repairs, completed repairs, and urgent issues.',
    ownerVisible: false,
  },
  {
    id: 'cleaning_cost_report',
    title: 'Cleaning Cost Report',
    category: 'Cleaning',
    description: 'Completed cleanings, guest-ready status, supplies used, and cleaning cost tracking.',
    ownerVisible: false,
  },
  {
    id: 'booking_summary',
    title: 'Booking Summary',
    category: 'Bookings',
    description: 'Guest stays, booking source, dates, payment status, and booking totals.',
    ownerVisible: true,
  },
  {
    id: 'property_performance',
    title: 'Property Performance',
    category: 'Portfolio',
    description: 'Per-property revenue, expenses, net profit, occupancy, repairs, and operations health.',
    ownerVisible: true,
  },
];

const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const closedStatuses = new Set(['completed', 'cancelled']);

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getBookingAmount(booking) {
  return safeNumber(booking.totalAmount || booking.total_amount || booking.amount);
}

function getOwnerPayout(booking) {
  return safeNumber(booking.ownerPayout || booking.owner_payout);
}

function getMaintenanceCost(item) {
  return safeNumber(item.actualCost || item.actual_cost || item.estimatedCost || item.estimated_cost);
}

function getCleaningCost(task) {
  return safeNumber(
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

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function daysBetween(start, end) {
  const startDate = getDateValue(start);
  const endDate = getDateValue(end);

  if (!startDate || !endDate || endDate <= startDate) return 0;

  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function getBookingNights(booking) {
  return daysBetween(booking.checkIn || booking.check_in, booking.checkOut || booking.check_out);
}

function getBookingDate(booking) {
  return booking.checkIn || booking.check_in || booking.created_at;
}

function getMaintenanceDate(workOrder) {
  return workOrder.due || workOrder.due_date || workOrder.created_at;
}

function getCleaningDate(task) {
  return task.scheduledFor || task.scheduled_for || task.created_at;
}

function isInDateRange(value, start, end) {
  const date = getDateValue(value);

  if (!date) return !start && !end;

  if (start) {
    const startDate = getDateValue(start);
    if (startDate && date < startDate) return false;
  }

  if (end) {
    const endDate = getDateValue(end);
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
      if (date > endDate) return false;
    }
  }

  return true;
}

function getMonthKey(value) {
  const date = getDateValue(value);

  if (!date) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isOwnerRole(currentUser) {
  return Boolean(currentUser?.roles?.includes(roles.OWNER));
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

function canOwnerSeeReport(report, assignedPropertyIds, currentUser) {
  if (!isOwnerRole(currentUser)) return true;

  const propertyId = getPropertyId(report);
  const ownerId = report.owner_id || report.ownerId || report.contact_id || report.contactId;

  if (propertyId) return assignedPropertyIds.has(propertyId);
  if (ownerId) return ownerId === currentUser?.id;

  return false;
}

function buildMonthlyRows({ bookings, cleaning, maintenance, currency }) {
  const monthMap = new Map();

  const ensureMonth = (key) => {
    const current = monthMap.get(key) || {
      id: key,
      month: key,
      revenue: 0,
      cleaningCosts: 0,
      maintenanceCosts: 0,
      expenses: 0,
      netProfit: 0,
      currency,
    };

    monthMap.set(key, current);
    return current;
  };

  bookings.forEach((booking) => {
    const key = getMonthKey(getBookingDate(booking));
    if (!key) return;

    ensureMonth(key).revenue += getBookingAmount(booking);
  });

  cleaning.forEach((task) => {
    const key = getMonthKey(getCleaningDate(task));
    if (!key) return;

    ensureMonth(key).cleaningCosts += getCleaningCost(task);
  });

  maintenance.forEach((workOrder) => {
    const key = getMonthKey(getMaintenanceDate(workOrder));
    if (!key) return;

    ensureMonth(key).maintenanceCosts += getMaintenanceCost(workOrder);
  });

  return Array.from(monthMap.values())
    .map((row) => ({
      ...row,
      expenses: row.cleaningCosts + row.maintenanceCosts,
      netProfit: row.revenue - row.cleaningCosts - row.maintenanceCosts,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

function buildPropertyRows({ properties, bookings, cleaning, maintenance, currency }) {
  return properties
    .filter((property) => property.status !== 'archived')
    .map((property) => {
      const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
      const propertyCleaning = cleaning.filter((task) => getPropertyId(task) === property.id);
      const propertyMaintenance = maintenance.filter((item) => getPropertyId(item) === property.id);

      const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
      const ownerPayout = propertyBookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
      const cleaningCosts = propertyCleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
      const maintenanceCosts = propertyMaintenance.reduce((sum, item) => sum + getMaintenanceCost(item), 0);
      const expenses = cleaningCosts + maintenanceCosts;
      const netProfit = revenue - expenses;
      const bookedNights = propertyBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
      const occupancy = Math.min((bookedNights / 30) * 100, 100);

      return {
        ...property,
        currency: property.currency || currency,
        revenue,
        ownerPayout,
        expenses,
        netProfit,
        occupancy,
        bookings: propertyBookings.length,
        bookedNights,
        cleaningTasks: propertyCleaning.length,
        openMaintenance: propertyMaintenance.filter((item) => !closedStatuses.has(item.status)).length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function buildExportHistory(ownerReports) {
  return ownerReports.map((report) => ({
    id: report.id,
    report_type: report.title || report.report_type || 'Owner report',
    format: report.format || 'PDF',
    status: report.status || 'ready',
    created_at: report.created_at || report.period || '—',
  }));
}

function matchesPropertySearch(row, query) {
  const q = String(query || '').trim().toLowerCase();

  if (!q) return true;

  return [
    row.name,
    row.address,
    row.city,
    row.state,
    row.country,
    row.status,
    row.currency,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

function DisabledExportButton({ label, icon: Icon = Download }) {
  return (
    <button type="button" disabled data-skip-create-action="true" title="CSV and PDF exports are not active yet.">
      <Icon size={16} />
      {label}
    </button>
  );
}

export function ReportsPage() {
  const { data, currentWorkspace, currentUser } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    start: '',
    end: '',
    reportCategory: 'all',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const canManageReports = hasAnyRole(currentUser, reportManagerRoles);
  const ownerView = isOwnerRole(currentUser);

  const rawBookings = data.bookings || [];
  const rawMaintenance = data.maintenanceWorkOrders || [];
  const rawCleaning = data.cleaningTasks || [];
  const allProperties = data.properties || [];

  const properties = allProperties
    .filter((property) => property.status !== 'archived')
    .filter((property) => isAssignedToCurrentOwner(property, currentUser));

  const assignedPropertyIds = new Set(properties.map((property) => property.id));

  const ownerReports = (data.ownerReports || []).filter((report) =>
    canOwnerSeeReport(report, assignedPropertyIds, currentUser),
  );

  const bookings = rawBookings
    .filter((booking) => !cancelledStatuses.has(booking.status))
    .filter((booking) => !ownerView || assignedPropertyIds.has(getPropertyId(booking)))
    .filter((booking) => isInDateRange(getBookingDate(booking), filters.start, filters.end));

  const maintenance = rawMaintenance
    .filter((item) => !ownerView || assignedPropertyIds.has(getPropertyId(item)))
    .filter((item) => isInDateRange(getMaintenanceDate(item), filters.start, filters.end));

  const cleaning = rawCleaning
    .filter((task) => !ownerView || assignedPropertyIds.has(getPropertyId(task)))
    .filter((task) => isInDateRange(getCleaningDate(task), filters.start, filters.end));

  const grossRevenue = bookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
  const ownerPayouts = bookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
  const maintenanceCosts = maintenance.reduce((sum, item) => sum + getMaintenanceCost(item), 0);
  const cleaningCosts = cleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
  const totalExpenses = maintenanceCosts + cleaningCosts;
  const netProfit = grossRevenue - totalExpenses;

  const bookedNights = bookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
  const availableNights = Math.max(properties.length * 30, 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const completedCleaning = cleaning.filter((task) => ['completed', 'guest_ready'].includes(task.status)).length;
  const openMaintenance = maintenance.filter((item) => !closedStatuses.has(item.status)).length;

  const propertyRows = buildPropertyRows({
    properties,
    bookings,
    cleaning,
    maintenance,
    currency,
  }).filter((row) => matchesPropertySearch(row, filters.query));

  const monthlyRows = buildMonthlyRows({
    bookings,
    cleaning,
    maintenance,
    currency,
  });

  const exportHistory = buildExportHistory(ownerReports);

  const roleSafeReportTypes = reportTypes.filter((report) => !ownerView || report.ownerVisible);
  const categories = [...new Set(roleSafeReportTypes.map((report) => report.category))];

  React.useEffect(() => {
    if (filters.reportCategory !== 'all' && !categories.includes(filters.reportCategory)) {
      setFilters((current) => ({ ...current, reportCategory: 'all' }));
    }
  }, [categories, filters.reportCategory]);

  const visibleReportTypes = roleSafeReportTypes.filter(
    (report) => filters.reportCategory === 'all' || report.category === filters.reportCategory,
  );

  const clearFilters = () => {
    setFilters({
      query: '',
      start: '',
      end: '',
      reportCategory: 'all',
    });
  };

  return (
    <AppLayout
      title="Reports & Exports"
      subtitle={ownerView
        ? 'Assigned-property owner reports, owner-visible summaries, and export placeholders.'
        : 'Owner reports, finance summaries, operations reports, and export placeholders.'}
    >
      {ownerView && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Owner visibility</p>
              <h3>Reports are scoped to assigned properties</h3>
              <p>
                This report view only uses properties, bookings, cleaning tasks, maintenance work orders, payouts, and reports assigned to this owner account.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Export safety</p>
            <h3>CSV and PDF exports are not active yet</h3>
            <p>
              Report export will be connected after finance records are safely stored and backend-generated files are ready. This page does not generate or download report files yet.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>
      </section>

      <section className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={BarChart3} />
        <StatCard label="Net profit" value={formatCurrency(netProfit, currency)} icon={FileSpreadsheet} />
        <StatCard label="Owner payouts" value={formatCurrency(ownerPayouts, currency)} icon={Receipt} />
        <StatCard label="Occupancy rate" value={formatPercent(occupancyRate)} icon={CalendarDays} />
      </section>

      <section className="stat-grid dense">
        <StatCard label="Maintenance costs" value={formatCurrency(maintenanceCosts, currency)} icon={Wrench} />
        <StatCard label="Cleaning costs" value={formatCurrency(cleaningCosts, currency)} icon={Home} />
        <StatCard label="Completed cleanings" value={completedCleaning} icon={Download} />
        <StatCard label="Open maintenance" value={openMaintenance} icon={Wrench} tone={openMaintenance ? 'warning' : 'accent'} />
      </section>

      <section className="card reports-toolbar finance-actions-toolbar">
        <div>
          <h3>Report center</h3>
          <p>
            Manual report creation, scheduled reports, CSV export, and PDF export remain disabled until backend report jobs and finance storage are connected.
          </p>
        </div>

        <div className="reports-toolbar-actions">
          {canManageReports && (
            <button type="button" className="primary" disabled data-skip-create-action="true">
              <Plus size={16} />
              Add Report disabled
            </button>
          )}

          <DisabledExportButton label="Property CSV disabled" />
          <DisabledExportButton label="Monthly CSV disabled" />
          <DisabledExportButton label="PDF disabled" icon={FileText} />
        </div>
      </section>

      <section className="card">
        <div className="reports-filters">
          <label className="reports-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder={ownerView
                ? 'Search assigned property reports by name, location, status, or currency...'
                : 'Search property performance by name, location, status, or currency...'}
              aria-label="Search report data"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear report search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Start
            <input
              type="date"
              value={filters.start}
              onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))}
            />
          </label>

          <label>
            End
            <input
              type="date"
              value={filters.end}
              onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))}
            />
          </label>

          <label>
            Report category
            <select
              value={filters.reportCategory}
              onChange={(event) =>
                setFilters((current) => ({ ...current, reportCategory: event.target.value }))
              }
            >
              <option value="all">All visible categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      <section className="reports-type-grid">
        {visibleReportTypes.map((report) => (
          <article className="card report-type-card" key={report.id}>
            <div className="report-type-icon">
              <FileText size={20} />
            </div>

            <div>
              <p className="eyebrow">{report.category}</p>
              <h3>{report.title}</h3>
              <p>{report.description}</p>
            </div>

            <div className="report-type-actions">
              <DisabledExportButton label="CSV disabled" />
              <DisabledExportButton label="PDF disabled" icon={FileText} />
            </div>

            <div className="helper">
              CSV and PDF exports are not active yet. Report export will be connected after finance records are safely stored.
            </div>
          </article>
        ))}
      </section>

      {propertyRows.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>{ownerView ? 'Assigned property performance report' : 'Property performance report'}</h3>
              <p>
                {ownerView
                  ? 'Preview of report data limited to properties assigned to this owner.'
                  : 'Preview of the report data used for owner statements and property performance exports.'}
              </p>
            </div>
          </div>

          <DataTable
            rows={propertyRows}
            columns={[
              {
                key: 'name',
                label: 'Property',
              },
              {
                key: 'bookings',
                label: 'Bookings',
              },
              {
                key: 'bookedNights',
                label: 'Booked nights',
              },
              {
                key: 'revenue',
                label: 'Revenue',
                render: (row) => formatCurrency(row.revenue, row.currency),
              },
              {
                key: 'ownerPayout',
                label: 'Owner payout',
                render: (row) => formatCurrency(row.ownerPayout, row.currency),
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
                label: 'Open repairs',
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
      ) : (
        <EmptyState
          eyebrow="Reports"
          icon={FileSpreadsheet}
          title={ownerView ? 'No assigned-property report data yet' : 'No report data yet'}
          description={ownerView
            ? 'Assigned-property report previews will appear after this owner has assigned properties with bookings, cleaning tasks, or maintenance records. No export files are generated yet.'
            : 'Add properties, bookings, cleaning tasks, and maintenance work orders to generate useful report previews. No export files are generated yet.'}
          action={
            <button type="button" className="primary" disabled data-skip-create-action="true">
              <Plus size={16} />
              Add Booking disabled
            </button>
          }
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>{ownerView ? 'Assigned-property monthly summary' : 'Monthly finance summary'}</h3>
              <p>Revenue, expenses, and net profit grouped by month.</p>
            </div>
          </div>

          {monthlyRows.length ? (
            <DataTable
              rows={monthlyRows.slice(0, 8)}
              columns={[
                {
                  key: 'month',
                  label: 'Month',
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
              ]}
            />
          ) : (
            <EmptyState
              compact
              icon={BarChart3}
              title="No monthly report data"
              description={ownerView
                ? 'Monthly summaries will appear after assigned-property bookings, cleaning tasks, or maintenance records are added.'
                : 'Monthly summaries will appear after dated bookings, cleaning tasks, or maintenance records are added.'}
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Export history</h3>
              <p>Export history is disabled until backend-generated files are connected.</p>
            </div>
          </div>

          {exportHistory.length ? (
            <DataTable
              rows={exportHistory}
              columns={[
                {
                  key: 'report_type',
                  label: 'Report',
                },
                {
                  key: 'format',
                  label: 'Format',
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge>{row.status}</StatusBadge>,
                },
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (row) => formatDate(row.created_at, row.created_at || '—'),
                },
              ]}
            />
          ) : (
            <EmptyState
              compact
              icon={Download}
              title="No exports generated yet"
              description="CSV and PDF export history will appear here after backend-generated exports are safely connected."
            />
          )}
        </section>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Scheduled reports</h3>
            <p>Owner statements and recurring exports.</p>
          </div>

          <StatusBadge tone="info">coming later</StatusBadge>
        </div>

        <EmptyState
          compact
          icon={CalendarDays}
          title="No scheduled reports configured"
          description="Automated weekly, monthly, and quarterly exports can be enabled after backend report jobs are configured."
          action={
            canManageReports ? (
              <button type="button" onClick={() => navigate('/owners')} data-skip-create-action="true">
                Review Owners
              </button>
            ) : null
          }
        />
      </section>
    </AppLayout>
  );
}
