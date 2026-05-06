import React from 'react';
import { BarChart3, CalendarDays, Download, FileSpreadsheet } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';

const reportTypes = [
  'Owner Statement',
  'Revenue Report',
  'Expense Report',
  'Occupancy Report',
  'Maintenance Cost Report',
  'Cleaning Cost Report',
  'Booking Summary',
  'Property Performance',
];

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function ReportsPage() {
  const { data, currentWorkspace } = useApp();

  const currency = currentWorkspace?.defaultCurrency || 'USD';
  const bookings = data.bookings || [];
  const maintenance = data.maintenanceWorkOrders || [];
  const cleaning = data.cleaningTasks || [];

  const grossRevenue = bookings.reduce((sum, booking) => sum + safeNumber(booking.total_amount || booking.totalAmount), 0);
  const ownerPayouts = bookings.reduce((sum, booking) => sum + safeNumber(booking.owner_payout || booking.ownerPayout), 0);
  const maintenanceCosts = maintenance.reduce((sum, item) => sum + safeNumber(item.actual_cost || item.actualCost || item.estimated_cost || item.estimatedCost), 0);
  const cleaningCompleted = cleaning.filter((task) => ['completed', 'guest_ready'].includes(task.status)).length;

  const exportHistory = [];

  return (
    <AppLayout title="Reports & Exports">
      <div className="stats-grid compact">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, currency)} icon={BarChart3} />
        <StatCard label="Owner payouts" value={formatCurrency(ownerPayouts, currency)} icon={FileSpreadsheet} />
        <StatCard label="Maintenance costs" value={formatCurrency(maintenanceCosts, currency)} icon={CalendarDays} />
        <StatCard label="Completed cleaning tasks" value={cleaningCompleted} icon={Download} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Report center</h3>
            <p>Operational reporting foundation for workspace exports and owner statements.</p>
          </div>
          <StatusBadge tone="info">foundation</StatusBadge>
        </div>

        <div className="plan-grid">
          {reportTypes.map((report) => (
            <div className="plan-card" key={report}>
              <div>
                <h4>{report}</h4>
                <p>CSV/PDF export pipeline foundation ready for backend automation.</p>
              </div>
              <div className="button-row">
                <button className="secondary" type="button">CSV</button>
                <button className="primary" type="button">PDF</button>
              </div>
            </div>
          ))}
        </div>
      </section>

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
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.report_type}</td>
                    <td>{item.format}</td>
                    <td><StatusBadge>{item.status}</StatusBadge></td>
                    <td>{item.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No exports generated yet"
            description="Report export history will appear here after PDF or CSV exports are generated."
          />
        )}
      </section>
    </AppLayout>
  );
}
