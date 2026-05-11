import React from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Home,
  LockKeyhole,
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
import { formatDate, formatPercent } from '../lib/formatters.js';
import { FEATURE_KEYS, getUpgradeMessage, getUsageLimitState, getWorkspacePlan, countOwnerReportsThisMonth, canUseFeature } from '../lib/planLimits.js';
import { logActivity } from '../lib/activityLogs.js';
import { supabase } from '../lib/supabase.js';
import {
  buildCsv,
  buildOwnerReportData,
  calculateExpenseSummary,
  calculateOccupancySummary,
  calculatePropertyPerformance,
  calculateRevenueSummary,
  downloadCsv,
  downloadPdfOrPrintReport,
  formatCurrency,
  formatDateRange,
} from '../lib/reportExports.js';

const financeReportTypes = new Set(['owner_report', 'revenue_report', 'expense_report', 'property_performance_report']);
const operationalReportTypes = new Set(['maintenance_cost_report', 'cleaning_cost_report', 'occupancy_report', 'property_performance_report']);
const ownerVisibleReportStatuses = new Set(['ready', 'released', 'published', 'sent', 'delivered', 'completed', 'exported']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const closedStatuses = new Set(['completed', 'cancelled']);

const reportDefinitions = [
  {
    id: 'owner_report',
    title: 'Owner Reports',
    singularTitle: 'Owner Report',
    category: 'Owner Reports',
    description: 'Assigned property revenue, expenses, net profit, owner payout, occupancy, cleaning, and maintenance summary.',
    icon: FileText,
    advanced: false,
  },
  {
    id: 'revenue_report',
    title: 'Revenue Reports',
    singularTitle: 'Revenue Report',
    category: 'Revenue Reports',
    description: 'Booking revenue, booked nights, average booking value, and property-level revenue totals.',
    icon: BarChart3,
    advanced: true,
  },
  {
    id: 'expense_report',
    title: 'Expense Reports',
    singularTitle: 'Expense Report',
    category: 'Expense Reports',
    description: 'Tracked workspace expenses, cleaning costs, maintenance costs, and category totals.',
    icon: Receipt,
    advanced: true,
  },
  {
    id: 'maintenance_cost_report',
    title: 'Maintenance Cost Reports',
    singularTitle: 'Maintenance Cost Report',
    category: 'Maintenance Cost Reports',
    description: 'Estimated and actual repair costs, open work orders, completed work, and urgent maintenance.',
    icon: Wrench,
    advanced: true,
  },
  {
    id: 'cleaning_cost_report',
    title: 'Cleaning Cost Reports',
    singularTitle: 'Cleaning Cost Report',
    category: 'Cleaning Cost Reports',
    description: 'Cleaning fees/costs, completed turns, guest-ready tasks, and property cleaning workload.',
    icon: Home,
    advanced: true,
  },
  {
    id: 'occupancy_report',
    title: 'Occupancy Reports',
    singularTitle: 'Occupancy Report',
    category: 'Occupancy Reports',
    description: 'Booked nights, available nights, occupancy rate, bookings, and assigned-property occupancy.',
    icon: CalendarDays,
    advanced: true,
  },
  {
    id: 'property_performance_report',
    title: 'Property Performance Reports',
    singularTitle: 'Property Performance Report',
    category: 'Property Performance Reports',
    description: 'Per-property revenue, expenses, net profit, owner payout, occupancy, cleaning, and maintenance activity.',
    icon: FileSpreadsheet,
    advanced: true,
  },
];

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getBookingAmount(booking) {
  return toNumber(booking.totalAmount ?? booking.total_amount ?? booking.amount);
}

function getOwnerPayout(booking) {
  return toNumber(booking.ownerPayout ?? booking.owner_payout);
}

function getMaintenanceCost(item) {
  return toNumber(item.actualCost ?? item.actual_cost ?? item.estimatedCost ?? item.estimated_cost);
}

function getCleaningCost(task) {
  return toNumber(task.actualCost ?? task.actual_cost ?? task.estimatedCost ?? task.estimated_cost ?? task.cleaningFee ?? task.cleaning_fee);
}

function getDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const startDate = getDateValue(start);
  const endDate = getDateValue(end);
  if (startDate && date < startDate) return false;
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
    if (date > endDate) return false;
  }
  return true;
}

function isOwnerRole(currentUser) {
  return Boolean(currentUser?.roles?.includes(roles.OWNER));
}

function getAssignedOwnerId(property) {
  return property.assignedOwnerId || property.assigned_owner_id || property.ownerId || property.owner_id || '';
}

function isAssignedToCurrentOwner(property, currentUser) {
  if (!isOwnerRole(currentUser)) return true;
  const assignedOwnerId = getAssignedOwnerId(property);
  return Boolean(assignedOwnerId && assignedOwnerId === currentUser?.id);
}

function isOwnerVisibleReport(report) {
  return ownerVisibleReportStatuses.has(String(report.status || '').toLowerCase());
}

function canOwnerSeeReport(report, assignedPropertyIds, currentUser) {
  if (!isOwnerRole(currentUser)) return true;
  const reportOwnerId = report.ownerId || report.owner_id;
  return reportOwnerId === currentUser?.id || assignedPropertyIds.has(getPropertyId(report));
}

function getReportDate(report) {
  return report.startDate || report.start_date || report.period_start || report.created_at;
}

function getReportPropertyName(report, properties) {
  const propertyId = getPropertyId(report);
  const property = properties.find((item) => item.id === propertyId);
  return property?.name || report.property || 'Workspace report';
}

function getReportOwnerName(report, ownerContacts, members) {
  const contactId = report.contactId || report.contact_id;
  const ownerId = report.ownerId || report.owner_id;
  const contact = ownerContacts.find((item) => item.id === contactId);
  if (contact) return contact.fullName || contact.full_name || contact.name || contact.email || 'Owner contact';
  const member = members.find((item) => (item.user_id || item.userId || item.id) === ownerId);
  const profile = member?.profile || member?.profiles || {};
  return profile.full_name || profile.name || profile.email || member?.email || member?.user_email || (ownerId ? 'Owner member' : 'Not assigned');
}

function safeText(value, fallback = '—') {
  return value || fallback;
}

function makeFileName(workspaceName, reportTitle, start, end) {
  return [workspaceName || 'propflow', reportTitle, start || 'all-dates', end || 'current']
    .filter(Boolean)
    .join('-');
}

function buildPropertyRows({ properties, bookings, cleaning, maintenance, expenses, currency }) {
  return properties.map((property) => {
    const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
    const propertyCleaning = cleaning.filter((task) => getPropertyId(task) === property.id);
    const propertyMaintenance = maintenance.filter((item) => getPropertyId(item) === property.id);
    const propertyExpenses = expenses.filter((expense) => getPropertyId(expense) === property.id);
    const revenue = propertyBookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0);
    const ownerPayout = propertyBookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0);
    const cleaningCosts = propertyCleaning.reduce((sum, task) => sum + getCleaningCost(task), 0);
    const maintenanceCosts = propertyMaintenance.reduce((sum, item) => sum + getMaintenanceCost(item), 0);
    const manualExpenses = propertyExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const expensesTotal = cleaningCosts + maintenanceCosts + manualExpenses;
    const bookedNights = propertyBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);

    return {
      id: property.id,
      name: property.name || property.address || 'Unnamed property',
      currency: property.currency || currency,
      revenue,
      ownerPayout,
      expenses: expensesTotal,
      manualExpenses,
      cleaningCost: cleaningCosts,
      maintenanceCost: maintenanceCosts,
      netProfit: revenue - expensesTotal,
      occupancy: Math.min((bookedNights / 30) * 100, 100),
      bookings: propertyBookings.length,
      bookedNights,
      cleaningTasks: propertyCleaning.length,
      maintenanceItems: propertyMaintenance.length,
      openMaintenance: propertyMaintenance.filter((item) => !closedStatuses.has(item.status)).length,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

function reportHasData(report) {
  return Array.isArray(report.rows) && report.rows.length > 0;
}

function getReportStatus(report) {
  if (report.locked) return 'locked';
  if (!reportHasData(report)) return 'not enough data';
  return report.status || 'ready';
}

function buildReportPayload(report, workspaceName, filters) {
  return {
    title: report.singularTitle || report.title,
    workspaceName,
    periodStart: filters.start,
    periodEnd: filters.end,
    propertyName: report.propertyName || (filters.propertyId === 'all' ? 'All applicable properties' : report.propertyName),
    ownerName: report.ownerName || 'Not applicable',
    status: getReportStatus(report),
    currency: report.currency,
    summary: report.summary,
    rows: report.rows,
    headers: report.headers,
    notes: report.notes,
  };
}

function hasReportTypeAccess(definition, currentUser) {
  if (hasAnyRole(currentUser, [roles.CLEANER, roles.MAINTENANCE])) return false;
  if (hasAnyRole(currentUser, [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER])) return true;
  if (hasAnyRole(currentUser, [roles.HOST])) return operationalReportTypes.has(definition.id);
  if (hasAnyRole(currentUser, [roles.ACCOUNTANT])) return financeReportTypes.has(definition.id) || definition.id === 'occupancy_report';
  if (isOwnerRole(currentUser)) return ['owner_report', 'occupancy_report', 'property_performance_report'].includes(definition.id);
  return false;
}

function getOwnerReportRows(savedReports, properties, ownerContacts, members, propertyRows, currency) {
  if (savedReports.length) {
    return savedReports.map((report) => ({
      report: report.title || 'Owner report',
      property: getReportPropertyName(report, properties),
      owner: getReportOwnerName(report, ownerContacts, members),
      period: formatDateRange(report.startDate || report.start_date || report.period_start, report.endDate || report.end_date || report.period_end),
      status: report.status || 'draft',
      grossRevenue: '',
      expenses: '',
      netProfit: '',
      ownerPayout: '',
      occupancy: '',
      cleaningCost: '',
      maintenanceCost: '',
      bookings: '',
      maintenanceSummary: '',
      notes: report.notes || report.summary || '',
      attachedReportFile: report.file_id || report.report_file_id ? 'Private file metadata linked' : 'No attached file',
    }));
  }

  return propertyRows
    .filter((row) => row.bookings || row.expenses || row.cleaningTasks || row.maintenanceItems)
    .map((row) => ({
      report: 'Manual owner report preview',
      property: row.name,
      owner: 'Assigned owner',
      period: 'Current filters',
      status: 'ready to export',
      grossRevenue: formatCurrency(row.revenue, row.currency || currency),
      expenses: formatCurrency(row.expenses, row.currency || currency),
      netProfit: formatCurrency(row.netProfit, row.currency || currency),
      ownerPayout: formatCurrency(row.ownerPayout, row.currency || currency),
      occupancy: formatPercent(row.occupancy),
      cleaningCost: formatCurrency(row.cleaningCost, row.currency || currency),
      maintenanceCost: formatCurrency(row.maintenanceCost, row.currency || currency),
      bookings: row.bookings,
      maintenanceSummary: row.openMaintenance ? `${row.openMaintenance} open repairs` : `${row.maintenanceItems} maintenance records`,
      notes: 'Manual local export only; no scheduled delivery.',
      attachedReportFile: 'No attached file',
    }));
}

function buildReportSections({ definitions, savedReports, propertyRows, bookings, expenses, cleaning, maintenance, properties, ownerContacts, members, filters, currency, workspaceName, advancedReportsAccess, ownerReportLimitReached, workspacePlan }) {
  const revenueSummary = calculateRevenueSummary(bookings);
  const expenseSummary = calculateExpenseSummary(expenses);
  const maintenanceSummary = calculateExpenseSummary(maintenance.map((item) => ({ ...item, amount: getMaintenanceCost(item), category: item.priority || item.status || 'maintenance' })));
  const cleaningSummary = calculateExpenseSummary(cleaning.map((task) => ({ ...task, amount: getCleaningCost(task), category: task.status || 'cleaning' })));
  const occupancySummary = calculateOccupancySummary(bookings, properties);
  const performanceSummary = calculatePropertyPerformance(propertyRows);
  const ownerRows = getOwnerReportRows(savedReports, properties, ownerContacts, members, propertyRows, currency);

  const reportRowsByType = {
    owner_report: ownerRows,
    revenue_report: bookings.map((booking) => ({
      property: safeText(properties.find((property) => property.id === getPropertyId(booking))?.name, 'Workspace booking'),
      guest: safeText(booking.guestName || booking.guest_name, 'Guest'),
      checkIn: formatDate(booking.checkIn || booking.check_in, 'Not set'),
      checkOut: formatDate(booking.checkOut || booking.check_out, 'Not set'),
      nights: getBookingNights(booking),
      status: booking.status || 'active',
      revenue: formatCurrency(getBookingAmount(booking), booking.currency || currency),
      ownerPayout: formatCurrency(getOwnerPayout(booking), booking.currency || currency),
    })),
    expense_report: expenses.map((expense) => ({
      date: formatDate(expense.expense_date || expense.expenseDate, 'Not set'),
      property: safeText(properties.find((property) => property.id === getPropertyId(expense))?.name, 'Workspace expense'),
      category: expense.category || 'Expense',
      vendor: expense.vendorName || expense.vendor_name || 'Not set',
      description: expense.description || '—',
      status: expense.paymentStatus || expense.payment_status || expense.expenseStatus || expense.expense_status || 'tracked',
      amount: formatCurrency(expense.amount, expense.currency || currency),
    })),
    maintenance_cost_report: maintenance.map((item) => ({
      date: formatDate(getMaintenanceDate(item), 'Not set'),
      property: safeText(properties.find((property) => property.id === getPropertyId(item))?.name, 'Workspace repair'),
      title: item.title || item.issue || 'Maintenance work order',
      priority: item.priority || 'normal',
      status: item.status || 'open',
      estimatedCost: formatCurrency(item.estimatedCost || item.estimated_cost, item.currency || currency),
      actualCost: formatCurrency(item.actualCost || item.actual_cost || item.estimatedCost || item.estimated_cost, item.currency || currency),
    })),
    cleaning_cost_report: cleaning.map((task) => ({
      date: formatDate(getCleaningDate(task), 'Not set'),
      property: safeText(properties.find((property) => property.id === getPropertyId(task))?.name, 'Workspace cleaning'),
      cleaner: task.cleanerName || task.cleaner_name || 'Assigned cleaner',
      status: task.status || 'scheduled',
      cost: formatCurrency(getCleaningCost(task), task.currency || currency),
      notes: task.notes || task.checklistNotes || task.checklist_notes || '—',
    })),
    occupancy_report: properties.map((property) => {
      const propertyBookings = bookings.filter((booking) => getPropertyId(booking) === property.id);
      const bookedNights = propertyBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
      return {
        property: property.name || property.address || 'Unnamed property',
        bookings: propertyBookings.length,
        bookedNights,
        availableNights: 30,
        occupancy: formatPercent(Math.min((bookedNights / 30) * 100, 100)),
      };
    }).filter((row) => row.bookings || row.bookedNights),
    property_performance_report: propertyRows,
  };

  const summaryByType = {
    owner_report: buildOwnerReportData({ rows: ownerRows, bookings, expenses, cleaning, maintenance, properties, currency, workspaceName }).summary,
    revenue_report: revenueSummary,
    expense_report: { totalExpenses: expenseSummary.totalExpenses, recordCount: expenseSummary.recordCount },
    maintenance_cost_report: { maintenanceCost: maintenanceSummary.totalExpenses, workOrders: maintenance.length, openMaintenance: maintenance.filter((item) => !closedStatuses.has(item.status)).length },
    cleaning_cost_report: { cleaningCost: cleaningSummary.totalExpenses, cleaningTasks: cleaning.length, completedCleaning: cleaning.filter((task) => ['completed', 'guest_ready'].includes(task.status)).length },
    occupancy_report: occupancySummary,
    property_performance_report: performanceSummary,
  };

  const headersByType = {
    owner_report: ['report', 'property', 'owner', 'period', 'status', 'grossRevenue', 'expenses', 'netProfit', 'ownerPayout', 'occupancy', 'cleaningCost', 'maintenanceCost', 'bookings', 'maintenanceSummary', 'notes', 'attachedReportFile'],
    revenue_report: ['property', 'guest', 'checkIn', 'checkOut', 'nights', 'status', 'revenue', 'ownerPayout'],
    expense_report: ['date', 'property', 'category', 'vendor', 'description', 'status', 'amount'],
    maintenance_cost_report: ['date', 'property', 'title', 'priority', 'status', 'estimatedCost', 'actualCost'],
    cleaning_cost_report: ['date', 'property', 'cleaner', 'status', 'cost', 'notes'],
    occupancy_report: ['property', 'bookings', 'bookedNights', 'availableNights', 'occupancy'],
    property_performance_report: ['name', 'bookings', 'bookedNights', 'revenue', 'ownerPayout', 'expenses', 'netProfit', 'occupancy', 'cleaningTasks', 'openMaintenance'].map((key) => ({
      key: (row) => ['revenue', 'ownerPayout', 'expenses', 'netProfit'].includes(key) ? formatCurrency(row[key], row.currency || currency) : key === 'occupancy' ? formatPercent(row.occupancy) : row[key],
      label: key.replace(/([A-Z])/g, ' $1'),
    })),
  };

  return definitions.map((definition) => {
    const locked = definition.advanced && !advancedReportsAccess.allowed;
    const rows = reportRowsByType[definition.id] || [];
    const savedMatches = savedReports.filter((report) => {
      const type = String(report.reportType || report.report_type || '').replace('owner_statement', 'owner_report').replace('property_performance', 'property_performance_report');
      return type === definition.id;
    });
    const lastRecord = savedMatches[0];
    const ownerLimitBlocked = definition.id === 'owner_report' && ownerReportLimitReached && !savedMatches.length;

    return {
      ...definition,
      rows,
      headers: headersByType[definition.id] || [],
      summary: summaryByType[definition.id] || {},
      currency,
      workspaceName,
      locked: locked || ownerLimitBlocked,
      lockMessage: ownerLimitBlocked
        ? `Owner report monthly limit reached on ${workspacePlan.label}. ${getUpgradeMessage(FEATURE_KEYS.OWNER_REPORTS, workspacePlan.key)}`
        : advancedReportsAccess.message || getUpgradeMessage(FEATURE_KEYS.ADVANCED_REPORTS, workspacePlan.key),
      status: lastRecord?.status || (rows.length ? 'ready' : 'not enough data'),
      dateRange: formatDateRange(filters.start, filters.end),
      propertyName: filters.propertyId === 'all' ? 'All applicable properties' : properties.find((property) => property.id === filters.propertyId)?.name,
      lastGenerated: lastRecord?.updated_at || lastRecord?.created_at || null,
      notes: 'This report is for property management review and may require accounting verification.',
    };
  });
}

function ReportPreview({ report, onClose }) {
  if (!report) return null;

  return (
    <section className="card report-preview-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Report preview</p>
          <h3>{report.singularTitle}</h3>
          <p>{report.description}</p>
        </div>
        <button type="button" onClick={onClose} data-skip-create-action="true" aria-label="Close report preview">
          <X size={16} />
          Close
        </button>
      </div>

      <div className="report-preview-summary">
        {Object.entries(report.summary || {}).map(([key, value]) => (
          <div className="report-preview-metric" key={key}>
            <span>{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
            <strong>{/revenue|expense|profit|payout|cost|amount/i.test(key) ? formatCurrency(value, report.currency) : /occupancy|rate/i.test(key) ? formatPercent(value) : value}</strong>
          </div>
        ))}
      </div>

      {report.rows.length ? (
        <DataTable
          rows={report.rows.slice(0, 12)}
          columns={report.headers.map((header) => {
            if (typeof header === 'string') {
              return { key: header, label: header.replace(/([A-Z])/g, ' $1') };
            }
            return { key: header.label || String(header.key), label: header.label, render: (row) => header.key(row) };
          })}
        />
      ) : (
        <EmptyState compact icon={FileText} title="Not enough data to generate this report yet." description="Add real property, booking, expense, cleaning, or maintenance data before exporting this report." />
      )}
    </section>
  );
}

export function ReportsPage() {
  const { data, currentWorkspace, currentUser, session, createInAppNotification } = useApp();
  const [filters, setFilters] = React.useState({ query: '', start: '', end: '', propertyId: 'all', status: 'all' });
  const [selectedReport, setSelectedReport] = React.useState(null);
  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const workspaceName = currentWorkspace?.name || 'PropFlow workspace';
  const ownerView = isOwnerRole(currentUser);
  const blockedRole = hasAnyRole(currentUser, [roles.CLEANER, roles.MAINTENANCE]);
  const workspacePlan = getWorkspacePlan(data.subscription, currentWorkspace);
  const advancedReportsAccess = canUseFeature(currentWorkspace, FEATURE_KEYS.ADVANCED_REPORTS, data.subscription);

  const allProperties = (data.properties || []).filter((property) => property.status !== 'archived');
  const properties = allProperties.filter((property) => isAssignedToCurrentOwner(property, currentUser));
  const assignedPropertyIds = new Set(properties.map((property) => property.id));
  const ownerContacts = (data.contacts || []).filter((contact) => contact.contact_type === 'owner' || contact.contactType === 'owner');
  const members = data.members || [];

  const bookings = (data.bookings || [])
    .filter((booking) => !cancelledStatuses.has(booking.status))
    .filter((booking) => !ownerView || assignedPropertyIds.has(getPropertyId(booking)))
    .filter((booking) => filters.propertyId === 'all' || getPropertyId(booking) === filters.propertyId)
    .filter((booking) => isInDateRange(getBookingDate(booking), filters.start, filters.end));

  const maintenance = (data.maintenanceWorkOrders || [])
    .filter((item) => !ownerView || assignedPropertyIds.has(getPropertyId(item)))
    .filter((item) => filters.propertyId === 'all' || getPropertyId(item) === filters.propertyId)
    .filter((item) => isInDateRange(getMaintenanceDate(item), filters.start, filters.end));

  const cleaning = (data.cleaningTasks || [])
    .filter((task) => !ownerView || assignedPropertyIds.has(getPropertyId(task)))
    .filter((task) => filters.propertyId === 'all' || getPropertyId(task) === filters.propertyId)
    .filter((task) => isInDateRange(getCleaningDate(task), filters.start, filters.end));

  const expenses = (data.expenses || [])
    .filter((expense) => expense.expense_status !== 'archived' && expense.expenseStatus !== 'archived')
    .filter((expense) => !ownerView || assignedPropertyIds.has(getPropertyId(expense)))
    .filter((expense) => filters.propertyId === 'all' || getPropertyId(expense) === filters.propertyId)
    .filter((expense) => isInDateRange(expense.expense_date || expense.expenseDate, filters.start, filters.end));

  const savedOwnerReports = (data.ownerReports || [])
    .filter((report) => canOwnerSeeReport(report, assignedPropertyIds, currentUser))
    .filter((report) => !ownerView || isOwnerVisibleReport(report))
    .filter((report) => filters.propertyId === 'all' || getPropertyId(report) === filters.propertyId)
    .filter((report) => filters.status === 'all' || String(report.status || '').toLowerCase() === filters.status)
    .filter((report) => isInDateRange(getReportDate(report), filters.start, filters.end));

  const propertyRows = buildPropertyRows({ properties: properties.filter((property) => filters.propertyId === 'all' || property.id === filters.propertyId), bookings, cleaning, maintenance, expenses, currency });

  const ownerReportUsage = getUsageLimitState({
    plan: workspacePlan,
    limitKey: 'maxOwnerReportsPerMonth',
    currentCount: countOwnerReportsThisMonth(data.ownerReports || []),
  });

  const visibleDefinitions = reportDefinitions.filter((definition) => hasReportTypeAccess(definition, currentUser));
  const reportSections = buildReportSections({
    definitions: visibleDefinitions,
    savedReports: savedOwnerReports,
    propertyRows,
    bookings,
    expenses,
    cleaning,
    maintenance,
    properties: properties.filter((property) => filters.propertyId === 'all' || property.id === filters.propertyId),
    ownerContacts,
    members,
    filters,
    currency,
    workspaceName,
    advancedReportsAccess,
    ownerReportLimitReached: ownerReportUsage.reached,
    workspacePlan,
  }).filter((report) => {
    const q = filters.query.trim().toLowerCase();
    if (!q) return true;
    return [report.title, report.description, report.category, report.status, report.propertyName].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const summaryTotals = {
    grossRevenue: bookings.reduce((sum, booking) => sum + getBookingAmount(booking), 0),
    expenses: expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0) + maintenance.reduce((sum, item) => sum + getMaintenanceCost(item), 0) + cleaning.reduce((sum, task) => sum + getCleaningCost(task), 0),
    ownerPayout: bookings.reduce((sum, booking) => sum + getOwnerPayout(booking), 0),
    occupancy: calculateOccupancySummary(bookings, properties).occupancyRate,
  };

  const logExport = async (report, format) => {
    await logActivity({
      supabase,
      workspaceId: currentWorkspace?.id,
      actorUserId: session?.user?.id,
      action: 'report_exported',
      metadata: { report_type: report.id, format, rows: report.rows.length, local_export: true },
    });

    if (typeof createInAppNotification === 'function') {
      createInAppNotification({
        recipient_user_id: session?.user?.id,
        event_type: 'report_exported',
        title: `${report.singularTitle} exported`,
        body: `${format.toUpperCase()} export was prepared locally from role-authorized workspace records.`,
        priority: 'normal',
        entity_type: 'report',
        action_url: '/reports',
        channels: ['in_app'],
      }).catch(() => {});
    }
  };

  const handleCsvExport = async (report) => {
    if (!reportHasData(report) || report.locked) return;
    const csv = buildCsv(report.rows, report.headers);
    downloadCsv(makeFileName(workspaceName, report.id, filters.start, filters.end), csv);
    await logExport(report, 'csv');
  };

  const handlePdfExport = async (report) => {
    if (!reportHasData(report) || report.locked) return;
    downloadPdfOrPrintReport(buildReportPayload(report, workspaceName, filters));
    await logExport(report, 'pdf');
  };

  const clearFilters = () => setFilters({ query: '', start: '', end: '', propertyId: 'all', status: 'all' });

  if (blockedRole) {
    return (
      <AppLayout title="Reports" subtitle="Role-safe reporting access">
        <EmptyState
          icon={LockKeyhole}
          title="Reports are not available for this role"
          description="Cleaner and maintenance crew accounts do not have finance or owner report center access. Use your assigned task dashboard for permitted work history."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Reports & Exports"
      subtitle={ownerView ? 'Assigned-property reports and local CSV/PDF export previews.' : 'Owner, finance, operations, occupancy, and property performance reports.'}
    >
      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Safe MVP reports</p>
            <h3>Manual CSV and print-to-PDF exports from authorized records</h3>
            <p>
              Exports use only data already visible to this role in the active workspace. No bank integrations, reconciliation, tax filing, scheduled sending, public report links, or AI summaries are included.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>
      </section>

      {ownerView && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Owner visibility</p>
              <h3>Reports are scoped to assigned properties</h3>
              <p>Owner exports only use assigned-property records and released/ready owner report metadata returned by Supabase RLS.</p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(summaryTotals.grossRevenue, currency)} icon={BarChart3} />
        <StatCard label="Expenses" value={formatCurrency(summaryTotals.expenses, currency)} icon={Receipt} />
        <StatCard label="Net profit" value={formatCurrency(summaryTotals.grossRevenue - summaryTotals.expenses, currency)} icon={FileSpreadsheet} />
        <StatCard label="Owner payout" value={formatCurrency(summaryTotals.ownerPayout, currency)} icon={Home} />
        <StatCard label="Occupancy" value={formatPercent(summaryTotals.occupancy)} icon={CalendarDays} />
      </section>

      {!advancedReportsAccess.allowed && !ownerView && (
        <section className="card finance-safety-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Plan limits</p>
              <h3>Advanced reports require Pro or Business</h3>
              <p>{advancedReportsAccess.message || getUpgradeMessage(FEATURE_KEYS.ADVANCED_REPORTS, workspacePlan.key)}</p>
            </div>
            <StatusBadge tone="warning">Upgrade required</StatusBadge>
          </div>
        </section>
      )}

      <section className="card reports-toolbar finance-actions-toolbar">
        <div>
          <h3>Reporting center</h3>
          <p>Filter reports by date and property, view the data first, then export CSV or open a printable PDF view.</p>
        </div>
        <div className="reports-toolbar-actions">
          <StatusBadge tone="info">{workspacePlan.label}</StatusBadge>
          <StatusBadge tone={ownerReportUsage.reached ? 'warning' : 'success'}>Owner reports {ownerReportUsage.label}</StatusBadge>
        </div>
      </section>

      <section className="card">
        <div className="reports-filters">
          <label className="reports-search">
            <Search size={16} />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search report sections..." aria-label="Search report sections" />
            {filters.query && (
              <button type="button" className="search-clear" onClick={() => setFilters((current) => ({ ...current, query: '' }))} aria-label="Clear report search" data-skip-create-action="true">
                <X size={14} />
              </button>
            )}
          </label>
          <label>Start<input type="date" value={filters.start} onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input type="date" value={filters.end} onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))} /></label>
          <label>
            Property
            <select value={filters.propertyId} onChange={(event) => setFilters((current) => ({ ...current, propertyId: event.target.value }))}>
              <option value="all">All applicable properties</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name || property.address || 'Unnamed property'}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="released">Released</option>
              <option value="exported">Exported</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button type="button" onClick={clearFilters} data-skip-create-action="true">Clear filters</button>
        </div>
      </section>

      {selectedReport && <ReportPreview report={selectedReport} onClose={() => setSelectedReport(null)} />}

      {reportSections.length ? (
        <section className="reports-type-grid reports-foundation-grid">
          {reportSections.map((report) => {
            const Icon = report.icon;
            const hasData = reportHasData(report);
            const disabled = !hasData || report.locked;
            return (
              <article className="card report-type-card report-foundation-card" key={report.id}>
                <div className="report-type-icon"><Icon size={20} /></div>
                <div>
                  <p className="eyebrow">{report.category}</p>
                  <h3>{report.title}</h3>
                  <p>{report.description}</p>
                </div>
                <div className="report-card-meta">
                  <span><strong>Date range</strong>{report.dateRange}</span>
                  <span><strong>Property filter</strong>{report.propertyName || 'All applicable properties'}</span>
                  <span><strong>Last generated/exported</strong>{report.lastGenerated ? formatDate(report.lastGenerated) : 'Local export only'}</span>
                </div>
                <StatusBadge tone={report.locked ? 'warning' : hasData ? 'success' : 'info'}>{getReportStatus(report)}</StatusBadge>
                {!hasData && <div className="helper">Not enough data to generate this report yet.</div>}
                {report.locked && <div className="helper warning-helper">{report.lockMessage}</div>}
                <div className="report-type-actions">
                  <button type="button" onClick={() => setSelectedReport(report)} disabled={!hasData} data-skip-create-action="true"><Eye size={16} />View</button>
                  <button type="button" onClick={() => handleCsvExport(report)} disabled={disabled} data-skip-create-action="true"><Download size={16} />Export CSV</button>
                  <button type="button" onClick={() => handlePdfExport(report)} disabled={disabled} data-skip-create-action="true"><FileText size={16} />Export PDF / Print PDF</button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={FileText} title="No reports yet. Create your first report once property, booking, expense, cleaning, or maintenance data is available." description="No report sections are visible for the current filters and role." />
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>{ownerView ? 'Released owner report records' : 'Saved owner report metadata'}</h3>
            <p>Workspace-scoped owner report metadata can reference private file uploads without exposing signed URLs in exports.</p>
          </div>
          <StatusBadge tone="info">Supabase RLS scoped</StatusBadge>
        </div>
        {savedOwnerReports.length ? (
          <DataTable rows={savedOwnerReports} columns={[
            { key: 'title', label: 'Report', render: (row) => row.title || 'Owner report' },
            { key: 'report_type', label: 'Type', render: (row) => String(row.reportType || row.report_type || 'owner_report').replaceAll('_', ' ') },
            { key: 'property_id', label: 'Property', render: (row) => getReportPropertyName(row, properties) },
            { key: 'owner_id', label: 'Owner', render: (row) => getReportOwnerName(row, ownerContacts, members) },
            { key: 'period', label: 'Date range', render: (row) => formatDateRange(row.startDate || row.start_date || row.period_start, row.endDate || row.end_date || row.period_end) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge>{row.status || 'draft'}</StatusBadge> },
            { key: 'file', label: 'Attached report file', render: (row) => row.file_id || row.report_file_id ? 'Private file metadata linked' : 'No attached file' },
            { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at, 'Not available') },
          ]} />
        ) : (
          <EmptyState compact icon={FileText} title={ownerView ? 'No released reports yet' : 'No saved report records'} description="No reports yet. Create your first report once property, booking, expense, cleaning, or maintenance data is available." />
        )}
      </section>
    </AppLayout>
  );
}
