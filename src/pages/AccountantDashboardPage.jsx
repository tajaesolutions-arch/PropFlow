import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
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
import { formatCurrency, formatDate } from '../lib/formatters.js';

const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const closedStatuses = new Set(['completed', 'cancelled']);

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

function getCleaningFee(booking) {
  return toNumber(booking.cleaningFee || booking.cleaning_fee);
}

function getTaxesFees(booking) {
  return toNumber(booking.taxesFees || booking.taxes_fees);
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

function getBookingDate(booking) {
  return booking.checkIn || booking.check_in || booking.created_at || '';
}

function getCleaningDate(task) {
  return task.scheduledFor || task.scheduled_for || task.created_at || '';
}

function getMaintenanceDate(workOrder) {
  return workOrder.due || workOrder.due_date || workOrder.created_at || '';
}

function getPropertyName(record, properties) {
  const propertyId = getPropertyId(record);
  const property = properties.find((item) => item.id === propertyId);

  return record.property || property?.name || 'Unassigned property';
}

function getWorkspaceCurrency(currentWorkspace) {
  return currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
}

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
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

function normalizeLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();

  if (['cancelled', 'failed', 'overdue', 'unpaid'].includes(status)) return 'error';
  if (['pending', 'partially_paid', 'scheduled', 'reported', 'in_progress'].includes(status)) return 'warning';
  if (['paid', 'completed', 'ready', 'active', 'guest_ready'].includes(status)) return 'success';

  return 'info';
}

function matchesSearch(values, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  return values.filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
}

function buildPropertyFinanceRows({ properties, bookings, cleaningTasks, maintenanceWorkOrders, expenses, currency }) {
  return properties
    .filter((property) => property.status !== 'archived')
    .map((property) => {
      const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
      const propertyCleaning = cleaningTasks.filter((task) => getPropertyId(task) === property.id);
      const propertyMaintenance = maintenanceWorkOrders.filter(
        (workOrder) => getPropertyId(workOrder) === property.id,
      );

      const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
      const ownerPayout = propertyBookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
      const cleaningFees = propertyBookings.reduce((sum, booking) => sum + getCleaningFee(booking), 0);
      const platformFees = propertyBookings.reduce((sum, booking) => sum + getTaxesFees(booking), 0);
      const cleaningCosts = propertyCleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
      const maintenanceCosts = propertyMaintenance.reduce(
        (sum, workOrder) => sum + getMaintenanceCost(workOrder),
        0,
      );
      const manualExpenses = expenses
        .filter((expense) => getPropertyId(expense) === property.id)
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

      const expenseTotal = cleaningCosts + maintenanceCosts + platformFees + manualExpenses;
      const netProfit = revenue - expenseTotal;

      return {
        ...property,
        currency: property.currency || currency,
        revenue,
        ownerPayout,
        cleaningFees,
        platformFees,
        cleaningCosts,
        maintenanceCosts,
        expenses: expenseTotal,
        manualExpenses,
        netProfit,
        bookings: propertyBookings.length,
        openMaintenance: propertyMaintenance.filter((workOrder) => !closedStatuses.has(workOrder.status)).length,
      };
    });
}

function buildRecentTransactions({ bookings, maintenanceWorkOrders, cleaningTasks, expenses, properties, currency }) {
  return [
    ...bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'Booking revenue',
      property: getPropertyName(booking, properties),
      date: getBookingDate(booking),
      amount: getBookingAmount(booking),
      currency: booking.currency || currency,
      status: booking.paymentStatus || booking.payment_status || 'unpaid',
    })),
    ...maintenanceWorkOrders.map((workOrder) => ({
      id: `maintenance-${workOrder.id}`,
      type: 'Maintenance cost',
      property: getPropertyName(workOrder, properties),
      date: getMaintenanceDate(workOrder),
      amount: -getMaintenanceCost(workOrder),
      currency,
      status: workOrder.status || 'reported',
    })),
    ...cleaningTasks.map((task) => ({
      id: `cleaning-${task.id}`,
      type: 'Cleaning cost estimate',
      property: getPropertyName(task, properties),
      date: getCleaningDate(task),
      amount: -getCleaningCost(task),
      currency,
      status: task.status || 'scheduled',
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: 'Manual expense',
      property: getPropertyName(expense, properties),
      date: expense.expense_date || expense.expenseDate || expense.created_at,
      amount: -toNumber(expense.amount),
      currency: expense.currency || currency,
      status: expense.payment_status || expense.paymentStatus || expense.expense_status || 'unpaid',
    })),
  ].sort((a, b) => {
    const dateA = getDateValue(a.date);
    const dateB = getDateValue(b.date);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return dateB - dateA;
  });
}

function DisabledExportButton({ label, icon: Icon = Download }) {
  return (
    <button type="button" disabled data-skip-create-action="true" title="Finance exports are not active yet.">
      <Icon size={16} />
      {label}
    </button>
  );
}

export function AccountantDashboardPage() {
  const { data, currentWorkspace } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    start: '',
    end: '',
    transactionType: 'all',
  });

  const currency = getWorkspaceCurrency(currentWorkspace);

  const properties = data.properties || [];
  const bookings = (data.bookings || [])
    .filter((booking) => !cancelledStatuses.has(booking.status))
    .filter((booking) => isInDateRange(getBookingDate(booking), filters.start, filters.end));

  const cleaningTasks = (data.cleaningTasks || []).filter((task) =>
    isInDateRange(getCleaningDate(task), filters.start, filters.end),
  );

  const maintenanceWorkOrders = (data.maintenanceWorkOrders || []).filter((workOrder) =>
    isInDateRange(getMaintenanceDate(workOrder), filters.start, filters.end),
  );

  const expenses = (data.expenses || [])
    .filter((expense) => expense.expense_status !== 'archived')
    .filter((expense) => isInDateRange(expense.expense_date || expense.expenseDate, filters.start, filters.end));

  const reports = data.ownerReports || [];

  const propertyRows = buildPropertyFinanceRows({
    properties,
    bookings,
    cleaningTasks,
    maintenanceWorkOrders,
    expenses,
    currency,
  })
    .filter((row) =>
      matchesSearch(
        [
          row.name,
          row.address,
          row.city,
          row.state,
          row.country,
          row.status,
          row.currency,
        ],
        filters.query,
      ),
    )
    .sort((a, b) => b.revenue - a.revenue);

  const grossRevenue = bookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
  const ownerPayouts = bookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
  const cleaningFees = bookings.reduce((sum, booking) => sum + getCleaningFee(booking), 0);
  const taxesFees = bookings.reduce((sum, booking) => sum + getTaxesFees(booking), 0);
  const cleaningCosts = cleaningTasks.reduce((sum, task) => sum + getCleaningCost(task), 0);
  const maintenanceCosts = maintenanceWorkOrders.reduce(
    (sum, workOrder) => sum + getMaintenanceCost(workOrder),
    0,
  );

  const manualExpenses = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const totalExpenses = cleaningCosts + maintenanceCosts + taxesFees + manualExpenses;
  const netProfit = grossRevenue - totalExpenses;

  const allTransactions = buildRecentTransactions({
    bookings,
    maintenanceWorkOrders,
    cleaningTasks,
    expenses,
    properties,
    currency,
  });

  const transactionTypes = [...new Set(allTransactions.map((transaction) => transaction.type))];

  const recentTransactions = allTransactions
    .filter((transaction) => filters.transactionType === 'all' || transaction.type === filters.transactionType)
    .filter((transaction) =>
      matchesSearch(
        [transaction.type, transaction.property, transaction.status, transaction.date],
        filters.query,
      ),
    );

  const clearFilters = () => {
    setFilters({
      query: '',
      start: '',
      end: '',
      transactionType: 'all',
    });
  };

  return (
    <AppLayout
      title="Accountant dashboard"
      subtitle="Read-only finance view for derived revenue, expenses, owner payouts, reports, receipts, and export placeholders."
    >
      <section className="card accountant-dashboard-notice finance-safety-notice">
        <div className="card-header">
          <div>
            <h3>Read-only finance access</h3>
            <p>
              Accountant / Bookkeeper access is finance-focused and read-only. This dashboard avoids operational
              editing and shows derived summaries from existing bookings, cleaning tasks, maintenance work orders, manual expenses, and reports.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>

        <div className="helper">
          These values are operational finance previews, not finalized accounting ledgers, invoices, tax filings, or exported statements. Manual expenses and operational cost estimates are shown as operational finance previews and may need accountant review before final reporting. Dedicated accounting records and backend-generated exports should be connected in a later phase.
        </div>
      </section>

      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Export safety</p>
            <h3>Finance CSV and PDF exports are not active yet</h3>
            <p>
              Finance export will be connected after finance records are safely stored and backend-generated files are ready. This dashboard does not generate or download finance files yet.
            </p>
          </div>
          <FileSpreadsheet size={22} className="muted" />
        </div>
      </section>

      <section className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={Banknote} />
        <StatCard label="Total expenses" value={formatCurrency(totalExpenses, currency)} icon={Receipt} />
        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, currency)}
          icon={Banknote}
          tone={netProfit >= 0 ? 'accent' : 'warning'}
        />
        <StatCard label="Owner payouts" value={formatCurrency(ownerPayouts, currency)} icon={FileText} />
      </section>

      <section className="stat-grid dense">
        <StatCard label="Cleaning costs" value={formatCurrency(cleaningCosts, currency)} icon={CalendarCheck} />
        <StatCard label="Maintenance costs" value={formatCurrency(maintenanceCosts, currency)} icon={Wrench} />
        <StatCard label="Taxes / platform fees" value={formatCurrency(taxesFees, currency)} icon={Receipt} />
        <StatCard label="Manual expenses" value={formatCurrency(manualExpenses, currency)} icon={Receipt} />
      </section>

      <section className="card accountant-dashboard-toolbar finance-actions-toolbar">
        <div>
          <h3>Finance exports</h3>
          <p>CSV and PDF exports are disabled until backend-generated finance exports are connected.</p>
        </div>

        <div className="accountant-dashboard-toolbar-actions">
          <DisabledExportButton label="Finance CSV disabled" />
          <DisabledExportButton label="Transaction CSV disabled" />
          <DisabledExportButton label="PDF disabled" icon={FileText} />
        </div>
      </section>

      <section className="card">
        <div className="accountant-dashboard-filters">
          <label className="accountant-dashboard-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search property, transaction, status, date, or currency..."
              aria-label="Search finance records"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear finance search"
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
            Transaction type
            <select
              value={filters.transactionType}
              onChange={(event) =>
                setFilters((current) => ({ ...current, transactionType: event.target.value }))
              }
            >
              <option value="all">All transaction types</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {propertyRows.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property finance summary</h3>
              <p>Derived revenue, manual expenses, operational cost estimates, net profit, owner payout, and maintenance exposure by property.</p>
            </div>
            <Building2 size={20} className="muted" />
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
                key: 'cleaningCosts',
                label: 'Cleaning costs',
                render: (row) => formatCurrency(row.cleaningCosts, row.currency),
              },
              {
                key: 'maintenanceCosts',
                label: 'Maintenance costs',
                render: (row) => formatCurrency(row.maintenanceCosts, row.currency),
              },
              {
                key: 'manualExpenses',
                label: 'Manual expenses',
                render: (row) => formatCurrency(row.manualExpenses, row.currency),
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
          eyebrow="Finance"
          icon={FileSpreadsheet}
          title="No property finance records yet"
          description="Property finance summaries will appear once properties, bookings, cleaning tasks, and maintenance records exist. No export files are generated yet."
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Recent finance activity</h3>
              <p>Revenue, manual expenses, and cost previews pulled from bookings, cleaning, and maintenance.</p>
            </div>
            <Receipt size={20} className="muted" />
          </div>

          {recentTransactions.length ? (
            recentTransactions.slice(0, 10).map((transaction) => (
              <div className="list-row accountant-transaction-row" key={transaction.id}>
                <span>
                  <strong>{transaction.type}</strong>
                  <small>
                    {transaction.property} · {formatDate(transaction.date, transaction.date || '—')}
                  </small>
                </span>

                <span>
                  <strong>{formatCurrency(transaction.amount, transaction.currency || currency)}</strong>
                  <StatusBadge tone={statusTone(transaction.status)}>{normalizeLabel(transaction.status)}</StatusBadge>
                </span>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={Receipt}
              title="No finance activity yet"
              description="Booking revenue and cost activity will appear here. CSV/PDF exports are not active yet."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner reports</h3>
              <p>Owner report records available to finance users.</p>
            </div>
            <FileText size={20} className="muted" />
          </div>

          {reports.length ? (
            reports.slice(0, 8).map((report) => (
              <div className="list-row" key={report.id}>
                <span>
                  <strong>{report.title || 'Owner report'}</strong>
                  <small>{report.period || formatDate(report.created_at, 'Report period not set')}</small>
                </span>
                <StatusBadge tone={statusTone(report.status || 'ready')}>{report.status || 'ready'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={FileText}
              title="No owner reports generated"
              description="Owner reports will appear here after report generation is connected. Export files are not generated yet."
            />
          )}
        </section>
      </section>
    </AppLayout>
  );
}
