import React from 'react';
import { Archive, Building2, CalendarDays, Edit3, Eye, FileText, Home, Plus, RotateCcw, Search } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { leasePaymentStatuses, leaseStatuses, leaseTypes, rentFrequencies, roles } from '../data/constants.js';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';

function optionLabel(options, value) {
  return options.find(([key]) => key === value)?.[1] || String(value || '—').replaceAll('_', ' ');
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id || '';
}

function getPropertyName(lease, properties = []) {
  return lease.property || properties.find((property) => property.id === getPropertyId(lease))?.name || 'Unassigned property';
}

function getRentAmount(lease) {
  const value = Number(lease.rentAmount ?? lease.rent_amount ?? lease.monthlyRent ?? lease.monthly_rent ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getLeaseStatus(lease) {
  return lease.leaseStatus || lease.lease_status || 'draft';
}

function getPaymentStatus(lease) {
  return lease.paymentStatus || lease.payment_status || lease.rentPaymentStatus || lease.rent_payment_status || 'not_tracked';
}

function getRentFrequency(lease) {
  return lease.rentFrequency || lease.rent_frequency || 'monthly';
}

function getLeaseType(lease) {
  return lease.leaseType || lease.lease_type || 'fixed_term';
}

function getLeaseStart(lease) {
  return lease.leaseStart || lease.lease_start || '';
}

function getLeaseEnd(lease) {
  return lease.leaseEnd || lease.lease_end || '';
}

function isArchived(lease) {
  return Boolean(lease.archivedAt || lease.archived_at || getLeaseStatus(lease) === 'archived');
}

function statusTone(status) {
  if (['active', 'current', 'paid'].includes(status)) return 'success';
  if (['expiring_soon', 'overdue', 'partially_paid'].includes(status)) return 'warning';
  if (['terminated', 'archived'].includes(status)) return 'error';
  return 'info';
}

function monthlyEquivalent(lease) {
  const amount = getRentAmount(lease);
  const frequency = getRentFrequency(lease);
  if (frequency === 'weekly') return amount * 52 / 12;
  if (frequency === 'biweekly') return amount * 26 / 12;
  if (frequency === 'quarterly') return amount / 3;
  if (frequency === 'yearly') return amount / 12;
  return amount;
}

function isExpiringSoon(lease) {
  const end = getLeaseEnd(lease);
  if (!end || isArchived(lease)) return false;
  const endTime = new Date(`${end}T00:00:00`).getTime();
  const now = Date.now();
  const days = (endTime - now) / 86400000;
  return days >= 0 && days <= 60;
}

function activeWorkspaceRoles(app) {
  const membership = (app.memberships || []).find(
    (item) => item.workspace_id === app.currentWorkspace?.id && item.status === 'active',
  );
  return membership?.roles || app.currentUser?.roles || [];
}

function canManageLeases(app) {
  return [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER].some((role) => activeWorkspaceRoles(app).includes(role));
}

function canViewFinance(app) {
  return [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.ACCOUNTANT].some((role) => activeWorkspaceRoles(app).includes(role));
}

function EditLeaseModal({ lease, app, onClose }) {
  const [form, setForm] = React.useState({
    lease_status: getLeaseStatus(lease),
    payment_status: getPaymentStatus(lease),
    deposit_status: lease.depositStatus || lease.deposit_status || 'not_tracked',
    rent_amount: getRentAmount(lease),
    rent_frequency: getRentFrequency(lease),
    lease_end: getLeaseEnd(lease),
    internal_notes: lease.internalNotes || lease.internal_notes || '',
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (form.lease_end && form.lease_end <= getLeaseStart(lease)) {
      setError('Lease end must be after lease start.');
      return;
    }
    if (Number(form.rent_amount) < 0) {
      setError('Rent amount must be 0 or more.');
      return;
    }
    try {
      setSaving(true);
      await app.updateLease(lease.id, form);
      onClose();
    } catch (updateError) {
      setError(updateError?.message || 'Lease could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="lease-edit-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Manual lease tracking</p>
            <h2 id="lease-edit-title">Edit lease summary</h2>
            <p>Operational status updates only. Rent collection and e-signature are not enabled.</p>
          </div>
        </header>
        {error && <div className="form-error">{error}</div>}
        <form className="modal-form" onSubmit={save}>
          <div className="modal-body form-grid">
            <label>
              Lease status
              <select value={form.lease_status} onChange={set('lease_status')}>
                {leaseStatuses.filter(([value]) => value !== 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Payment status
              <select value={form.payment_status} onChange={set('payment_status')}>
                {leasePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Deposit status
              <select value={form.deposit_status} onChange={set('deposit_status')}>
                {leasePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Rent amount
              <input type="number" min="0" step="0.01" value={form.rent_amount} onChange={set('rent_amount')} />
            </label>
            <label>
              Rent frequency
              <select value={form.rent_frequency} onChange={set('rent_frequency')}>
                {rentFrequencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Lease end
              <input type="date" value={form.lease_end || ''} onChange={set('lease_end')} />
            </label>
            <label className="full">
              Internal notes
              <textarea rows={3} value={form.internal_notes || ''} onChange={set('internal_notes')} />
            </label>
          </div>
          <footer className="modal-actions">
            <button type="button" onClick={onClose} disabled={saving} data-skip-create-action="true">Cancel</button>
            <button className="primary" type="submit" disabled={saving} data-skip-create-action="true">{saving ? 'Saving…' : 'Save lease'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function LeasesPage() {
  const app = useApp();
  const { currentWorkspace, data, getFileSignedUrl, archiveLease } = app;
  const [filters, setFilters] = React.useState({
    query: '',
    property: 'all',
    leaseStatus: 'all',
    paymentStatus: 'all',
    rentFrequency: 'all',
    start: '',
    end: '',
    archive: 'active',
  });
  const [editing, setEditing] = React.useState(null);
  const [message, setMessage] = React.useState('');

  const properties = data.properties || [];
  const leases = data.leases || [];
  const canManage = canManageLeases(app);
  const showFinance = canViewFinance(app);
  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));

  const filteredLeases = leases
    .filter((lease) => {
      if (filters.archive === 'active') return !isArchived(lease);
      if (filters.archive === 'archived') return isArchived(lease);
      return true;
    })
    .filter((lease) => filters.property === 'all' || getPropertyId(lease) === filters.property)
    .filter((lease) => filters.leaseStatus === 'all' || getLeaseStatus(lease) === filters.leaseStatus)
    .filter((lease) => filters.paymentStatus === 'all' || getPaymentStatus(lease) === filters.paymentStatus)
    .filter((lease) => filters.rentFrequency === 'all' || getRentFrequency(lease) === filters.rentFrequency)
    .filter((lease) => !filters.start || getLeaseEnd(lease) >= filters.start || getLeaseStart(lease) >= filters.start)
    .filter((lease) => !filters.end || getLeaseStart(lease) <= filters.end)
    .filter((lease) => {
      const query = filters.query.trim().toLowerCase();
      if (!query) return true;
      return [
        lease.tenantName,
        lease.tenant_name,
        lease.tenantEmail,
        lease.tenant_email,
        lease.tenantPhone,
        lease.tenant_phone,
        getPropertyName(lease, properties),
        getLeaseStatus(lease),
        getPaymentStatus(lease),
        lease.internalNotes,
        lease.internal_notes,
        lease.moveInNotes,
        lease.move_in_notes,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });

  const activeLeases = leases.filter((lease) => !isArchived(lease) && ['active', 'month_to_month'].includes(getLeaseStatus(lease)));
  const expiringSoon = leases.filter(isExpiringSoon);
  const monthlyRentTotal = activeLeases.reduce((sum, lease) => sum + monthlyEquivalent(lease), 0);
  const overdueCount = leases.filter((lease) => !isArchived(lease) && getPaymentStatus(lease) === 'overdue').length;

  const viewDocument = async (lease) => {
    setMessage('');
    try {
      const fileId = lease.leaseDocumentFileId || lease.lease_document_file_id;
      if (!fileId) throw new Error('No private lease document is linked yet.');
      const url = await getFileSignedUrl(fileId, 300);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error?.message || 'Lease document could not be opened.');
    }
  };

  const toggleArchive = async (lease) => {
    setMessage('');
    try {
      await archiveLease(lease.id, !isArchived(lease));
      setMessage(isArchived(lease) ? 'Lease restored.' : 'Lease archived.');
    } catch (error) {
      setMessage(error?.message || 'Lease archive status could not be updated.');
    }
  };

  return (
    <AppLayout title="Leases" subtitle="Manual long-term rental tracking with real workspace-scoped Supabase lease records.">
      {message && <section className="helper" role="status">{message}</section>}

      <section className="card finance-safety-notice">
        <div className="card-header">
          <div>
            <p className="eyebrow">Long-term rentals</p>
            <h3>Manual lease tracking only</h3>
            <p>Use this page to track lease status, rent summary fields, and private document links. PropFlow does not collect rent, add late fees automatically, generate legal documents, or request e-signatures.</p>
          </div>
          {canManage && <button type="button" className="primary" data-create-action="lease"><Plus size={16} /> Add Lease</button>}
        </div>
      </section>

      <section className="stat-grid">
        <StatCard label="Active leases" value={activeLeases.length} icon={Home} />
        <StatCard label="Expiring soon" value={expiringSoon.length} icon={CalendarDays} />
        <StatCard label="Monthly rent summary" value={showFinance ? formatCurrency(monthlyRentTotal, currency) : 'Restricted'} icon={Building2} />
        <StatCard label="Overdue/manual status" value={showFinance ? overdueCount : 'Restricted'} icon={FileText} />
      </section>

      <section className="card toolbar-card">
        <div className="filter-grid">
          <label className="search-field">
            Search
            <span><Search size={16} /><input value={filters.query} onChange={setFilter('query')} placeholder="Tenant, property, status, notes" /></span>
          </label>
          <label>Property<select value={filters.property} onChange={setFilter('property')}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Lease status<select value={filters.leaseStatus} onChange={setFilter('leaseStatus')}><option value="all">All statuses</option>{leaseStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Payment status<select value={filters.paymentStatus} onChange={setFilter('paymentStatus')}><option value="all">All payments</option>{leasePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Rent frequency<select value={filters.rentFrequency} onChange={setFilter('rentFrequency')}><option value="all">All frequencies</option>{rentFrequencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Start<input type="date" value={filters.start} onChange={setFilter('start')} /></label>
          <label>End<input type="date" value={filters.end} onChange={setFilter('end')} /></label>
          <label>Archive<select value={filters.archive} onChange={setFilter('archive')}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">All leases</option></select></label>
        </div>
      </section>

      {!properties.length ? (
        <EmptyState eyebrow="Leases" icon={Building2} title="Add a property before creating leases" description="Long-term leases must be tied to a real workspace property. No fake lease records are added." action={canManage ? <button type="button" className="primary" data-create-action="property"><Plus size={16} /> Add Property</button> : null} />
      ) : !leases.length ? (
        <EmptyState eyebrow="Leases" icon={FileText} title="No leases yet" description="Create your first manual long-term lease record. Tenant contacts can be linked safely through the CRM." action={canManage ? <button type="button" className="primary" data-create-action="lease"><Plus size={16} /> Add Lease</button> : null} />
      ) : (
        <section className="card">
          <div className="card-header"><div><h3>Lease records</h3><p>{filteredLeases.length} lease record{filteredLeases.length === 1 ? '' : 's'} match the filters.</p></div></div>
          <DataTable rows={filteredLeases} empty="No leases match these filters." columns={[
            { key: 'tenant', label: 'Tenant', render: (lease) => <span><strong>{lease.tenantName || lease.tenant_name}</strong><small>{showFinance ? (lease.tenantEmail || lease.tenant_email || lease.tenantPhone || lease.tenant_phone || 'No contact') : 'Contact restricted'}</small></span> },
            { key: 'property', label: 'Property', render: (lease) => getPropertyName(lease, properties) },
            { key: 'type', label: 'Lease type', render: (lease) => optionLabel(leaseTypes, getLeaseType(lease)) },
            { key: 'dates', label: 'Start / end', render: (lease) => `${formatDate(getLeaseStart(lease))} → ${formatDate(getLeaseEnd(lease), 'Open-ended')}` },
            { key: 'rent', label: 'Rent', render: (lease) => showFinance ? `${formatCurrency(getRentAmount(lease), lease.currency || currency)} / ${optionLabel(rentFrequencies, getRentFrequency(lease)).toLowerCase()}` : 'Restricted' },
            { key: 'payment', label: 'Payment status', render: (lease) => showFinance ? <StatusBadge tone={statusTone(getPaymentStatus(lease))}>{optionLabel(leasePaymentStatuses, getPaymentStatus(lease))}</StatusBadge> : 'Restricted' },
            { key: 'status', label: 'Lease status', render: (lease) => <StatusBadge tone={statusTone(getLeaseStatus(lease))}>{optionLabel(leaseStatuses, getLeaseStatus(lease))}</StatusBadge> },
            { key: 'document', label: 'Document', render: (lease) => lease.leaseDocumentFileId || lease.lease_document_file_id ? <StatusBadge tone="success">Private file linked</StatusBadge> : <StatusBadge tone="warning">Upload in Files</StatusBadge> },
            { key: 'actions', label: 'Actions', render: (lease) => <div className="action-row">
              {canManage && <button type="button" onClick={() => setEditing(lease)} data-skip-create-action="true"><Edit3 size={15} /> Edit</button>}
              {canManage && <button type="button" onClick={() => toggleArchive(lease)} data-skip-create-action="true">{isArchived(lease) ? <RotateCcw size={15} /> : <Archive size={15} />}{isArchived(lease) ? 'Restore' : 'Archive'}</button>}
              <button type="button" onClick={() => navigate(`/properties/${getPropertyId(lease)}`)} data-skip-create-action="true"><Building2 size={15} /> Property</button>
              <button type="button" onClick={() => viewDocument(lease)} data-skip-create-action="true"><Eye size={15} /> Document</button>
            </div> },
          ]} />
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Lease document placeholder</h3>
            <p>Lease document upload uses the private Files module and can be linked after upload. No public lease documents, e-signature, or generated contracts are enabled.</p>
          </div>
          <button type="button" onClick={() => navigate('/files')} data-skip-create-action="true"><FileText size={16} /> Open Files</button>
        </div>
      </section>

      {editing && <EditLeaseModal lease={editing} app={app} onClose={() => setEditing(null)} />}
    </AppLayout>
  );
}
