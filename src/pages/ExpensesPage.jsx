import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { expenseCategories, expensePaymentStatuses, expenseStatuses, roles } from '../data/constants.js';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import '../styles/expense-finance-safety.css';

const manageRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const expenseCreateRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
const financeViewRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const hostHiddenCategories = new Set(['owner_payout', 'property_tax', 'insurance']);

function hasAnyRole(currentUser, allowedRoles) {
  return allowedRoles.some((role) => currentUser?.roles?.includes(role));
}

function labelFor(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] || String(value || 'Unknown').replaceAll('_', ' ');
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();
  if (['archived', 'cancelled', 'unpaid'].includes(status)) return 'error';
  if (['pending', 'draft'].includes(status)) return 'warning';
  if (['paid', 'reimbursed', 'active'].includes(status)) return 'success';
  return 'info';
}

function getPropertyName(expense, properties) {
  const property = properties.find((item) => item.id === (expense.property_id || expense.propertyId));
  return property?.name || expense.property || 'Workspace-level expense';
}

function relatedContext(expense, data) {
  if (expense.booking_id) {
    const booking = (data.bookings || []).find((item) => item.id === expense.booking_id);
    return `Booking · ${booking?.guestName || booking?.guest_name || 'linked'}`;
  }
  if (expense.cleaning_task_id) return 'Cleaning task linked';
  if (expense.maintenance_work_order_id) return 'Maintenance work order linked';
  if (expense.contact_id) {
    const contact = (data.contacts || []).find((item) => item.id === expense.contact_id);
    return `Contact · ${contact?.name || contact?.fullName || contact?.full_name || 'linked'}`;
  }
  return 'Manual expense';
}

function isInDateRange(value, start, end) {
  if (!value) return !start && !end;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (start && date < new Date(`${start}T00:00:00`)) return false;
  if (end && date > new Date(`${end}T23:59:59`)) return false;
  return true;
}

export function ExpensesPage() {
  const app = useApp();
  const { currentUser, data, archiveExpense } = app;
  const properties = data.properties || [];
  const canAccessFinance = hasAnyRole(currentUser, financeViewRoles);
  const canManageExpenses = hasAnyRole(currentUser, manageRoles);
  const canCreateExpenses = hasAnyRole(currentUser, expenseCreateRoles);
  const isHostOnly = currentUser?.roles?.includes(roles.HOST) && !hasAnyRole(currentUser, [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.ACCOUNTANT]);
  const [filters, setFilters] = React.useState({
    query: '',
    propertyId: 'all',
    category: 'all',
    paymentStatus: 'all',
    expenseStatus: 'active',
    start: '',
    end: '',
  });
  const [busyId, setBusyId] = React.useState('');
  const [pageError, setPageError] = React.useState('');

  if (!canAccessFinance) {
    return (
      <AppLayout title="Expenses" subtitle="Role-safe expense visibility for permitted finance and operations users.">
        <EmptyState
          eyebrow="Access protected"
          icon={ShieldCheck}
          title="Expense details are not available for this role"
          description="Owners, cleaners, and maintenance users do not receive raw workspace expense ledger access from this page."
        />
      </AppLayout>
    );
  }

  const visibleExpenses = (data.expenses || [])
    .filter((expense) => !isHostOnly || !hostHiddenCategories.has(expense.category))
    .filter((expense) => filters.propertyId === 'all' || (expense.property_id || expense.propertyId || '') === filters.propertyId)
    .filter((expense) => filters.category === 'all' || expense.category === filters.category)
    .filter((expense) => filters.paymentStatus === 'all' || expense.payment_status === filters.paymentStatus)
    .filter((expense) => filters.expenseStatus === 'all' || expense.expense_status === filters.expenseStatus)
    .filter((expense) => isInDateRange(expense.expense_date || expense.expenseDate, filters.start, filters.end))
    .filter((expense) => {
      const query = filters.query.trim().toLowerCase();
      if (!query) return true;
      return [
        expense.description,
        expense.vendor_name,
        expense.vendorName,
        getPropertyName(expense, properties),
        labelFor(expenseCategories, expense.category),
        expense.payment_status,
        expense.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

  const activeTotal = visibleExpenses
    .filter((expense) => expense.expense_status !== 'archived')
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const displayCurrency = visibleExpenses[0]?.currency || app.currentWorkspace?.defaultCurrency || 'USD';

  const clearFilters = () => setFilters({ query: '', propertyId: 'all', category: 'all', paymentStatus: 'all', expenseStatus: 'active', start: '', end: '' });

  const toggleArchive = async (expense, archived) => {
    if (!canManageExpenses) return;
    setPageError('');
    setBusyId(expense.id);
    try {
      await archiveExpense(expense.id, archived);
    } catch (error) {
      setPageError(error?.message || 'Expense could not be updated.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <AppLayout
      title="Expenses"
      subtitle="Workspace-scoped manual expense tracking with exports and accounting automation kept placeholder-safe."
    >
      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Finance safety</p>
            <h3>Manual expenses are real records; exports remain disabled</h3>
            <p>
              Expenses are loaded from Supabase for the current workspace. CSV/PDF exports, tax filing, Stripe, payments, receipt upload, and accounting automation are not active in this module.
            </p>
          </div>
          <ShieldCheck size={22} className="muted" />
        </div>
        <div className="helper">
          Accountant users can review expenses and finance previews but cannot create or edit expenses in this PR. Owner payout and sensitive categories are hidden from Host-only views.
        </div>
      </section>

      <section className="finance-safety-grid">
        <article className="card finance-safety-card">
          <div className="finance-safety-card-icon"><Receipt size={18} /></div>
          <div><h3>{visibleExpenses.length}</h3><p>Visible manual expenses</p></div>
          <StatusBadge tone="success">real records</StatusBadge>
        </article>
        <article className="card finance-safety-card">
          <div className="finance-safety-card-icon"><FileText size={18} /></div>
          <div><h3>{formatCurrency(activeTotal, displayCurrency)}</h3><p>Filtered active total</p></div>
          <StatusBadge tone="info">preview</StatusBadge>
        </article>
        <article className="card finance-safety-card">
          <div className="finance-safety-card-icon"><Download size={18} /></div>
          <div><h3>Exports disabled</h3><p>Backend CSV/PDF generation is coming later.</p></div>
          <StatusBadge tone="warning">coming soon</StatusBadge>
        </article>
        <article className="card finance-safety-card">
          <div className="finance-safety-card-icon"><CalendarDays size={18} /></div>
          <div><h3>Receipt upload pending</h3><p>Private receipt storage will be connected later.</p></div>
          <StatusBadge tone="info">placeholder</StatusBadge>
        </article>
      </section>

      <section className="card reports-toolbar finance-actions-toolbar">
        <div>
          <h3>Expense actions</h3>
          <p>{canCreateExpenses ? 'Add a manual expense with the shared create modal.' : 'Your role is read-only for expense records.'}</p>
        </div>
        <div className="reports-toolbar-actions">
          <button type="button" className="primary" disabled={!canCreateExpenses}>
            <Plus size={16} /> Add Expense
          </button>
          <button type="button" disabled data-skip-create-action="true" title="CSV export will be connected after backend export generation is added.">
            <Download size={16} /> CSV coming soon
          </button>
          <button type="button" disabled data-skip-create-action="true" title="PDF export will be connected after backend export generation is added.">
            <FileText size={16} /> PDF coming soon
          </button>
        </div>
      </section>

      <section className="card">
        <div className="expense-filter-grid">
          <label className="expense-search">
            <Search size={16} />
            <input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search description, vendor, property, category, status, notes..." />
            {filters.query && <button type="button" className="search-clear" onClick={() => setFilters((current) => ({ ...current, query: '' }))} data-skip-create-action="true"><X size={14} /></button>}
          </label>
          <label>Property<select value={filters.propertyId} onChange={(event) => setFilters((current) => ({ ...current, propertyId: event.target.value }))}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Category<select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="all">All categories</option>{expenseCategories.filter(([value]) => !isHostOnly || !hostHiddenCategories.has(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Payment<select value={filters.paymentStatus} onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}><option value="all">All payments</option>{expensePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Status<select value={filters.expenseStatus} onChange={(event) => setFilters((current) => ({ ...current, expenseStatus: event.target.value }))}><option value="all">All records</option>{expenseStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Start<input type="date" value={filters.start} onChange={(event) => setFilters((current) => ({ ...current, start: event.target.value }))} /></label>
          <label>End<input type="date" value={filters.end} onChange={(event) => setFilters((current) => ({ ...current, end: event.target.value }))} /></label>
          <button type="button" onClick={clearFilters} data-skip-create-action="true">Clear filters</button>
        </div>
      </section>

      {pageError && <div className="helper error-helper"><AlertTriangle size={16} /> {pageError}</div>}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Expense ledger</h3>
            <p>Manual expense records for the selected workspace. No fake/demo expenses are generated.</p>
          </div>
          <StatusBadge tone="success">Supabase-backed</StatusBadge>
        </div>

        <DataTable
          rows={visibleExpenses}
          columns={[
            { key: 'description', label: 'Description' },
            { key: 'property', label: 'Property', render: (row) => getPropertyName(row, properties) },
            { key: 'category', label: 'Category', render: (row) => labelFor(expenseCategories, row.category) },
            { key: 'vendor', label: 'Vendor', render: (row) => row.vendor_name || row.vendorName || '—' },
            { key: 'expenseDate', label: 'Date', render: (row) => formatDate(row.expense_date || row.expenseDate, '—') },
            { key: 'amount', label: 'Amount', render: (row) => formatCurrency(Number(row.amount || 0), row.currency || displayCurrency) },
            { key: 'paymentStatus', label: 'Payment', render: (row) => <StatusBadge tone={statusTone(row.payment_status)}>{labelFor(expensePaymentStatuses, row.payment_status)}</StatusBadge> },
            { key: 'expenseStatus', label: 'Status', render: (row) => <StatusBadge tone={statusTone(row.expense_status)}>{labelFor(expenseStatuses, row.expense_status)}</StatusBadge> },
            { key: 'related', label: 'Related', render: (row) => relatedContext(row, data) },
            { key: 'notes', label: 'Notes', render: (row) => row.notes || '—' },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => canManageExpenses ? (
                <button type="button" className="table-action" disabled={busyId === row.id} onClick={() => toggleArchive(row, row.expense_status !== 'archived')} data-skip-create-action="true">
                  {row.expense_status === 'archived' ? 'Restore' : 'Archive'}
                </button>
              ) : 'Read-only',
            },
          ]}
          empty={{
            eyebrow: 'Expenses',
            title: 'No expenses found',
            description: 'Create a real manual expense as a Workspace Owner or Property Manager. Accountant and Host users remain read-only and exports stay disabled.',
          }}
        />
      </section>
    </AppLayout>
  );
}
