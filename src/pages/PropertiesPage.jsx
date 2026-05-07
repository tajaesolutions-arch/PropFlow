import React from 'react';
import { Building2, Edit3, Eye, Home, Plus, Search, X } from 'lucide-react';

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

function normalizePropertyForm(property, defaultCurrency) {
  if (!property?.id) {
    return {
      ...blankPropertyForm,
      country: property?.country || blankPropertyForm.country,
      currency: defaultCurrency || blankPropertyForm.currency,
    };
  }

  return {
    name: property.name || '',
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    country: property.country || 'United States',
    property_type: property.property_type || property.propertyType || 'short_term_rental',
    rental_type: property.rental_type || property.rentalType || 'short_term',
    currency: property.currency || defaultCurrency || 'USD',
    nightly_rate: property.nightly_rate ?? property.nightlyRate ?? '',
    monthly_rent: property.monthly_rent ?? property.monthlyRent ?? '',
    status: property.status || 'active',
    bedrooms: property.bedrooms ?? '',
    bathrooms: property.bathrooms ?? '',
    square_feet: property.square_feet ?? property.squareFeet ?? '',
    notes: property.notes || '',
  };
}

function getPropertyRate(property) {
  const rentalType = property.rental_type || property.rentalType;
  const currency = property.currency || 'USD';
  const nightlyRate = property.nightly_rate ?? property.nightlyRate;
  const monthlyRent = property.monthly_rent ?? property.monthlyRent;

  if (rentalType === 'long_term') {
    return monthlyRent ? `${formatCurrency(monthlyRent, currency)} / mo` : '—';
  }

  if (rentalType === 'both') {
    const nightly = nightlyRate ? `${formatCurrency(nightlyRate, currency)} nightly` : null;
    const monthly = monthlyRent ? `${formatCurrency(monthlyRent, currency)} monthly` : null;

    return [nightly, monthly].filter(Boolean).join(' / ') || '—';
  }

  return nightlyRate ? `${formatCurrency(nightlyRate, currency)} / night` : '—';
}

function validateProperty(form) {
  const errors = [];

  if (!form.name.trim()) errors.push('Property name is required.');
  if (!form.address.trim()) errors.push('Address or location is required.');
  if (!form.property_type) errors.push('Property type is required.');
  if (!form.rental_type) errors.push('Rental type is required.');
  if (!form.status) errors.push('Status is required.');
  if (!form.currency) errors.push('Currency is required.');

  const nightlyRate = cleanNumber(form.nightly_rate);
  const monthlyRent = cleanNumber(form.monthly_rent);
  const bedrooms = cleanNumber(form.bedrooms);
  const bathrooms = cleanNumber(form.bathrooms);
  const squareFeet = cleanNumber(form.square_feet);

  if (form.nightly_rate !== '' && (nightlyRate === null || nightlyRate < 0)) {
    errors.push('Nightly rate must be 0 or more.');
  }

  if (form.monthly_rent !== '' && (monthlyRent === null || monthlyRent < 0)) {
    errors.push('Monthly rent must be 0 or more.');
  }

  if (form.bedrooms !== '' && (bedrooms === null || bedrooms < 0)) {
    errors.push('Bedrooms must be 0 or more.');
  }

  if (form.bathrooms !== '' && (bathrooms === null || bathrooms < 0)) {
    errors.push('Bathrooms must be 0 or more.');
  }

  if (form.square_feet !== '' && (squareFeet === null || squareFeet < 0)) {
    errors.push('Square footage must be 0 or more.');
  }

  return errors;
}

function buildPropertyPayload(form) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    country: form.country.trim() || null,
    property_type: form.property_type,
    rental_type: form.rental_type,
    currency: form.currency,
    nightly_rate: cleanNumber(form.nightly_rate),
    monthly_rent: cleanNumber(form.monthly_rent),
    status: form.status,
    bedrooms: cleanNumber(form.bedrooms),
    bathrooms: cleanNumber(form.bathrooms),
    square_feet: cleanNumber(form.square_feet),
    notes: form.notes.trim() || null,
  };
}

function PropertyForm({ property, defaultCurrency, onSubmit, onCancel, submitError = '', submitting = false }) {
  const [form, setForm] = React.useState(() => normalizePropertyForm(property, defaultCurrency));
  const [errors, setErrors] = React.useState([]);
  const isEditing = Boolean(property?.id);

  React.useEffect(() => {
    setForm(normalizePropertyForm(property, defaultCurrency));
    setErrors([]);
  }, [property?.id, defaultCurrency]);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = validateProperty(form);
    setErrors(nextErrors);

    if (nextErrors.length) return;

    await onSubmit(buildPropertyPayload(form));
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel();
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="property-form-title">
        <header className="modal-header">
          <div>
            <h3 id="property-form-title">{isEditing ? 'Edit property' : 'Add property'}</h3>
            <p>
              Add the required property details now. Photos, documents, bookings, cleaning, and
              maintenance can be managed from the property profile.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close form" onClick={onCancel} disabled={submitting}>
            <X size={18} />
          </button>
        </header>

        <form className="modal-form" onSubmit={submit} noValidate>
          <div className="modal-body">
            {submitError && <div className="modal-error" role="alert">{submitError}</div>}
            {errors.length > 0 && (
              <div className="modal-error" role="alert">
                <strong>Please fix these fields:</strong>
                <ul>
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            )}

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
                City
                <input value={form.city} onChange={set('city')} />
              </label>

              <label>
                State / parish
                <input value={form.state} onChange={set('state')} />
              </label>

              <label>
                Country
                <input value={form.country} onChange={set('country')} required />
              </label>

              <label>
                Property type
                <select value={form.property_type} onChange={set('property_type')} required>
                  {propertyTypes.map((item) => (
                    <option key={item} value={item}>{formatLabel(item)}</option>
                  ))}
                </select>
              </label>

              <label>
                Rental type
                <select value={form.rental_type} onChange={set('rental_type')} required>
                  {rentalTypes.map((item) => (
                    <option key={item} value={item}>{formatLabel(item)}</option>
                  ))}
                </select>
              </label>

              <label>
                Status
                <select value={form.status} onChange={set('status')} required>
                  {propertyStatuses.map((item) => (
                    <option key={item} value={item}>{formatLabel(item)}</option>
                  ))}
                </select>
              </label>

              <label>
                Currency
                <select value={form.currency} onChange={set('currency')} required>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>

              <label>
                Nightly rate
                <input value={form.nightly_rate} onChange={set('nightly_rate')} type="number" min="0" step="0.01" />
              </label>

              <label>
                Monthly rent
                <input value={form.monthly_rent} onChange={set('monthly_rent')} type="number" min="0" step="0.01" />
              </label>

              <label>
                Bedrooms
                <input value={form.bedrooms} onChange={set('bedrooms')} type="number" min="0" />
              </label>

              <label>
                Bathrooms
                <input value={form.bathrooms} onChange={set('bathrooms')} type="number" min="0" step="0.5" />
              </label>

              <label>
                Square footage
                <input value={form.square_feet} onChange={set('square_feet')} type="number" min="0" />
              </label>
            </div>

            <label className="full-width">
              Notes
              <textarea value={form.notes} onChange={set('notes')} rows={3} />
            </label>
          </div>

          <footer className="modal-actions">
            <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
            <button className="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save property'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function PropertiesPage() {
  const { data, createProperty, updateProperty, currentUser, currentWorkspace } = useApp();

  const [editingProperty, setEditingProperty] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [status, setStatus] = React.useState('all');
  const [rentalType, setRentalType] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const canEdit = hasAnyRole(currentUser, propertyEditorRoles);
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const properties = data.properties || [];
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const archivedProperties = properties.filter((property) => property.status === 'archived');
  const shortTermProperties = activeProperties.filter((property) => (property.rental_type || property.rentalType) === 'short_term');
  const longTermProperties = activeProperties.filter((property) => (property.rental_type || property.rentalType) === 'long_term');

  const rows = properties
    .filter((property) => (showArchived ? true : property.status !== 'archived'))
    .filter((property) => status === 'all' || property.status === status)
    .filter((property) => rentalType === 'all' || (property.rental_type || property.rentalType) === rentalType)
    .filter((property) => {
      const searchValue = [
        property.name,
        property.address,
        property.city,
        property.state,
        property.country,
        property.property_type,
        property.propertyType,
        property.rental_type,
        property.rentalType,
        property.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchValue.includes(query.toLowerCase().trim());
    });

  const openCreateForm = () => {
    setMessage('');
    setSubmitError('');
    setEditingProperty({ mode: 'create' });
  };

  const openEditForm = (property) => {
    setMessage('');
    setSubmitError('');
    setEditingProperty(property);
  };

  const closeForm = () => {
    setEditingProperty(null);
    setSubmitError('');
  };

  const submit = async (payload) => {
    setSubmitting(true);
    setMessage('');
    setSubmitError('');

    try {
      if (editingProperty?.id) {
        await updateProperty(editingProperty.id, payload);
        setMessage('Property updated.');
      } else {
        await createProperty(payload);
        setMessage('Property saved. You can now add bookings, cleaning tasks, maintenance, photos, and documents.');
      }

      setEditingProperty(null);
    } catch (error) {
      setSubmitError(error.message || 'Could not save property.');
    } finally {
      setSubmitting(false);
    }
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
            <p>Add and manage real workspace properties. Search supports name, address, city, type, rental type, and status.</p>
          </div>

          {canEdit && (
            <button className="primary" type="button" onClick={openCreateForm}>
              <Plus size={16} />
              Add property
            </button>
          )}
        </div>

        {message && <div className="helper">{message}</div>}
        {submitError && <div className="helper error-helper">{submitError}</div>}

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search properties</span>
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search by property name, address, city, type, or status"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {propertyStatuses.map((propertyStatus) => (
              <option key={propertyStatus} value={propertyStatus}>{formatLabel(propertyStatus)}</option>
            ))}
          </select>

          <select value={rentalType} onChange={(event) => setRentalType(event.target.value)}>
            <option value="all">All rental types</option>
            {rentalTypes.map((type) => (
              <option key={type} value={type}>{formatLabel(type)}</option>
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

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Property records</h3>
            <p>{rows.length} matching properties</p>
          </div>
        </div>

        {properties.length ? (
          <DataTable
            compact
            rows={rows}
            empty="No properties match the current filters."
            columns={[
              {
                key: 'name',
                label: 'Property',
                render: (property) => (
                  <div>
                    <strong>{property.name}</strong>
                    <small>{[property.address, property.city, property.country].filter(Boolean).join(', ') || 'No address set'}</small>
                  </div>
                ),
              },
              {
                key: 'property_type',
                label: 'Type',
                render: (property) => formatLabel(property.property_type || property.propertyType),
              },
              {
                key: 'rental_type',
                label: 'Rental',
                render: (property) => formatLabel(property.rental_type || property.rentalType),
              },
              {
                key: 'rate',
                label: 'Rate',
                render: getPropertyRate,
              },
              {
                key: 'status',
                label: 'Status',
                render: (property) => <StatusBadge>{property.status || 'active'}</StatusBadge>,
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (property) => (
                  <div className="table-actions">
                    <button type="button" onClick={() => navigate(`/properties/${property.id}`)}>
                      <Eye size={14} /> View
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => openEditForm(property)}>
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No properties yet"
            description="Add your first real property to start tracking bookings, cleaning, maintenance, owners, and reports."
            icon={Building2}
            action={canEdit ? <button className="primary" type="button" onClick={openCreateForm}>Add first property</button> : null}
          />
        )}
      </section>

      {editingProperty && (
        <PropertyForm
          property={editingProperty}
          defaultCurrency={workspaceCurrency}
          onSubmit={submit}
          onCancel={closeForm}
          submitError={submitError}
          submitting={submitting}
        />
      )}
    </AppLayout>
  );
}
