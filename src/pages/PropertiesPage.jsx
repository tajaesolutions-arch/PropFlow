import React from 'react';
import {
  Archive,
  Building2,
  Edit3,
  Eye,
  Home,
  Hotel,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
import { FEATURE_KEYS, getUpgradeMessage, getUsageLimitState, getWorkspacePlan } from '../lib/planLimits.js';
import { navigate } from '../routes/AppRouter.jsx';
import {
  currencies,
  propertyEditorRoles,
  propertyStatuses,
  propertyTypes,
  rentalTypes,
  roles,
} from '../data/constants.js';

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

const calendarAccessRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

function hasAnyActiveWorkspaceRole(memberships = [], currentWorkspace, allowedRoles = []) {
  const activeMembership = memberships.find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status === 'active',
  );
  const activeRoles = Array.isArray(activeMembership?.roles) ? activeMembership.roles : [];

  return allowedRoles.some((role) => activeRoles.includes(role));
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '—';
}

function getField(property, camelKey, snakeKey, fallback = '') {
  if (property?.[camelKey] !== undefined && property?.[camelKey] !== null) return property[camelKey];
  if (property?.[snakeKey] !== undefined && property?.[snakeKey] !== null) return property[snakeKey];
  return fallback;
}

function getOwnerId(property) {
  return property.assignedOwnerId || property.assigned_owner_id || property.ownerId || property.owner_id || '';
}

function isOwnerRole(currentUser, memberships = [], currentWorkspace = null) {
  return hasAnyActiveWorkspaceRole(memberships, currentWorkspace, [roles.OWNER]);
}

function canOwnerSeeProperty(property, currentUser, memberships = [], currentWorkspace = null) {
  if (!isOwnerRole(currentUser, memberships, currentWorkspace)) return true;
  return getOwnerId(property) === currentUser?.id;
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
    property_type: getField(property, 'propertyType', 'property_type', 'short_term_rental'),
    rental_type: getField(property, 'rentalType', 'rental_type', 'short_term'),
    currency: property.currency || defaultCurrency || 'USD',
    nightly_rate: getField(property, 'nightlyRate', 'nightly_rate', ''),
    monthly_rent: getField(property, 'monthlyRent', 'monthly_rent', ''),
    status: property.status || 'active',
    bedrooms: property.bedrooms ?? '',
    bathrooms: property.bathrooms ?? '',
    square_feet: getField(property, 'squareFeet', 'square_feet', ''),
    notes: property.notes || '',
  };
}

function getPropertyRate(property) {
  const rentalType = getField(property, 'rentalType', 'rental_type', 'short_term');
  const currency = property.currency || 'USD';
  const nightlyRate = getField(property, 'nightlyRate', 'nightly_rate', null);
  const monthlyRent = getField(property, 'monthlyRent', 'monthly_rent', null);

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

function getPotentialMonthlyRevenue(property) {
  const rentalType = getField(property, 'rentalType', 'rental_type', 'short_term');
  const nightlyRate = cleanNumber(getField(property, 'nightlyRate', 'nightly_rate', null));
  const monthlyRent = cleanNumber(getField(property, 'monthlyRent', 'monthly_rent', null));

  if (rentalType === 'long_term') return monthlyRent || 0;
  if (rentalType === 'both') return monthlyRent || (nightlyRate ? nightlyRate * 21 : 0);

  return nightlyRate ? nightlyRate * 21 : 0;
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

function matchesSearch(property, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

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
    property.currency,
    property.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchValue.includes(normalizedQuery);
}

function getPropertyLocation(property) {
  return [property.city, property.state, property.country].filter(Boolean).join(', ') || property.address || 'No location';
}

function getPropertyTypeLabel(property) {
  return formatLabel(getField(property, 'propertyType', 'property_type', 'property'));
}

function getRentalTypeLabel(property) {
  return formatLabel(getField(property, 'rentalType', 'rental_type', 'rental'));
}

function PropertyEditModal({
  property,
  defaultCurrency,
  onSubmit,
  onCancel,
  submitError = '',
  submitting = false,
}) {
  const [form, setForm] = React.useState(() => normalizePropertyForm(property, defaultCurrency));
  const [errors, setErrors] = React.useState([]);

  React.useEffect(() => {
    setForm(normalizePropertyForm(property, defaultCurrency));
    setErrors([]);
  }, [property?.id, defaultCurrency]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, submitting]);

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
            <h3 id="property-form-title">Edit property</h3>
            <p>
              Update the property profile. Bookings, cleaning, maintenance, files, and owner records
              stay linked to this workspace property.
            </p>
          </div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close form"
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
                Property name
                <input value={form.name} onChange={set('name')} required />
              </label>

              <label>
                Address / location
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
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Rental type
                <select value={form.rental_type} onChange={set('rental_type')} required>
                  {rentalTypes.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Status
                <select value={form.status} onChange={set('status')} required>
                  {propertyStatuses.map((item) => (
                    <option key={item} value={item}>
                      {formatLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Currency
                <select value={form.currency} onChange={set('currency')} required>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nightly rate
                <input
                  value={form.nightly_rate}
                  onChange={set('nightly_rate')}
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>

              <label>
                Monthly rent
                <input
                  value={form.monthly_rent}
                  onChange={set('monthly_rent')}
                  type="number"
                  min="0"
                  step="0.01"
                />
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
                <input
                  value={form.square_feet}
                  onChange={set('square_feet')}
                  type="number"
                  min="0"
                />
              </label>

              <label className="full">
                Notes
                <textarea value={form.notes} onChange={set('notes')} rows={3} />
              </label>
            </div>
          </div>

          <footer className="modal-actions">
            <button type="button" onClick={onCancel} disabled={submitting} data-skip-create-action="true">
              Cancel
            </button>

            <button className="primary" type="submit" disabled={submitting} data-skip-create-action="true">
              {submitting ? 'Saving…' : 'Save property'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function PropertiesPage() {
  const {
    data,
    updateProperty,
    archiveProperty,
    currentUser,
    currentWorkspace,
    memberships,
  } = useApp();

  const [editingProperty, setEditingProperty] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [status, setStatus] = React.useState('all');
  const [rentalType, setRentalType] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const canEdit = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, propertyEditorRoles);
  const canOpenCalendar = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, calendarAccessRoles);
  const ownerView = isOwnerRole(currentUser, memberships, currentWorkspace);
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const allProperties = data.properties || [];
  const properties = allProperties.filter((property) =>
    canOwnerSeeProperty(property, currentUser, memberships, currentWorkspace),
  );
  const activeProperties = properties.filter((property) => property.status !== 'archived');
  const archivedProperties = properties.filter((property) => property.status === 'archived');
  const workspacePlan = getWorkspacePlan(data.subscription, currentWorkspace);
  const propertyLimitState = getUsageLimitState({
    plan: workspacePlan,
    limitKey: 'maxProperties',
    currentCount: Array.isArray(allProperties) ? allProperties.filter((property) => property.status !== 'archived').length : null,
  });
  const propertyLimitReached = !ownerView && propertyLimitState.reached;

  const shortTermProperties = activeProperties.filter((property) =>
    ['short_term', 'both'].includes(getField(property, 'rentalType', 'rental_type')),
  );

  const longTermProperties = activeProperties.filter((property) =>
    ['long_term', 'both'].includes(getField(property, 'rentalType', 'rental_type')),
  );

  const maintenanceIssueProperties = activeProperties.filter((property) => property.status === 'maintenance_issue');

  const potentialMonthlyRevenue = activeProperties.reduce(
    (total, property) => total + getPotentialMonthlyRevenue(property),
    0,
  );

  const rows = properties
    .filter((property) => (showArchived ? true : property.status !== 'archived'))
    .filter((property) => status === 'all' || property.status === status)
    .filter((property) => rentalType === 'all' || getField(property, 'rentalType', 'rental_type') === rentalType)
    .filter((property) => matchesSearch(property, query));

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const openEdit = (property) => {
    setSubmitError('');
    setEditingProperty(property);
  };

  const closeEdit = () => {
    if (submitting) return;

    setEditingProperty(null);
    setSubmitError('');
  };

  const submitEdit = async (payload) => {
    if (!editingProperty?.id) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      await updateProperty(editingProperty.id, payload);
      setEditingProperty(null);
      setMessage('Property updated successfully.');
      clearMessageSoon();
    } catch (error) {
      setSubmitError(error?.message || 'Property could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (property, archived = true) => {
    if (!canEdit || !property?.id) return;

    setMessage('');

    try {
      await archiveProperty(property.id, archived);
      setMessage(archived ? 'Property archived.' : 'Property restored.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error?.message || 'Property status could not be updated.');
    }
  };

  return (
    <AppLayout
      title="Properties"
      subtitle={ownerView
        ? 'Assigned property records, property status, and owner-visible property details.'
        : 'Manage every short-term rental, long-term rental, villa, unit, and commercial property in this workspace.'}
    >
      {message && (
        <section className="helper" role="status">
          {message}
        </section>
      )}

      {ownerView && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Owner visibility</p>
              <h3>Property list is scoped to assigned properties</h3>
              <p>
                This page only shows properties assigned to your owner account. Workspace-wide property records stay hidden.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid">
        <StatCard
          label={ownerView ? 'Assigned active properties' : 'Active properties'}
          value={activeProperties.length}
          subtitle={`${archivedProperties.length} archived`}
          icon={Building2}
        />

        <StatCard
          label="Short-term / Airbnb"
          value={shortTermProperties.length}
          subtitle="Nightly-rate or hybrid properties"
          icon={Hotel}
        />

        <StatCard
          label="Long-term rentals"
          value={longTermProperties.length}
          subtitle="Monthly-rent or hybrid properties"
          icon={Home}
        />

        <StatCard
          label={ownerView ? 'Assigned monthly potential' : 'Potential monthly revenue'}
          value={formatCurrency(potentialMonthlyRevenue, workspaceCurrency)}
          subtitle={`${maintenanceIssueProperties.length} properties need maintenance review`}
          icon={Building2}
        />
      </section>

      <section className="card properties-toolbar">
        <div>
          <h3>{ownerView ? 'Assigned property portfolio' : 'Property portfolio'}</h3>
          <p>
            {ownerView
              ? 'Search, filter, and view properties assigned to this owner account.'
              : 'Search, filter, view, and update workspace-scoped property records.'}
          </p>
        </div>

        <div className="properties-toolbar-actions">
          {canEdit && (
            <button
              type="button"
              className="primary"
              data-create-action={propertyLimitReached ? undefined : 'property'}
              data-skip-create-action={propertyLimitReached ? 'true' : undefined}
              disabled={propertyLimitReached}
              title={propertyLimitReached ? getUpgradeMessage(FEATURE_KEYS.PROPERTIES, workspacePlan.key) : undefined}
            >
              <Plus size={16} />
              Add Property
            </button>
          )}

          {canOpenCalendar && (
            <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
              View Calendar
            </button>
          )}
        </div>

        {canEdit && (propertyLimitReached || propertyLimitState.available) && (
          <div className={propertyLimitReached ? 'helper warning-helper' : 'helper'}>
            Plan usage: {propertyLimitState.label} active properties on {workspacePlan.label}.{' '}
            {propertyLimitReached
              ? getUpgradeMessage(FEATURE_KEYS.PROPERTIES, workspacePlan.key)
              : propertyLimitState.unlimited ? 'This plan supports unlimited active properties.' : `${propertyLimitState.remaining} property slots remaining.`}
          </div>
        )}
      </section>

      <section className="card">
        <div className="properties-filters">
          <label className="properties-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ownerView
                ? 'Search assigned properties by name, address, city, country, type, or status...'
                : 'Search by property name, address, city, country, type, or status...'}
              aria-label="Search properties"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear property search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {propertyStatuses.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Rental type
            <select value={rentalType} onChange={(event) => setRentalType(event.target.value)}>
              <option value="all">All rental types</option>
              {rentalTypes.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-check properties-archive-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
        </div>
      </section>

      {rows.length ? (
        <>
          <section className="properties-card-grid">
            {rows.slice(0, 6).map((property) => (
              <article className="card property-card" key={property.id}>
                <div className="property-card-hero">
                  <div className="property-card-icon">
                    <Building2 size={22} />
                  </div>

                  <StatusBadge>{property.status || 'active'}</StatusBadge>
                </div>

                <div className="property-card-body">
                  <h3>{property.name || 'Unnamed property'}</h3>
                  <p>{getPropertyLocation(property)}</p>

                  <div className="property-meta-grid">
                    <span>
                      <strong>{getPropertyTypeLabel(property)}</strong>
                      <small>Property type</small>
                    </span>

                    <span>
                      <strong>{getRentalTypeLabel(property)}</strong>
                      <small>Rental type</small>
                    </span>

                    <span>
                      <strong>{getPropertyRate(property)}</strong>
                      <small>Rate</small>
                    </span>

                    <span>
                      <strong>
                        {[property.bedrooms, property.bathrooms].filter((value) => value !== null && value !== undefined && value !== '').join(' bd / ') || '—'}
                      </strong>
                      <small>Beds / baths</small>
                    </span>
                  </div>
                </div>

                <div className="property-card-actions">
                  <button
                    type="button"
                    onClick={() => navigate(`/properties/${property.id}`)}
                    data-skip-create-action="true"
                  >
                    <Eye size={16} />
                    View
                  </button>

                  {canEdit && property.status !== 'archived' && (
                    <button type="button" onClick={() => openEdit(property)} data-skip-create-action="true">
                      <Edit3 size={16} />
                      Edit
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>{ownerView ? 'Assigned properties' : 'All properties'}</h3>
                <p>{rows.length} property record{rows.length === 1 ? '' : 's'} match the current filters.</p>
              </div>
            </div>

            <DataTable
              rows={rows}
              empty="No properties match these filters."
              columns={[
                {
                  key: 'name',
                  label: 'Property',
                  render: (property) => (
                    <button
                      type="button"
                      className="link"
                      onClick={() => navigate(`/properties/${property.id}`)}
                      data-skip-create-action="true"
                    >
                      {property.name || 'Unnamed property'}
                    </button>
                  ),
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (property) => getPropertyLocation(property),
                },
                {
                  key: 'property_type',
                  label: 'Type',
                  render: (property) => getPropertyTypeLabel(property),
                },
                {
                  key: 'rental_type',
                  label: 'Rental',
                  render: (property) => getRentalTypeLabel(property),
                },
                {
                  key: 'rate',
                  label: 'Rate',
                  render: (property) => getPropertyRate(property),
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
                    <div className="action-row">
                      <button
                        type="button"
                        onClick={() => navigate(`/properties/${property.id}`)}
                        data-skip-create-action="true"
                      >
                        <Eye size={16} />
                        View
                      </button>

                      {canEdit && property.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => openEdit(property)}
                          data-skip-create-action="true"
                        >
                          <Edit3 size={16} />
                          Edit
                        </button>
                      )}

                      {canEdit && property.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => handleArchive(property, true)}
                          data-skip-create-action="true"
                        >
                          <Archive size={16} />
                          Archive
                        </button>
                      )}

                      {canEdit && property.status === 'archived' && (
                        <button
                          type="button"
                          onClick={() => handleArchive(property, false)}
                          data-skip-create-action="true"
                        >
                          <RotateCcw size={16} />
                          Restore
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </>
      ) : (
        <EmptyState
          eyebrow="Properties"
          icon={Building2}
          title={properties.length ? 'No properties match your filters' : ownerView ? 'No assigned properties yet' : 'Add your first property'}
          description={
            properties.length
              ? 'Adjust the search, status, rental type, or archived filter to find a property.'
              : ownerView
                ? 'Your property manager has not assigned properties to this owner account yet.'
                : 'Create a real property record before adding bookings, cleaning tasks, maintenance work orders, or owner reports.'
          }
          action={
            canEdit ? (
              <button type="button" className="primary" data-create-action="property">
                <Plus size={16} />
                Add Property
              </button>
            ) : null
          }
          secondaryAction={
            properties.length ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatus('all');
                  setRentalType('all');
                  setShowArchived(false);
                }}
                data-skip-create-action="true"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      )}

      {editingProperty && (
        <PropertyEditModal
          property={editingProperty}
          defaultCurrency={workspaceCurrency}
          onSubmit={submitEdit}
          onCancel={closeEdit}
          submitError={submitError}
          submitting={submitting}
        />
      )}
    </AppLayout>
  );
}
