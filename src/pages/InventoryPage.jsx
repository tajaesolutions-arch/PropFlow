import React from 'react';
import { AlertTriangle, Archive, DollarSign, Edit3, PackagePlus, RotateCcw, Search, X, XCircle } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';

const statusOptions = ['in_stock', 'low_stock', 'out_of_stock', 'archived'];
const defaultForm = {
  item_name: '',
  property_id: '',
  category: '',
  current_quantity: '0',
  low_stock_threshold: '0',
  unit: 'unit',
  supplier_name: '',
  supplier_contact: '',
  estimated_unit_cost: '',
  currency: 'USD',
  notes: '',
};

function displayStatus(status) {
  return String(status || 'in_stock').replaceAll('_', ' ');
}

function statusTone(status) {
  if (status === 'out_of_stock' || status === 'archived') return 'error';
  if (status === 'low_stock') return 'warning';
  if (status === 'in_stock') return 'success';
  return 'info';
}

function statusFor(item) {
  if (item.archivedAt || item.archived_at || item.status === 'archived') return 'archived';
  const quantity = Number(item.current_quantity ?? item.currentQuantity ?? 0);
  const threshold = Number(item.low_stock_threshold ?? item.lowStockThreshold ?? 0);
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
}

function propertyName(properties, propertyId) {
  return properties.find((property) => property.id === propertyId)?.name || 'Workspace supply';
}

function numberValue(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toForm(item, fallbackCurrency) {
  if (!item) return { ...defaultForm, currency: fallbackCurrency || 'USD' };
  return {
    item_name: item.item_name || item.itemName || '',
    property_id: item.property_id || item.propertyId || '',
    category: item.category || '',
    current_quantity: String(item.current_quantity ?? item.currentQuantity ?? 0),
    low_stock_threshold: String(item.low_stock_threshold ?? item.lowStockThreshold ?? 0),
    unit: item.unit || 'unit',
    supplier_name: item.supplier_name || item.supplierName || '',
    supplier_contact: item.supplier_contact || item.supplierContact || '',
    estimated_unit_cost: item.estimated_unit_cost ?? item.estimatedUnitCost ?? '',
    currency: item.currency || fallbackCurrency || 'USD',
    notes: item.notes || '',
  };
}

function validate(form) {
  const errors = [];
  if (!form.item_name.trim()) errors.push('Item name is required.');
  if (numberValue(form.current_quantity) === null || numberValue(form.current_quantity) < 0) errors.push('Current quantity must be 0 or more.');
  if (numberValue(form.low_stock_threshold) === null || numberValue(form.low_stock_threshold) < 0) errors.push('Low-stock threshold must be 0 or more.');
  if (form.estimated_unit_cost !== '' && (numberValue(form.estimated_unit_cost) === null || numberValue(form.estimated_unit_cost) < 0)) errors.push('Estimated unit cost must be 0 or more when provided.');
  if (!form.currency.trim()) errors.push('Currency is required.');
  return errors;
}

function SupplyForm({ initial, properties, workspace, onSubmit, onCancel, submitting, submitError }) {
 const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
const [form, setForm] = React.useState(() => toForm(initial, fallbackCurrency));
  const [errors, setErrors] = React.useState([]);
  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    onSubmit({
      ...form,
      property_id: form.property_id || null,
      current_quantity: numberValue(form.current_quantity) ?? 0,
      low_stock_threshold: numberValue(form.low_stock_threshold) ?? 0,
      estimated_unit_cost: form.estimated_unit_cost === '' ? null : numberValue(form.estimated_unit_cost),
      currency: form.currency.trim(),
      archived_at: initial?.archived_at || initial?.archivedAt || null,
    });
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="supply-modal-title">
      <header className="modal-header">
        <div><h3 id="supply-modal-title">{initial ? 'Edit supply' : 'Add supply'}</h3><p>Track real stock levels, vendors, and low-stock thresholds for the selected workspace.</p></div>
        <button type="button" className="icon-btn" aria-label="Close modal" onClick={onCancel} disabled={submitting}><X size={18} /></button>
      </header>
      <form className="modal-form" onSubmit={submit} noValidate>
        <div className="modal-body">
          {submitError && <div className="modal-error" role="alert">{submitError}</div>}
          {errors.length > 0 && <div className="modal-error" role="alert"><strong>Please fix these fields:</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          <div className="form-grid">
            <label>Item name<input value={form.item_name} onChange={set('item_name')} required /></label>
            <label>Property<select value={form.property_id} onChange={set('property_id')}><option value="">Workspace supply</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
            <label>Category<input value={form.category} onChange={set('category')} placeholder="Linens, toiletries, cleaning…" /></label>
            <label>Current quantity<input value={form.current_quantity} onChange={set('current_quantity')} type="number" min="0" step="0.01" required /></label>
            <label>Low-stock threshold<input value={form.low_stock_threshold} onChange={set('low_stock_threshold')} type="number" min="0" step="0.01" required /></label>
            <label>Unit<input value={form.unit} onChange={set('unit')} placeholder="unit, case, bottle…" /></label>
            <label>Supplier name<input value={form.supplier_name} onChange={set('supplier_name')} /></label>
            <label>Supplier contact<input value={form.supplier_contact} onChange={set('supplier_contact')} placeholder="Email, phone, or URL" /></label>
            <label>Estimated unit cost<input value={form.estimated_unit_cost} onChange={set('estimated_unit_cost')} type="number" min="0" step="0.01" /></label>
            <label>Currency<input value={form.currency} onChange={set('currency')} required /></label>
            <label>
  <span className="sr-only">Search supplies</span>
  <div className="search-box">
    <Search size={16} />
    <input
      value={filters.search}
      onChange={set('search')}
      placeholder="Search item, category, supplier"
    />
  </div>
</label>
          </div>
        </div>
        <footer className="modal-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? 'Saving…' : 'Save supply'}</button>
        </footer>
      </form>
    </section>
  </div>;
}

export function InventoryPage() {
  const { data, currentWorkspace, createSupply, updateSupply, archiveSupply } = useApp();
  const supplies = data.supplies || [];
  const properties = data.properties || [];
  const [filters, setFilters] = React.useState({ search: '', property: 'all', status: 'active', category: 'all' });
  const [editing, setEditing] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');
  const set = (key) => (event) => setFilters((value) => ({ ...value, [key]: event.target.value }));

  const categories = [...new Set(supplies.map((item) => item.category).filter(Boolean))].sort();
  const filtered = supplies.filter((item) => {
    const term = filters.search.toLowerCase().trim();
    const status = statusFor(item);
    const text = `${item.item_name || item.itemName || ''} ${item.category || ''} ${item.supplier_name || item.supplierName || ''}`.toLowerCase();
    return (!term || text.includes(term))
      && (filters.property === 'all' || (item.property_id || item.propertyId || '') === filters.property)
      && (filters.status === 'all' || (filters.status === 'active' ? status !== 'archived' : status === filters.status))
      && (filters.category === 'all' || item.category === filters.category);
  });

  const activeSupplies = supplies.filter((item) => statusFor(item) !== 'archived');
  const lowStock = activeSupplies.filter((item) => ['low_stock', 'out_of_stock'].includes(statusFor(item)));
  const outOfStock = activeSupplies.filter((item) => statusFor(item) === 'out_of_stock');
  const totalValue = activeSupplies.reduce((sum, item) => sum + (Number(item.current_quantity ?? item.currentQuantity ?? 0) * Number(item.estimated_unit_cost ?? item.estimatedUnitCost ?? 0)), 0);
  const currency = currentWorkspace?.defaultCurrency || 'USD';

  const saveSupply = async (payload) => {
    setSubmitting(true);
    setSubmitError('');
    setMessage('');
    try {
      if (editing?.id) await updateSupply(editing.id, payload);
      else await createSupply(payload);
      setMessage(editing?.id ? 'Supply updated.' : 'Supply created.');
      setEditing(null);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (item, archived) => {
    setSubmitting(true);
    setSubmitError('');
    setMessage('');
    try {
      await archiveSupply(item.id, archived);
      setMessage(archived ? 'Supply archived.' : 'Supply restored.');
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Supplies / Inventory">
      <div className="stat-grid dense">
        <StatCard label="Tracked items" value={activeSupplies.length} icon={PackagePlus} />
        <StatCard label="Low-stock alerts" value={lowStock.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Out-of-stock items" value={outOfStock.length} icon={XCircle} tone="error" />
        <StatCard label="Estimated inventory value" value={formatCurrency(totalValue, currency)} icon={DollarSign} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Inventory controls</h3>
            <p>Track property supplies, low-stock levels, vendors, and estimated replacement costs from real Supabase data.</p>
          </div>
          <button className="primary" type="button" onClick={() => { setSubmitError(''); setEditing({}); }}>
            <PackagePlus size={16} /> Add supply
          </button>
        </div>
        {message && <p className="helper">{message}</p>}
        {submitError && <div className="modal-error" role="alert">{submitError}</div>}
        <div className="filter-bar booking-filter">
          <label className="search-input"><Search size={16} /><input value={filters.search} onChange={set('search')} placeholder="Search item, category, supplier" /></label>
          <select value={filters.property} onChange={set('property')}><option value="all">All properties</option><option value="">Workspace supplies</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
          <select value={filters.category} onChange={set('category')}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
          <select value={filters.status} onChange={set('status')}><option value="active">Active supplies</option><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{displayStatus(status)}</option>)}</select>
        </div>
      </section>

      {lowStock.length > 0 && <section className="card detail-panel">
        <div className="card-header"><div><h3>Low-stock panel</h3><p>Supplies at or below threshold, including out-of-stock items.</p></div></div>
        <div className="calendar-agenda">
          {lowStock.map((item) => <div className={statusFor(item) === 'out_of_stock' ? 'calendar-event event-error' : 'calendar-event event-warning'} key={item.id}>
            <span>{displayStatus(statusFor(item))}</span>
            <strong>{item.item_name || item.itemName}</strong>
            <small>{propertyName(properties, item.property_id || item.propertyId)} · {Number(item.current_quantity ?? item.currentQuantity ?? 0)} {item.unit || 'unit'} left</small>
            <button type="button" onClick={() => setEditing(item)}><Edit3 size={14} /> Update</button>
          </div>)}
        </div>
      </section>}

      <section className="card">
        <div className="card-header"><div><h3>Inventory table</h3><p>{filtered.length} shown</p></div></div>
        {supplies.length ? (
          filtered.length ? <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Property</th><th>Category</th><th>Quantity</th><th>Threshold</th><th>Status</th><th>Supplier</th><th>Estimated value</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const quantity = Number(item.current_quantity ?? item.currentQuantity ?? 0);
                  const cost = Number(item.estimated_unit_cost ?? item.estimatedUnitCost ?? 0);
                  const status = statusFor(item);
                  return <tr key={item.id}>
                    <td><strong>{item.item_name || item.itemName}</strong><small>{item.unit || 'unit'}</small></td>
                    <td>{propertyName(properties, item.property_id || item.propertyId)}</td>
                    <td>{item.category || 'Uncategorized'}</td>
                    <td>{quantity}</td>
                    <td>{item.low_stock_threshold ?? item.lowStockThreshold ?? 0}</td>
                    <td><StatusBadge tone={statusTone(status)}>{displayStatus(status)}</StatusBadge></td>
                    <td>{item.supplier_name || item.supplierName || '—'}{(item.supplier_contact || item.supplierContact) && <small>{item.supplier_contact || item.supplierContact}</small>}</td>
                    <td>{formatCurrency(quantity * cost, item.currency || currency)}</td>
                    <td><div className="action-row"><button type="button" onClick={() => setEditing(item)}><Edit3 size={14} /> Edit</button>{status === 'archived' ? <button type="button" onClick={() => toggleArchive(item, false)} disabled={submitting}><RotateCcw size={14} /> Restore</button> : <button type="button" className="danger" onClick={() => toggleArchive(item, true)} disabled={submitting}><Archive size={14} /> Archive</button>}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <EmptyState title="No supplies match these filters." description="Adjust your search, property, category, or status filter to see tracked supplies." />
        ) : (
          <EmptyState title="No supplies tracked yet." description="Add your first supply item to track stock levels, vendors, and low-stock alerts for each property." action={<button className="primary" type="button" onClick={() => setEditing({})}>Add supply</button>} />
        )}
      </section>

      {editing && <SupplyForm initial={editing.id ? editing : null} properties={properties} workspace={currentWorkspace} onSubmit={saveSupply} onCancel={() => !submitting && setEditing(null)} submitting={submitting} submitError={submitError} />}
    </AppLayout>
  );
}
