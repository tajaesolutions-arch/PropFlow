import React from 'react';
import { Building2, Home, Plus, Search } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';
import {
  currencies,
  propertyEditorRoles,
  propertyStatuses,
  propertyTypes,
  rentalTypes,
} from '../data/constants.js';
import { hasAnyRole } from '../lib/auth.js';

const blankPropertyForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  country: 'United States',
  property_type: 'short_term_rental',
  rental_type: 'short_term',
  currency: 'USD',
  nightly_rate: '',
  monthly_rent: '',
  status: 'active',
  bedrooms: '',
  bathrooms: '',
  square_feet: '',
  notes: '',
};

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatLabel(value) {
  return value ? value.replaceAll('_', ' ') : '—';
}

function getPropertyRate(property) {
  if (property.rental_type === 'long_term') {
    return property.monthly_rent
      ? `${formatCurrency(property.monthly_rent, property.currency)} / mo`
      : '—';
  }

  if (property.rental_type === 'both') {
    const nightly = property.nightly_rate
      ? `${formatCurrency(property.nightly_rate, property.currency)} nightly`
      : null;
    const monthly = property.monthly_rent
      ? `${formatCurrency(property.monthly_rent, property.currency)} monthly`
      : null;

    return [nightly, monthly].filter(Boolean).join(' / ') || '—';
  }

  return property.nightly_rate
    ? `${formatCurrency(property.nightly_rate, property.currency)} / night`
    : '—';
}

function PropertyForm({ defaultCurrency, onSubmit, onCancel }) {
  const [form, setForm] = React.useState({
    ...blankPropertyForm,
    currency: defaultCurrency || 'USD',
  });

  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Enter a property name.');
      return;
    }

    if (!form.address.trim()) {
      setError('Enter the property address or location.');
      return;
    }

    if (form.rental_type !== 'long_term' && !form.nightly_rate) {
      setError('Enter a nightly rate for short-term rental properties.');
      return;
    }

    if (form.rental_type !== 'short_term' && !form.monthly_rent) {
      setError('Enter a monthly rent for long-term rental properties.');
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim(),
        nightly_rate: cleanNumber(form.nightly_rate),
        monthly_rent: cleanNumber(form.monthly_rent),
        bedrooms: cleanNumber(form.bedrooms),
        bathrooms: cleanNumber(form.bathrooms),
        square_feet: cleanNumber(form.square_feet),
        notes: form.notes.trim() || null,
      });
    } catch (submitError) {
      setError(submitError.message || 'Could not save property.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-header">
        <div>
          <h3>Add property</h3>
          <p>
            Add the required details now. Advanced photos, documents, assigned owner, calendars,
            cleaning, and maintenance history can be completed from the property profile later.
          </p>
        </div>
      </div>

      {error && <div className="helper error-helper">{error}</div>}

      <div className="form-grid">
        <label>
          Property name
          <input value={form.name} onChange={set('name')} required />
        </label>

        <label>
          Address/location
          <input value={form.address} onChange={set('address')} required />
        </label>

        <label>
          Country
          <input value={form.country} onChange={set('country')} required />
        </label>

        <label>
          Property type
          <select value={form.property_type} onChange={set('property_type')}>
            {propertyTypes.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Rental type
          <select value={form.rental_type} onChange={set('rental_type')}>
            {rentalTypes.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Currency
          <select value={form.currency} onChange={set('currency')}>
            {currencies.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>

        {form.rental_type !== 'long_term' && (
          <label>
            Nightly rate
            <input
              value={form.nightly_rate}
              onChange={set('nightly_rate')}
              type="number"
              min="0"
              required
            />
          </label>
        )}

        {form.rental_type !== 'short_term' && (
          <label>
            Monthly rent
            <input
              value={form.monthly_rent}
              onChange={set('monthly_rent')}
              type="number"
              min="0"
              required
            />
          </label>
        )}

        <label>
          Status
          <select value={form.status} onChange={set('status')}>
            {propertyStatuses
              .filter((status) => status !== 'archived')
              .map((status) => (
                <option key={status}>{status}</option>
              ))}
          </select>
        </label>

        <label>
          City
          <input value={form.city} onChange={set('city')} />
        </label>

        <label>
          State / parish
          <input value={form.state} onChange={set('state')} />
        </label>

        <label>
          Bedrooms
          <input value={form.bedrooms} onChange={set('bedrooms')} type="number" min="0" />
        </label>

        <label>
          Bathrooms
          <input
            value={form.bathrooms}
            onChange={set('bathrooms')}
            type="number"
            min="0"
            step="0.5"
          />
        </label>

        <label>
          Square footage
          <input value={form.square_feet} onChange={set('square_feet')} type="number" min="0" />
        </label>

        <label className="full">
          Notes
          <textarea value={form.notes} onChange={set('notes')} />
        </label>
      </div>

      <div className="action-row">
        <button className="primary" disabled={saving}>
          {saving ? 'Saving property…' : 'Save property'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PropertiesPage() {
  const { data, createProperty, currentUser, currentWorkspace } = useApp();

  const [showForm, setShowForm] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [status, setStatus] = React.useState('all');
  const [rentalType, setRentalType] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [message, setMessage] = React.useState('');

  const canEdit = hasAnyRole(currentUser, propertyEditorRoles);
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const properties = data.properties || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const archivedProperties = properties.filter((property) => property.status === 'archived');
  const shortTermProperties = activeProperties.filter((property) => property.rental_type === 'short_term');
  const longTermProperties = activeProperties.filter((property) => property.rental_type === 'long_term');

  const rows = properties
    .filter((property) => (showArchived ? true : property.status !== 'archived'))
    .filter((property) => status === 'all' || property.status === status)
    .filter((property) => rentalType === 'all' || property.rental_type === rentalType)
    .filter((property) => {
      const searchValue = [
        property.name,
        property.address,
        property.city,
        property.state,
        property.country,
        property.property_type,
        property.rental_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchValue.includes(query.toLowerCase());
    });

  const submit = async (form) => {
    await createProperty(form);
    setShowForm(false);
    setMessage('Property saved. You can now add bookings, cleaning tasks, maintenance, photos, and documents.');
  };

  return (
    <AppLayout title="Properties" subtitle="Manage workspace properties and property profiles">
      <div className="stat-grid dense">
        <StatCard label="Active properties" value={activeProperties.length} icon={Building2} />
        <StatCard label="Short-term rentals" value={shortTermProperties.length} icon={Home} />
        <StatCard label="Long-term rentals" value={longTermProperties.length} icon={Home} />
        <StatCard label="Archived" value={archivedProperties.length} icon={Building2} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Workspace properties</h3>
            <p>
              Add real properties only. Sample/demo properties should not be added to customer
              workspaces.
            </p>
          </div>

          {canEdit && (
            <button className="primary" type="button" onClick={() => setShowForm(true)}>
              <Plus size={16} />
              Add property
            </button>
          )}
        </div>

        {message && <div className="helper">{message}</div>}

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search properties</span>
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search by property name, address, city, country, or type"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {propertyStatuses.map((propertyStatus) => (
              <option key={propertyStatus} value={propertyStatus}>
                {formatLabel(propertyStatus)}
              </option>
            ))}
          </select>

          <select value={rentalType} onChange={(event) => setRentalType(event.target.value)}>
            <option value="all">All rental types</option>
            {rentalTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>

          <label className="inline-check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
        </div>
      </section>

      {showForm && (
        <PropertyForm
          defaultCurrency={workspaceCurrency}
          onSubmit={submit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {rows.length ? (
        <section className="card">
          <DataTable
            rows={rows}
            columns={[
              {
                key: 'name',
                label: 'Property',
                render: (row) => (
                  <button type="button" className="link" onClick={() => navigate(`/properties/${row.id}`)}>
                    {row.name}
                  </button>
                ),
              },
              {
                key: 'address',
                label: 'Address',
              },
              {
                key: 'city',
                label: 'City',
                render: (row) => row.city || '—',
              },
              {
                key: 'country',
                label: 'Country',
                render: (row) => row.country || '—',
              },
              {
                key: 'property_type',
                label: 'Type',
                render: (row) => formatLabel(row.property_type),
              },
              {
                key: 'rental_type',
                label: 'Rental',
                render: (row) => formatLabel(row.rental_type),
              },
              {
                key: 'bedsBaths',
                label: 'Beds / Baths',
                render: (row) => `${row.bedrooms ?? '—'} / ${row.bathrooms ?? '—'}`,
              },
              {
                key: 'rate',
                label: 'Rate',
                render: (row) => getPropertyRate(row),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge>{row.status || 'active'}</StatusBadge>,
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title="No properties found."
          description={
            query || status !== 'all' || rentalType !== 'all' || showArchived
              ? 'No properties match the current filters. Clear your search or adjust the filters.'
              : 'Add your first property to start managing bookings, cleaning, maintenance, owners, documents, and performance.'
          }
          action={
            canEdit ? (
              <button className="primary" type="button" onClick={() => setShowForm(true)}>
                Add your first property
              </button>
            ) : null
          }
        />
      )}
    </AppLayout>
  );
}
