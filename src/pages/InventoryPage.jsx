import React from 'react';
import { AlertTriangle, Archive, PackagePlus, Search } from 'lucide-react';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';

function statusFor(item) {
  if (item.status) return item.status;
  const quantity = Number(item.current_quantity ?? item.currentQuantity ?? 0);
  const threshold = Number(item.low_stock_threshold ?? item.lowStockThreshold ?? 0);
  if (quantity <= 0) return 'out_of_stock';
  if (threshold > 0 && quantity <= threshold) return 'low_stock';
  return 'in_stock';
}

function propertyName(properties, propertyId) {
  return properties.find((property) => property.id === propertyId)?.name || 'Workspace supply';
}

export function InventoryPage() {
  const { data, currentWorkspace } = useApp();
  const supplies = data.supplies || [];
  const [filters, setFilters] = React.useState({ search: '', property: 'all', status: 'all', category: 'all' });
  const set = (key) => (event) => setFilters((value) => ({ ...value, [key]: event.target.value }));

  const categories = [...new Set(supplies.map((item) => item.category).filter(Boolean))];
  const filtered = supplies.filter((item) => {
    const term = filters.search.toLowerCase().trim();
    const status = statusFor(item);
    const text = `${item.item_name || item.itemName || ''} ${item.category || ''} ${item.supplier_name || item.supplierName || ''}`.toLowerCase();
    return (!term || text.includes(term))
      && (filters.property === 'all' || item.property_id === filters.property || item.propertyId === filters.property)
      && (filters.status === 'all' || status === filters.status)
      && (filters.category === 'all' || item.category === filters.category);
  });

  const lowStock = supplies.filter((item) => ['low_stock', 'out_of_stock'].includes(statusFor(item)));
  const totalValue = supplies.reduce((sum, item) => sum + (Number(item.current_quantity ?? item.currentQuantity ?? 0) * Number(item.estimated_unit_cost ?? item.estimatedUnitCost ?? 0)), 0);
  const currency = currentWorkspace?.defaultCurrency || 'USD';

  return (
    <AppLayout title="Supplies / Inventory">
      <div className="stats-grid compact">
        <StatCard label="Tracked items" value={supplies.length} icon={PackagePlus} />
        <StatCard label="Low stock alerts" value={lowStock.length} icon={AlertTriangle} />
        <StatCard label="Estimated value" value={formatCurrency(totalValue, currency)} icon={Archive} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Inventory controls</h3>
            <p>Track property supplies, low-stock thresholds, vendors, and estimated replacement costs. This page uses real Supabase inventory rows only.</p>
          </div>
          <button className="primary" type="button" disabled title="Create/edit actions are enabled after the inventory migration is applied and CRUD handlers are connected.">
            <PackagePlus size={16} /> Add item
          </button>
        </div>
        <div className="filter-bar booking-filter">
          <label className="search-input"><Search size={16} /><input value={filters.search} onChange={set('search')} placeholder="Search supplies" /></label>
          <select value={filters.property} onChange={set('property')}><option value="all">All properties</option>{data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
          <select value={filters.status} onChange={set('status')}><option value="all">All statuses</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="archived">Archived</option></select>
          <select value={filters.category} onChange={set('category')}><option value="all">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><h3>Supply list</h3><span>{filtered.length} shown</span></div>
        {filtered.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Property</th><th>Qty</th><th>Threshold</th><th>Status</th><th>Supplier</th><th>Est. value</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const quantity = Number(item.current_quantity ?? item.currentQuantity ?? 0);
                  const cost = Number(item.estimated_unit_cost ?? item.estimatedUnitCost ?? 0);
                  return <tr key={item.id}>
                    <td><strong>{item.item_name || item.itemName}</strong><small>{item.category || 'Uncategorized'} · {item.unit || 'unit'}</small></td>
                    <td>{propertyName(data.properties, item.property_id || item.propertyId)}</td>
                    <td>{quantity}</td>
                    <td>{item.low_stock_threshold ?? item.lowStockThreshold ?? '—'}</td>
                    <td><StatusBadge>{statusFor(item)}</StatusBadge></td>
                    <td>{item.supplier_name || item.supplierName || '—'}</td>
                    <td>{formatCurrency(quantity * cost, item.currency || currency)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No supplies found." description="Apply the inventory migration, then add real workspace supply records. PropFlow does not show fake inventory data." />
        )}
      </section>
    </AppLayout>
  );
}
