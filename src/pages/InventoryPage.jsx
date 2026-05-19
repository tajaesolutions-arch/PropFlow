import React from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  DollarSign,
  Edit3,
  EyeOff,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Truck,
  X,
  XCircle,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { hasAnyRole } from '../lib/auth.js';
import { currencies, roles } from '../data/constants.js';
import { formatCurrency } from '../lib/formatters.js';
import { validateSupplyForm } from '../lib/formValidation.js';

const inventoryManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const inventoryCostRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];
const supplierDetailRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];

const statusOptions = ['in_stock', 'low_stock', 'out_of_stock', 'archived'];
const inventoryCurrencies = currencies.filter((currency) => ['USD', 'JMD', 'CAD', 'GBP', 'EUR'].includes(currency));

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
  if (item.archivedAt || item.archived_at) return 'archived';

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

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function getItemName(item) {
  return item.item_name || item.itemName || 'Supply item';
}

function getItemPropertyId(item) {
  return item.property_id || item.propertyId || '';
}

function getItemQuantity(item) {
  return Number(item.current_quantity ?? item.currentQuantity ?? 0);
}

function getItemThreshold(item) {
  return Number(item.low_stock_threshold ?? item.lowStockThreshold ?? 0);
}

function getItemUnitCost(item) {
  return Number(item.estimated_unit_cost ?? item.estimatedUnitCost ?? 0);
}

function getItemUnit(item) {
  return item.unit || 'unit';
}

function getSupplierName(item) {
  return item.supplier_name || item.supplierName || '';
}

function getSupplierContact(item) {
  return item.supplier_contact || item.supplierContact || '';
}

function toForm(item, fallbackCurrency) {
  if (!item?.id) return { ...defaultForm, currency: fallbackCurrency || 'USD' };

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


function matchesSearch(item, properties, query, canSeeSupplierDetails) {
  const term = String(query || '').toLowerCase().trim();

  if (!term) return true;

  const text = [
    getItemName(item),
    item.category,
    propertyName(properties, getItemPropertyId(item)),
    canSeeSupplierDetails ? getSupplierName(item) : '',
    canSeeSupplierDetails ? getSupplierContact(item) : '',
    item.notes,
    statusFor(item),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(term);
}

function SupplyForm({ initial, properties, workspace, onSubmit, onCancel, submitting, submitError }) {
  const fallbackCurrency = getWorkspaceCurrency(workspace);
  const isEditing = Boolean(initial?.id);
  const [form, setForm] = React.useState(() => toForm(initial, fallbackCurrency));
  const [errors, setErrors] = React.useState([]);

  React.useEffect(() => {
    setForm(toForm(initial, fallbackCurrency));
    setErrors([]);
  }, [initial?.id, fallbackCurrency]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, submitting]);

  const set = (key) => (event) => {
    setForm((value) => ({ ...value, [key]: event.target.value }));
  };

  const submit = (event) => {
    event.preventDefault();

    const nextErrors = validateSupplyForm(form, properties).errors;
    setErrors(nextErrors);

    if (nextErrors.length) return;

    onSubmit({
      ...form,
      item_name: form.item_name.trim(),
      property_id: form.property_id || null,
      category: form.category.trim() || null,
      current_quantity: numberValue(form.current_quantity) ?? 0,
      low_stock_threshold: numberValue(form.low_stock_threshold) ?? 0,
      unit: form.unit.trim() || 'unit',
      supplier_name: form.supplier_name.trim() || null,
      supplier_contact: form.supplier_contact.trim() || null,
      estimated_unit_cost: form.estimated_unit_cost === '' ? null : numberValue(form.estimated_unit_cost),
      currency: form.currency.trim().toUpperCase(),
      notes: form.notes.trim() || null,
      archived_at: initial?.archived_at || initial?.archivedAt || null,
    });
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="supply-modal-title">
        <header className="modal-header">
          <div>
            <h3 id="supply-modal-title">{isEditing ? 'Edit supply' : 'Add supply'}</h3>
            <p>Track real stock levels, vendors, low-stock thresholds, and property-specific inventory.</p>
          </div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close modal"
            onClick={onCancel}
            disabled={submitting}
            data-skip-create-action="true"
          >
            <X size={18} />
          </button>
        </header>

        <form className="modal-form" onSubmit={submit} noValidate>
          <div className="modal-body">
            {submitError && (
              <div className="modal-error" role="alert">
                {submitError}
              </div>
            )}

            {errors.length > 0 && (
              <div className="modal-error" role="alert">
                <strong>Please fix these fields:</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-grid">
              <label>
                Item name
                <input value={form.item_name} onChange={set('item_name')} required />
              </label>

              <label>
                Property
                <select value={form.property_id} onChange={set('property_id')}>
                  <option value="">Workspace supply</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Category
                <input
                  value={form.category}
                  onChange={set('category')}
                  placeholder="Linens, toiletries, cleaning..."
                />
              </label>

              <label>
                Current quantity
                <input
                  value={form.current_quantity}
                  onChange={set('current_quantity')}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Low-stock threshold
                <input
                  value={form.low_stock_threshold}
                  onChange={set('low_stock_threshold')}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </label>

              <label>
                Unit
                <input value={form.unit} onChange={set('unit')} placeholder="unit, case, bottle..." />
              </label>

              <label>
                Supplier name
                <input value={form.supplier_name} onChange={set('supplier_name')} />
              </label>

              <label>
                Supplier contact
                <input
                  value={form.supplier_contact}
                  onChange={set('supplier_contact')}
                  placeholder="Email, phone, or URL"
                />
              </label>

              <label>
                Estimated unit cost
                <input
                  value={form.estimated_unit_cost}
                  onChange={set('estimated_unit_cost')}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>

              <label>
                Currency
                <select value={form.currency} onChange={set('currency')} required>
                  {inventoryCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full">
                Notes
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  placeholder="Optional notes about reorder rules, storage location, or supplier instructions."
                  rows={3}
                />
              </label>
            </div>
          </div>

          <footer className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              data-skip-create-action="true"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary"
              disabled={submitting}
              data-skip-create-action="true"
            >
              {submitting ? 'Saving…' : 'Save supply'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function SupplyCard({ item, properties, canManage, canSeeCosts, canSeeSupplierDetails, submitting, onEdit, onArchiveToggle }) {
  const status = statusFor(item);
  const propertyId = getItemPropertyId(item);
  const quantity = getItemQuantity(item);
  const threshold = getItemThreshold(item);
  const unitCost = getItemUnitCost(item);
  const currency = item.currency || 'USD';
  const totalValue = quantity * unitCost;

  return (
    <article className={`card supply-card ${status === 'low_stock' || status === 'out_of_stock' ? 'urgent' : ''}`}>
      <div className="supply-card-top">
        <div className="supply-icon">
          <PackagePlus size={22} />
        </div>

        <StatusBadge tone={statusTone(status)}>{displayStatus(status)}</StatusBadge>
      </div>

      <div>
        <h3>{getItemName(item)}</h3>
        <p>{propertyName(properties, propertyId)}</p>
      </div>

      <div className="supply-card-meta">
        <span>
          <strong>
            {quantity} {getItemUnit(item)}
          </strong>
          <small>Current stock</small>
        </span>

        <span>
          <strong>{threshold}</strong>
          <small>Low-stock threshold</small>
        </span>

        {canSeeCosts ? (
          <>
            <span>
              <strong>{formatCurrency(unitCost, currency)}</strong>
              <small>Unit cost</small>
            </span>

            <span>
              <strong>{formatCurrency(totalValue, currency)}</strong>
              <small>Total value</small>
            </span>
          </>
        ) : (
          <span>
            <strong>Hidden</strong>
            <small>Cost visibility</small>
          </span>
        )}
      </div>

      {(item.category || (canSeeSupplierDetails && (getSupplierName(item) || getSupplierContact(item)))) && (
        <div className="supply-card-details">
          {item.category && (
            <span>
              <strong>Category</strong>
              <small>{item.category}</small>
            </span>
          )}

          {canSeeSupplierDetails && getSupplierName(item) && (
            <span>
              <strong>Supplier</strong>
              <small>{getSupplierName(item)}</small>
            </span>
          )}

          {canSeeSupplierDetails && getSupplierContact(item) && (
            <span>
              <strong>Contact</strong>
              <small>{getSupplierContact(item)}</small>
            </span>
          )}
        </div>
      )}

      {item.notes && (
        <div className="supply-notes">
          <strong>Notes</strong>
          <p>{item.notes}</p>
        </div>
      )}

      {canManage && (
        <div className="supply-card-actions">
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={submitting}
            data-skip-create-action="true"
          >
            <Edit3 size={16} />
            Edit
          </button>

          <button
            type="button"
            onClick={() => onArchiveToggle(item, status !== 'archived')}
            disabled={submitting}
            data-skip-create-action="true"
          >
            {status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
            {status === 'archived' ? 'Restore' : 'Archive'}
          </button>
        </div>
      )}
    </article>
  );
}

export function InventoryPage() {
  const {
    data,
    currentWorkspace,
    currentUser,
    createSupply,
    updateSupply,
    archiveSupply,
  } = useApp();

  const supplies = data.supplies || [];
  const properties = data.properties || [];

  const [filters, setFilters] = React.useState({
    search: '',
    property: 'all',
    status: 'active',
    category: 'all',
  });
  const [editing, setEditing] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');

  const hasActiveWorkspace = Boolean(currentWorkspace?.id);
  const canManageInventory = hasActiveWorkspace && hasAnyRole(currentUser, inventoryManagerRoles);
  const canSeeInventoryCosts = hasAnyRole(currentUser, inventoryCostRoles);
  const canSeeSupplierDetails = hasAnyRole(currentUser, supplierDetailRoles);
  const accountantView = Boolean(currentUser?.roles?.includes(roles.ACCOUNTANT));

  const set = (key) => (event) => {
    setFilters((value) => ({ ...value, [key]: event.target.value }));
  };

  const categories = [...new Set(supplies.map((item) => item.category).filter(Boolean))].sort();

  const filtered = supplies.filter((item) => {
    const status = statusFor(item);

    return (
      matchesSearch(item, properties, filters.search, canSeeSupplierDetails) &&
      (filters.property === 'all' || getItemPropertyId(item) === filters.property) &&
      (filters.status === 'all' || (filters.status === 'active' ? status !== 'archived' : status === filters.status)) &&
      (filters.category === 'all' || item.category === filters.category)
    );
  });

  const activeSupplies = supplies.filter((item) => statusFor(item) !== 'archived');
  const lowStock = activeSupplies.filter((item) => ['low_stock', 'out_of_stock'].includes(statusFor(item)));
  const outOfStock = activeSupplies.filter((item) => statusFor(item) === 'out_of_stock');
  const archivedSupplies = supplies.filter((item) => statusFor(item) === 'archived');

  const totalValue = activeSupplies.reduce((sum, item) => {
    const quantity = getItemQuantity(item);
    const cost = getItemUnitCost(item);
    return sum + quantity * cost;
  }, 0);

  const currency = getWorkspaceCurrency(currentWorkspace);

  const openNewSupply = () => {
    if (!hasActiveWorkspace) {
      setSubmitError('Select or create an active workspace before adding supplies.');
      return;
    }

    if (!canManageInventory) return;

    setMessage('');
    setSubmitError('');
    setEditing({ mode: 'create' });
  };

  const closeForm = () => {
    if (submitting) return;

    setEditing(null);
    setSubmitError('');
  };

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const saveSupply = async (payload) => {
    if (!canManageInventory) {
      setSubmitError('You do not have permission to change inventory records.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setMessage('');

    try {
      if (editing?.id) {
        await updateSupply(editing.id, payload);
        setMessage('Supply updated.');
      } else {
        await createSupply(payload);
        setMessage('Supply created.');
      }

      setEditing(null);
      clearMessageSoon();
    } catch (error) {
      setSubmitError(error.message || 'Supply could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (item, archived) => {
    if (!canManageInventory) return;

    setSubmitting(true);
    setSubmitError('');
    setMessage('');

    try {
      await archiveSupply(item.id, archived);
      setMessage(archived ? 'Supply archived.' : 'Supply restored.');
      clearMessageSoon();
    } catch (error) {
      setSubmitError(error.message || 'Supply archive status could not be changed.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      property: 'all',
      status: 'active',
      category: 'all',
    });
  };

  return (
    <AppLayout
      title="Supplies / Inventory"
      subtitle="Track workspace supplies, property stock levels, low-stock alerts, vendors, and inventory visibility."
    >
      {message && (
        <section className="helper" role="status">
          {message}
        </section>
      )}

      {submitError && (
        <section className="helper error-helper" role="alert">
          {submitError}
        </section>
      )}

      {!hasActiveWorkspace && (
        <section className="workspace-load-warning" role="alert">
          <strong>No active workspace selected</strong>
          <span>Select or create a workspace before adding or editing supplies.</span>
        </section>
      )}

      {accountantView && (
        <section className="card inventory-visibility-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Accountant visibility</p>
              <h3>Inventory is view-only for accountant users</h3>
              <p>
                Accountant users can review stock counts, supplier details, estimated unit cost, and total inventory value, but they cannot add, edit, archive, or restore inventory records.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      {!canSeeInventoryCosts && (
        <section className="card inventory-visibility-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Inventory visibility</p>
              <h3>Cost and supplier fields are hidden for this role</h3>
              <p>
                This view shows stock levels, categories, and low-stock alerts. Estimated unit cost, total inventory value, supplier contacts, and finance-adjacent inventory summaries are limited to workspace managers and accountants.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        <StatCard label="Tracked items" value={activeSupplies.length} icon={PackagePlus} />
        <StatCard label="Low-stock alerts" value={lowStock.length} icon={AlertTriangle} tone="warning" />
        <StatCard label="Out-of-stock items" value={outOfStock.length} icon={XCircle} tone="error" />
        {canSeeInventoryCosts ? (
          <StatCard
            label="Estimated inventory value"
            value={formatCurrency(totalValue, currency)}
            subtitle={`${archivedSupplies.length} archived`}
            icon={DollarSign}
          />
        ) : (
          <StatCard
            label="Cost visibility"
            value="Hidden"
            subtitle="Stock counts only for this role"
            icon={EyeOff}
          />
        )}
      </section>

      <section className="card inventory-toolbar">
        <div>
          <h3>Inventory management</h3>
          <p>{accountantView
            ? 'Review supplies, low-stock alerts, supplier details, and inventory value without changing operational records.'
            : 'Monitor supplies for cleaning, guest readiness, maintenance, and property operations.'}</p>
        </div>

        <div className="inventory-toolbar-actions">
          {hasAnyRole(currentUser, inventoryManagerRoles) && (
            <button
              type="button"
              className="primary"
              onClick={openNewSupply}
              disabled={!hasActiveWorkspace}
              title={!hasActiveWorkspace ? 'Select or create a workspace before adding supplies.' : undefined}
              data-skip-create-action="true"
            >
              <Plus size={16} />
              Add Supply
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, status: 'low_stock' }))}
            data-skip-create-action="true"
          >
            View Low Stock
          </button>
        </div>
      </section>

      <section className="card">
        <div className="inventory-filters">
          <label className="inventory-search">
            <Search size={16} />
            <input
              value={filters.search}
              onChange={set('search')}
              placeholder={canSeeSupplierDetails
                ? 'Search item, category, property, supplier, contact, or status...'
                : 'Search item, category, property, notes, or status...'}
              aria-label="Search inventory"
            />

            {filters.search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, search: '' }))}
                aria-label="Clear inventory search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Property
            <select value={filters.property} onChange={set('property')}>
              <option value="all">All properties</option>
              <option value="">Workspace supply</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={set('status')}>
              <option value="active">Active supplies</option>
              <option value="all">All supplies</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {displayStatus(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select value={filters.category} onChange={set('category')}>
              <option value="all">All categories</option>
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

      {!supplies.length ? (
        <EmptyState
          eyebrow="Inventory"
          icon={PackagePlus}
          title="No inventory items yet"
          description={accountantView
            ? 'Inventory records will appear here after authorized workspace users add supplies. Accountant users can review inventory but cannot create supply records.'
            : 'Add supplies such as linens, toiletries, cleaning products, maintenance parts, or guest-ready essentials.'}
          action={
            hasAnyRole(currentUser, inventoryManagerRoles) ? (
              <button
                type="button"
                className="primary"
                onClick={openNewSupply}
                disabled={!hasActiveWorkspace}
                title={!hasActiveWorkspace ? 'Select or create a workspace before adding supplies.' : undefined}
                data-skip-create-action="true"
              >
                <Plus size={16} />
                Add Supply
              </button>
            ) : null
          }
        />
      ) : filtered.length ? (
        <section className="inventory-card-grid">
          {filtered.map((item) => (
            <SupplyCard
              key={item.id}
              item={item}
              properties={properties}
              canManage={canManageInventory}
              canSeeCosts={canSeeInventoryCosts}
              canSeeSupplierDetails={canSeeSupplierDetails}
              submitting={submitting}
              onEdit={(supply) => {
                setMessage('');
                setSubmitError('');
                setEditing(supply);
              }}
              onArchiveToggle={toggleArchive}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          eyebrow="Inventory filters"
          icon={PackagePlus}
          title="No supplies match your filters"
          description="Adjust the search, property, status, or category filters."
          action={
            <button type="button" onClick={clearFilters} data-skip-create-action="true">
              Clear filters
            </button>
          }
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Low-stock alerts</h3>
              <p>Items at or below their configured threshold.</p>
            </div>
            <AlertTriangle size={20} className="muted" />
          </div>

          {lowStock.length ? (
            lowStock.slice(0, 8).map((item) => (
              <div className="list-row" key={`low-${item.id}`}>
                <span>
                  <strong>{getItemName(item)}</strong>
                  <small>
                    {propertyName(properties, getItemPropertyId(item))} · {getItemQuantity(item)} {getItemUnit(item)} left
                  </small>
                </span>
                <StatusBadge tone={statusTone(statusFor(item))}>{displayStatus(statusFor(item))}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              compact
              icon={PackagePlus}
              title="No low-stock alerts"
              description="Supplies below threshold will appear here."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>{canSeeSupplierDetails ? 'Supplier snapshot' : 'Supplier details hidden'}</h3>
              <p>{canSeeSupplierDetails
                ? 'Vendor details attached to inventory records.'
                : 'Supplier names and contacts are limited to workspace managers and accountants.'}</p>
            </div>
            <Truck size={20} className="muted" />
          </div>

          {canSeeSupplierDetails ? (
            activeSupplies.filter((item) => getSupplierName(item) || getSupplierContact(item)).length ? (
              activeSupplies
                .filter((item) => getSupplierName(item) || getSupplierContact(item))
                .slice(0, 8)
                .map((item) => (
                  <div className="list-row" key={`supplier-${item.id}`}>
                    <span>
                      <strong>{getSupplierName(item) || 'Supplier not named'}</strong>
                      <small>{getSupplierContact(item) || getItemName(item)}</small>
                    </span>
                    <StatusBadge tone={statusTone(statusFor(item))}>{getItemName(item)}</StatusBadge>
                  </div>
                ))
            ) : (
              <EmptyState
                compact
                icon={Building2}
                title="No supplier details yet"
                description="Supplier names and contact details will appear here when added to supplies."
              />
            )
          ) : (
            <EmptyState
              compact
              icon={ShieldCheck}
              title="Supplier details are hidden"
              description="This role can view stock levels and low-stock alerts, but supplier contact details are managed by authorized workspace users."
            />
          )}
        </section>
      </section>

      {editing && (
        <SupplyForm
          initial={editing?.mode === 'create' ? null : editing}
          properties={properties}
          workspace={currentWorkspace}
          onSubmit={saveSupply}
          onCancel={closeForm}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </AppLayout>
  );
}
