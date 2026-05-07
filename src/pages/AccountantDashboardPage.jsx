import React from 'react';
import {
  Banknote,
  Building2,
  CalendarCheck,
  ClipboardList,
  Download,
  FileText,
  Receipt,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';

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

function getPropertyName(record, properties) {
  const propertyId = getPropertyId(record);
  const property = properties.find((item) => item.id === propertyId);

  return record.property || property?.name || 'Unassigned property';
}

function buildPropertyFinanceRows({ properties, bookings, cleaningTasks, maintenanceWorkOrders, currency }) {
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

      const expenses = cleaningCosts + maintenanceCosts + platformFees;
      const netProfit = revenue - expenses;

      return {
        ...property,
        currency: property.currency || currency,
        revenue,
        ownerPayout,
        cleaningFees,
        platformFees,
        cleaningCosts,
        maintenanceCosts,
        expenses,
        netProfit,
        bookings: propertyBookings.length,
        openMaintenance: propertyMaintenance.filter((workOrder) => !closedStatuses.has(workOrder.status)).length,
      };
    });
}

export function AccountantDashboardPage() {
  const { data, currentWorkspace } = useApp();

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const properties = data.properties || [];
  const bookings = (data.bookings || []).filter((booking) => !cancelledStatuses.has(booking.status));
  const cleaningTasks = data.cleaningTasks || [];
  const maintenanceWorkOrders = data.maintenanceWorkOrders || [];
  const reports = data.ownerReports || [];

  const propertyRows = buildPropertyFinanceRows({
    properties,
    bookings,
    cleaningTasks,
    maintenanceWorkOrders,
    currency,
  }).sort((a, b) => b.revenue - a.revenue);

  const grossRevenue = bookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
  const ownerPayouts = bookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
  const cleaningFees = bookings.reduce((sum, booking) => sum + getCleaningFee(booking), 0);
  const taxesFees = bookings.reduce((sum, booking) => sum + getTaxesFees(booking), 0);
  const cleaningCosts = cleaningTasks.reduce((sum, task) => sum + getCleaningCost(task), 0);
  const maintenanceCosts = maintenanceWorkOrders.reduce(
    (sum, workOrder) => sum + getMaintenanceCost(workOrder),
    0,
  );

  const totalExpenses = cleaningCosts + maintenanceCosts + taxesFees;
  const netProfit = grossRevenue - totalExpenses;

  const recentTransactions = [
    ...bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'Booking revenue',
      property: getPropertyName(booking, properties),
      date: booking.checkIn || booking.check_in || booking.created_at || '—',
      amount: getBookingAmount(booking),
      status: booking.paymentStatus || booking.payment_status || 'unpaid',
    })),
    ...maintenanceWorkOrders.map((workOrder) => ({
      id: `maintenance-${workOrder.id}`,
      type: 'Maintenance cost',
      property: getPropertyName(workOrder, properties),
      date: workOrder.due || workOrder.due_date || workOrder.created_at || '—',
      amount: -getMaintenanceCost(workOrder),
      status: workOrder.status || 'reported',
    })),
    ...cleaningTasks.map((task) => ({
      id: `cleaning-${task.id}`,
      type: 'Cleaning cost',
      property: getPropertyName(task, properties),
      date: task.scheduledFor || task.scheduled_for || task.created_at || '—',
      amount: -getCleaningCost(task),
      status: task.status || 'scheduled',
    })),
  ].slice(0, 10);

  return (
    <AppLayout title="Accountant dashboard" subtitle="Finance-only view for reports, payouts, expenses, and exports">
      <p className="page-note">
        Accountant / Bookkeeper access is finance-focused. This view avoids operational editing and
        focuses on revenue, expenses, owner payouts, reports, receipts, and export preparation.
      </p>

      <div className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={Banknote} />
        <StatCard label="Total expenses" value={formatCurrency(totalExpenses, currency)} icon={Receipt} />
        <StatCard
          label="Net profit"
          value={formatCurrency(netProfit, currency)}
          icon={Banknote}
          tone={netProfit >= 0 ? 'accent' : 'warning'}
        />
        <StatCard label="Owner payouts" value={formatCurrency(ownerPayouts, currency)} icon={FileText} />
      </div>

      <div className="stat-grid dense">
        <StatCard label="Cleaning costs" value={formatCurrency(cleaningCosts, currency)} icon={CalendarCheck} />
        <StatCard label="Maintenance costs" value={formatCurrency(maintenanceCosts, currency)} icon={Wrench} />
        <StatCard label="Taxes / platform fees" value={formatCurrency(taxesFees, currency)} icon={Receipt} />
        <StatCard label="Cleaning fees collected" value={formatCurrency(cleaningFees, currency)} icon={ClipboardList} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Finance exports</h3>
            <p>Export actions are placeholders for the MVP until PDF/CSV generation is wired.</p>
          </div>

          <div className="action-row">
            <button type="button">
              <Download size={16} />
              Export CSV
            </button>
            <button type="button">
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="helper">
          Export buttons are intentionally non-destructive placeholders. Next phase should connect
          them to report generation and CSV/PDF download logic.
        </div>
      </section>

      {propertyRows.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property finance summary</h3>
              <p>Revenue, expenses, net profit, owner payout, and maintenance exposure by property.</p>
            </div>
            <Building2 size={20} />
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
                key: 'openMaintenance',
                label: 'Open repairs',
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title="No property finance records yet."
          description="Property finance summaries will appear once properties, bookings, cleaning tasks, and maintenance records exist."
        />
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Recent finance activity</h3>
              <p>Revenue and cost records pulled from bookings, cleaning, and maintenance.</p>
            </div>
            <Receipt size={20} />
          </div>

          {recentTransactions.length ? (
            recentTransactions.map((transaction) => (
              <div className="list-row" key={transaction.id}>
                <span>
                  {transaction.type}
                  <small>
                    {transaction.property} · {transaction.date}
                  </small>
                </span>
                <span>
                  <strong>{formatCurrency(transaction.amount, currency)}</strong>
                  <StatusBadge>{transaction.status}</StatusBadge>
                </span>
              </div>
            ))
          ) : (
            <p>No finance activity yet.</p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Owner reports</h3>
              <p>Owner report records available to finance users.</p>
            </div>
            <FileText size={20} />
          </div>

          {reports.length ? (
            reports.slice(0, 8).map((report) => (
              <div className="list-row" key={report.id}>
                <span>
                  {report.title || 'Owner report'}
                  <small>{report.period || report.created_at || 'Report period not set'}</small>
                </span>
                <StatusBadge>{report.status || 'ready'}</StatusBadge>
              </div>
            ))
          ) : (
            <p>No owner reports generated yet.</p>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
