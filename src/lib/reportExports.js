const DEFAULT_CURRENCY = 'USD';
const PRINT_DISCLAIMER = 'This report is for property management review and may require accounting verification.';

function toNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? number : fallback;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRecordAmount(record = {}) {
  return toNumber(record.amount ?? record.totalAmount ?? record.total_amount ?? record.ownerPayout ?? record.owner_payout);
}

function getBookingAmount(booking = {}) {
  return toNumber(booking.totalAmount ?? booking.total_amount ?? booking.amount ?? booking.revenue);
}

function getExpenseAmount(expense = {}) {
  return toNumber(expense.amount ?? expense.actualCost ?? expense.actual_cost ?? expense.estimatedCost ?? expense.estimated_cost ?? expense.cleaningFee ?? expense.cleaning_fee);
}

function daysBetween(start, end) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate || endDate <= startDate) return 0;
  return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
}

function getBookingNights(booking = {}) {
  return daysBetween(booking.checkIn ?? booking.check_in, booking.checkOut ?? booking.check_out);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value = 'report') {
  return String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

export function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || DEFAULT_CURRENCY).toUpperCase(),
      maximumFractionDigits: 2,
    }).format(toNumber(value));
  } catch {
    return toNumber(value).toFixed(2);
  }
}

export function formatDateRange(start, end) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate && !endDate) return 'All available dates';
  if (startDate && !endDate) return `${formatter.format(startDate)} – Present`;
  if (!startDate && endDate) return `Through ${formatter.format(endDate)}`;
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function calculateRevenueSummary(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const grossRevenue = safeRecords.reduce((sum, record) => sum + getBookingAmount(record), 0);
  const ownerPayout = safeRecords.reduce((sum, record) => sum + toNumber(record.ownerPayout ?? record.owner_payout), 0);
  const bookedNights = safeRecords.reduce((sum, record) => sum + getBookingNights(record), 0);

  return {
    recordCount: safeRecords.length,
    grossRevenue,
    ownerPayout,
    bookedNights,
    averageBookingValue: safeRecords.length ? grossRevenue / safeRecords.length : 0,
  };
}

export function calculateExpenseSummary(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const totalExpenses = safeRecords.reduce((sum, record) => sum + getExpenseAmount(record), 0);
  const byCategory = safeRecords.reduce((map, record) => {
    const category = record.category || record.type || record.expense_category || 'uncategorized';
    map[category] = (map[category] || 0) + getExpenseAmount(record);
    return map;
  }, {});

  return {
    recordCount: safeRecords.length,
    totalExpenses,
    byCategory,
    averageExpense: safeRecords.length ? totalExpenses / safeRecords.length : 0,
  };
}

export function calculateOccupancySummary(bookings = [], properties = []) {
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const activeProperties = (Array.isArray(properties) ? properties : []).filter((property) => property.status !== 'archived');
  const bookedNights = safeBookings.reduce((sum, booking) => sum + getBookingNights(booking), 0);
  const availableNights = Math.max(activeProperties.length * 30, 0);

  return {
    propertyCount: activeProperties.length,
    bookingCount: safeBookings.length,
    bookedNights,
    availableNights,
    occupancyRate: availableNights ? Math.min((bookedNights / availableNights) * 100, 100) : 0,
  };
}

export function calculatePropertyPerformance(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const revenue = safeRecords.reduce((sum, record) => sum + toNumber(record.revenue ?? record.grossRevenue ?? record.gross_revenue), 0);
  const expenses = safeRecords.reduce((sum, record) => sum + toNumber(record.expenses ?? record.totalExpenses ?? record.total_expenses), 0);
  const netProfit = safeRecords.reduce((sum, record) => sum + toNumber(record.netProfit ?? record.net_profit ?? ((record.revenue || 0) - (record.expenses || 0))), 0);

  return {
    propertyCount: safeRecords.length,
    revenue,
    expenses,
    netProfit,
    averageOccupancy: safeRecords.length
      ? safeRecords.reduce((sum, record) => sum + toNumber(record.occupancy ?? record.occupancyRate ?? record.occupancy_rate), 0) / safeRecords.length
      : 0,
  };
}

export function buildOwnerReportData(payload = {}) {
  const currency = payload.currency || DEFAULT_CURRENCY;
  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const cleaning = Array.isArray(payload.cleaning) ? payload.cleaning : [];
  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];
  const revenueSummary = calculateRevenueSummary(bookings);
  const expenseSummary = calculateExpenseSummary([...expenses, ...cleaning, ...maintenance]);
  const occupancySummary = calculateOccupancySummary(bookings, payload.property ? [payload.property] : payload.properties || []);
  const cleaningCost = cleaning.reduce((sum, record) => sum + getExpenseAmount(record), 0);
  const maintenanceCost = maintenance.reduce((sum, record) => sum + getExpenseAmount(record), 0);
  const grossRevenue = revenueSummary.grossRevenue;
  const totalExpenses = expenseSummary.totalExpenses;
  const ownerPayout = toNumber(payload.ownerPayout ?? revenueSummary.ownerPayout);

  return {
    title: payload.title || 'Owner Report',
    workspaceName: payload.workspaceName || 'PropFlow workspace',
    propertyName: payload.propertyName || payload.property?.name || 'Assigned property',
    ownerName: payload.ownerName || 'Owner',
    periodStart: payload.periodStart || payload.startDate || null,
    periodEnd: payload.periodEnd || payload.endDate || null,
    currency,
    summary: {
      grossRevenue,
      expenses: totalExpenses,
      netProfit: grossRevenue - totalExpenses,
      ownerPayout,
      occupancy: occupancySummary.occupancyRate,
      cleaningCost,
      maintenanceCost,
      bookings: bookings.length,
      maintenanceItems: maintenance.length,
    },
    rows: payload.rows || [],
    notes: payload.notes || payload.managerMessage || '',
    disclaimer: PRINT_DISCLAIMER,
  };
}

function getHeaderValue(header) {
  if (typeof header === 'string') return { key: header, label: header };
  return { key: header.key, label: header.label || header.key };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const clean = String(value).replace(/\r?\n|\r/g, ' ').trim();
  if (/[",\n]/.test(clean)) return `"${clean.replace(/"/g, '""')}"`;
  return clean;
}

export function buildCsv(rows = [], headers = []) {
  const safeHeaders = headers.map(getHeaderValue).filter((header) => header.key);
  const safeRows = Array.isArray(rows) ? rows : [];
  return [
    safeHeaders.map((header) => csvEscape(header.label)).join(','),
    ...safeRows.map((row) => safeHeaders.map((header) => {
      const value = typeof header.key === 'function' ? header.key(row) : row?.[header.key];
      return csvEscape(value);
    }).join(',')),
  ].join('\n');
}

export function downloadCsv(filename, csvContent) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([`\ufeff${csvContent || ''}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(filename || 'propflow-report')}.csv`;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function buildPrintableReportHtml(reportData = {}) {
  const currency = reportData.currency || DEFAULT_CURRENCY;
  const summaryEntries = Object.entries(reportData.summary || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  const rows = Array.isArray(reportData.rows) ? reportData.rows : [];
  const headers = Array.isArray(reportData.headers) ? reportData.headers.map(getHeaderValue).filter((header) => header.key) : [];
  const generatedAt = new Date().toLocaleString();

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(reportData.title || 'PropFlow Report')}</title>
<style>
  :root { color: #0F172A; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  body { margin: 0; background: #F7F8FA; }
  .report { max-width: 1080px; margin: 0 auto; padding: 32px; }
  .header, .card { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 18px; padding: 24px; margin-bottom: 18px; }
  .brand { color: #1B998B; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
  h1 { margin: 8px 0; color: #0B2545; font-size: 30px; }
  p { color: #64748B; line-height: 1.5; }
  .meta, .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .metric { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; background: #FBFCFD; }
  .label { color: #64748B; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .value { display: block; margin-top: 6px; font-size: 18px; font-weight: 800; color: #0F172A; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #E5E7EB; padding: 11px 10px; text-align: left; vertical-align: top; }
  th { color: #0B2545; background: #F7F8FA; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .disclaimer { border-left: 4px solid #1B998B; padding-left: 14px; color: #64748B; }
  @media print { body { background: #FFFFFF; } .report { padding: 0; } .header, .card { break-inside: avoid; } }
  @media (max-width: 720px) { .report { padding: 16px; } .meta, .summary { grid-template-columns: 1fr; } table { display: block; overflow-x: auto; white-space: nowrap; } }
</style>
</head>
<body>
  <main class="report">
    <section class="header">
      <div class="brand">PropFlow</div>
      <h1>${escapeHtml(reportData.title || 'Property Management Report')}</h1>
      <p>${escapeHtml(reportData.workspaceName || 'Workspace')} · ${escapeHtml(formatDateRange(reportData.periodStart, reportData.periodEnd))}</p>
      <div class="meta">
        <div class="metric"><span class="label">Generated</span><span class="value">${escapeHtml(generatedAt)}</span></div>
        <div class="metric"><span class="label">Property</span><span class="value">${escapeHtml(reportData.propertyName || 'All applicable')}</span></div>
        <div class="metric"><span class="label">Owner</span><span class="value">${escapeHtml(reportData.ownerName || 'Not applicable')}</span></div>
        <div class="metric"><span class="label">Status</span><span class="value">${escapeHtml(reportData.status || 'Ready to review')}</span></div>
      </div>
    </section>
    <section class="card">
      <h2>Summary</h2>
      <div class="summary">
        ${summaryEntries.map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
          const display = /revenue|expense|profit|payout|cost|amount/i.test(key) ? formatCurrency(value, currency) : /occupancy|rate/i.test(key) ? `${Math.round(toNumber(value))}%` : value;
          return `<div class="metric"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(display)}</span></div>`;
        }).join('') || '<p>No summary metrics available.</p>'}
      </div>
    </section>
    <section class="card">
      <h2>Report details</h2>
      ${headers.length && rows.length ? `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(typeof header.key === 'function' ? header.key(row) : row?.[header.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>Not enough row-level data to include a table for this report.</p>'}
    </section>
    ${reportData.notes ? `<section class="card"><h2>Notes</h2><p>${escapeHtml(reportData.notes)}</p></section>` : ''}
    <section class="card"><p class="disclaimer">${escapeHtml(reportData.disclaimer || PRINT_DISCLAIMER)}</p></section>
  </main>
</body>
</html>`;
}

export function downloadPdfOrPrintReport(reportData = {}) {
  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(buildPrintableReportHtml(reportData));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}
