import React from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Home,
  Receipt,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatPercent } from '../lib/formatters.js';

const reportTypes = [
  {
    id: 'owner_statement',
    title: 'Owner Statement',
    description: 'Revenue, expenses, owner payout, maintenance, cleaning, and assigned property summary.',
  },
  {
    id: 'revenue_report',
    title: 'Revenue Report',
    description: 'Booking revenue, direct booking revenue, payment status, and property-level totals.',
  },
  {
    id: 'expense_report',
    title: 'Expense Report',
    description: 'Maintenance, cleaning, supplies, taxes, platform fees, and other tracked expenses.',
  },
  {
    id: 'occupancy_report',
    title: 'Occupancy Report',
    description: 'Booked nights, available nights, occupancy rate, check-ins, and check-outs.',
  },
  {
    id: 'maintenance_cost_report',
    title: 'Maintenance Cost Report',
    description: 'Estimated cost, actual cost, open repairs, completed repairs, and urgent issues.',
  },
  {
    id: 'cleaning_cost_report',
    title: 'Cleaning Cost Report',
    description: 'Completed cleanings, guest-ready status, supplies used, and cleaning cost tracking.',
  },
  {
    id: 'booking_summary',
    title: 'Booking Summary',
    description: 'Guest stays, booking source, dates, payment status, and booking totals.',
  },
  {
    id: 'property_performance',
    title: 'Property Performance',
    description: 'Per-property revenue, expenses, net profit, occupancy, repairs, and operations health.',
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
  return safeNumber(task.actualCost || task.actual_cost || task.estimatedCost || task.estimated_cost);
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

function buildPropertyRows({ properties, bookings, cleaning, maintenance, currency }) {
  return properties
    .filter((property) => property.status !== 'archived')
    .map((property) => {
      const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
      const propertyCleaning = cleaning.filter((task) => getPropertyId(task) === property.id);
      const propertyMaintenance = maintenance.filter((item) => getPropertyId(item) === property.id);

      const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
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
        expenses,
        netProfit,
        occupancy,
        bookings: propertyBookings.length,
        openMaintenance: propertyMaintenance.filter((item) => !closedStatuses.has(item.status)).length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function ReportsPage() {
  const { data, currentWorkspace } = useApp();

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const bookings = (data.bookings || []).filter((booking) => !cancelledStatuses.has(booking.status));
  const maintenance = data.maintenanceWorkOrders || [];
  const cleaning = data.cleaningTasks || [];
  const properties = data.properties || [];
  const ownerReports = data.ownerReports || [];

  const grossRevenue = bookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
  const ownerPayouts = bookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
  const maintenanceCosts = maintenance.reduce((sum, item) => sum + getMaintenanceCost(item), 0);
  const cleaningCosts = cleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
  const totalExpenses = maintenanceCosts + cleaningCosts;
  const netProfit = grossRevenue - totalExpenses;

  const bookedNights = bookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
  const availableNights = Math.max(properties.filter((property) => property.status !== 'archived').length * 30, 1);
  const occupancyRate = Math.min((bookedNights / availableNights) * 100, 100);

  const completedCleaning = cleaning.filter((task) => ['completed', 'guest_ready'].includes(task.status)).length;
  const openMaintenance = maintenance.filter((item) => !closedStatuses.has(item.status)).length;

  const propertyRows = buildPropertyRows({
    properties,
    bookings,
    cleaning,
    maintenance,
    currency,
  });

  const exportHistory = ownerReports.map((report) => ({
    id: report.id,
    report_type: report.title || report.report_type || 'Owner report',
    format: report.format || 'PDF',
    status: report.status || 'ready',
    created_at: report.created_at || report.period || '—',
  }));

  return (
    <AppLayout title="Reports & Exports" subtitle="Owner reports, finance summaries, operations reports, and export preparation">
      <div className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={BarChart3} />
        <StatCard label="Net profit" value={formatCurrency(netProfit, currency)} icon={FileSpreadsheet} />
        <StatCard label="Owner payouts" value={formatCurrency(ownerPayouts, currency)} icon={Receipt} />
        <StatCard label="Occupancy rate" value={formatPercent(occupancyRate)} icon={CalendarDays} />
      </div>

      <div className="stat-grid dense">
        <StatCard label="Maintenance costs" value={formatCurrency(maintenanceCosts, currency)} icon={Wrench} />
        <StatCard label="Cleaning costs" value={formatCurrency(cleaningCosts, currency)} icon={Home} />
        <StatCard label="Completed cleanings" value={completedCleaning} icon={Download} />
        <StatCard label="Open maintenance" value={openMaintenance} icon={Wrench} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Report center</h3>
            <p>
              Manual report generation comes first. Scheduled weekly, monthly, and quarterly owner
              reports should use this same report structure in the next backend phase.
            </p>
          </div>

          <StatusBadge tone="info">foundation</StatusBadge>
        </div>

        <div className="panel-grid two">
          {reportTypes.map((report) => (
            <section className="card compact" key={report.id}>
              <div className="card-header">
                <div>
                  <h3>{report.title}</h3>
                  <p>{report.description}</p>
                </div>
              </div>

              <div className="action-row">
                <button type="button" disabled>
                  <Download size={16} />
                  CSV
                </button>

                <button className="primary" type="button" disabled>
                  <Download size={16} />
                  PDF
                </button>
              </div>

              <div className="helper">
                Export generation is intentionally disabled until CSV/PDF backend logic is wired.
              </div>
            </section>
          ))}
        </div>
      </section>

      {propertyRows.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property performance report</h3>
              <p>Preview of the report data used for owner statements and property performance exports.</p>
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
                label: 'Open repairs',
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title="No report data yet."
          description="Add properties, bookings, cleaning tasks, and maintenance work orders to generate useful report previews."
        />
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Scheduled reports</h3>
              <p>Owner statements and recurring exports.</p>
            </div>
          </div>

          <EmptyState
            title="No scheduled reports configured"
            description="Automated weekly, monthly, and quarterly exports can be enabled after backend report jobs are configured."
          />
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Export history</h3>
              <p>Track generated PDF and CSV exports.</p>
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
                },
              ]}
            />
          ) : (
            <EmptyState
              title="No exports generated yet"
              description="Report export history will appear here after PDF or CSV exports are generated."
            />
          )}
        </section>
      </div>
    </AppLayout>
  );
}
