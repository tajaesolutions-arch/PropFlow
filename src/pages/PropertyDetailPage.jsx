import React from 'react';
import {
  Archive,
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  DollarSign,
  Edit3,
  FileText,
  FileUp,
  Home,
  Image,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { hasAnyRole } from '../lib/auth.js';
import {
  currencies,
  propertyEditorRoles,
  propertyStatuses,
  propertyTypes,
  rentalTypes,
} from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const completedStatuses = new Set(['completed', 'cancelled']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '—';
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyAddress(property) {
  return [property.address, property.city, property.state, property.country].filter(Boolean).join(', ');
}

function getRentalType(property) {
  return property.rental_type || property.rentalType || 'short_term';
}

function getPropertyType(property) {
  return property.property_type || property.propertyType || 'short_term_rental';
}

function getNightlyRate(property) {
  return property.nightly_rate ?? property.nightlyRate;
}

function getMonthlyRent(property) {
  return property.monthly_rent ?? property.monthlyRent;
}

function getSquareFeet(property) {
  return property.square_feet ?? property.squareFeet;
}

function getPropertyRate(property) {
  const rentalType = getRentalType(property);
  const currency = property.currency || 'USD';
  const nightlyRate = getNightlyRate(property);
  const monthlyRent = getMonthlyRent(property);

  if (rentalType === 'long_term') {
    return monthlyRent ? `${formatCurrency(monthlyRent, currency)} / mo` : 'Rate not set';
  }

  if (rentalType === 'both') {
    const nightly = nightlyRate ? `${formatCurrency(nightlyRate, currency)} nightly` : null;
    const monthly = monthlyRent ? `${formatCurrency(monthlyRent, currency)} monthly` : null;

    return [nightly, monthly].filter(Boolean).join(' / ') || 'Rate not set';
  }

  return nightlyRate ? `${formatCurrency(nightlyRate, currency)} / night` : 'Rate not set';
}

function getBookingAmount(booking) {
  return toNumber(booking.totalAmount || booking.total_amount || booking.amount || booking.bookingAmount);
}

function getCleaningCost(task) {
  return toNumber(task.actualCost || task.actual_cost || task.estimatedCost || task.estimated_cost || task.cleaningFee || task.cleaning_fee);
}

function getMaintenanceCost(workOrder) {
  return toNumber(workOrder.actualCost || workOrder.actual_cost || workOrder.estimatedCost || workOrder.estimated_cost);
}

function normalizePropertyForm(property) {
  return {
    name: property.name || '',
    address: property.address || '',
    city: property.city || '',
    state: property.state || '',
    country: property.country || 'United States',
    property_type: getPropertyType(property),
    rental_type: getRentalType(property),
    currency: property.currency || 'USD',
    nightly_rate: getNightlyRate(property) ?? '',
    monthly_rent: getMonthlyRent(property) ?? '',
    status: property.status || 'active',
    bedrooms: property.bedrooms ?? '',
    bathrooms: property.bathrooms ?? '',
    square_feet: getSquareFeet(property) ?? '',
    notes: property.notes || '',
  };
}

function validateProperty(form) {
  const errors = [];

  if (!form.name.trim()) errors.push('Property name is required.');
  if (!form.address.trim()) errors.push('Address or location is required.');
  if (!form.property_type) errors.push('Property type is required.');
  if (!form.rental_type) errors.push('Rental type is required.');
  if (!form.status) errors.push('Status is required.');
  if (!form.currency) errors.push('Currency is required.');

  const numericFields = [
    ['nightly_rate', 'Nightly rate'],
    ['monthly_rent', 'Monthly rent'],
    ['bedrooms', 'Bedrooms'],
    ['bathrooms', 'Bathrooms'],
    ['square_feet', 'Square footage'],
  ];

  numericFields.forEach(([key, label]) => {
    if (form[key] !== '' && (cleanNumber(form[key]) === null || cleanNumber(form[key]) < 0)) {
      errors.push(`${label} must be 0 or more.`);
    }
  });

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

function PropertyEditModal({ property, onSubmit, onCancel, submitting, submitError }) {
  const [form, setForm] = React.useState(() => normalizePropertyForm(property));
  const [errors, setErrors] = React.useState([]);

  React.useEffect(() => {
    setForm(normalizePropertyForm(property));
    setErrors([]);
  }, [property.id]);

  const set = (key) => (event) => {
    setForm((value) => ({ ...value, [key]: event.target.value }));
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
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="property-edit-title">
        <header className="modal-header">
          <div>
            <h3 id="property-edit-title">Edit property</h3>
            <p>Update the core property profile details used across PropFlow operations.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close edit form" onClick={onCancel} disabled={submitting}>
            <X size={18} />
          </button>
        </header>

        <form className="modal-form" onSubmit={submit} noValidate>
          <div className="modal-body">
            {submitError && <div className="modal-error" role="alert">{submitError}</div>}
            {errors.length > 0 && (
              <div className="modal-error" role="alert">
                <strong>Please fix these fields:</strong>
                <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            )}

            <div className="form-grid">
              <label>Property name<input value={form.name} onChange={set('name')} required /></label>
              <label>Address/location<input value={form.address} onChange={set('address')} required /></label>
              <label>City<input value={form.city} onChange={set('city')} /></label>
              <label>State / parish<input value={form.state} onChange={set('state')} /></label>
              <label>Country<input value={form.country} onChange={set('country')} required /></label>
              <label>
                Property type
                <select value={form.property_type} onChange={set('property_type')} required>
                  {propertyTypes.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
              </label>
              <label>
                Rental type
                <select value={form.rental_type} onChange={set('rental_type')} required>
                  {rentalTypes.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={form.status} onChange={set('status')} required>
                  {propertyStatuses.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
                </select>
              </label>
              <label>
                Currency
                <select value={form.currency} onChange={set('currency')} required>
                  {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label>Nightly rate<input value={form.nightly_rate} onChange={set('nightly_rate')} type="number" min="0" step="0.01" /></label>
              <label>Monthly rent<input value={form.monthly_rent} onChange={set('monthly_rent')} type="number" min="0" step="0.01" /></label>
              <label>Bedrooms<input value={form.bedrooms} onChange={set('bedrooms')} type="number" min="0" /></label>
              <label>Bathrooms<input value={form.bathrooms} onChange={set('bathrooms')} type="number" min="0" step="0.5" /></label>
              <label>Square footage<input value={form.square_feet} onChange={set('square_feet')} type="number" min="0" /></label>
            </div>

            <label className="full-width">
              Notes
              <textarea value={form.notes} onChange={set('notes')} rows={3} />
            </label>
          </div>

          <footer className="modal-actions">
            <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
            <button className="primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save changes'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function PropertyDetailPage({ propertyId }) {
  const {
    data,
    updateProperty,
    archiveProperty,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const property = (data.properties || []).find((item) => item.id === propertyId);

  const [editing, setEditing] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  if (!property) {
    return (
      <AppLayout title="Property">
        <section className="card">
          <h3>Property not found</h3>
          <p>This property does not exist, was removed, or is not available for your role.</p>
          <button type="button" onClick={() => navigate('/properties')}>Back to properties</button>
        </section>
      </AppLayout>
    );
  }

  const canEdit = hasAnyRole(currentUser, propertyEditorRoles);
  const propertyCurrency = property.currency || 'USD';

  const bookings = (data.bookings || []).filter((booking) => getPropertyId(booking) === property.id);
  const cleaning = (data.cleaningTasks || []).filter((task) => getPropertyId(task) === property.id);
  const maintenance = (data.maintenanceWorkOrders || []).filter((workOrder) => getPropertyId(workOrder) === property.id);
  const files = (data.fileUploads || []).filter((file) => getPropertyId(file) === property.id || file.property_id === property.id);

  const activeBookings = bookings.filter((booking) => !cancelledStatuses.has(booking.status));
  const openCleaning = cleaning.filter((task) => !completedStatuses.has(task.status));
  const openMaintenance = maintenance.filter((workOrder) => !completedStatuses.has(workOrder.status));
  const grossRevenue = activeBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);
  const cleaningCost = cleaning.reduce((total, task) => total + getCleaningCost(task), 0);
  const maintenanceCost = maintenance.reduce((total, workOrder) => total + getMaintenanceCost(workOrder), 0);
  const netProfit = grossRevenue - cleaningCost - maintenanceCost;

  const save = async (payload) => {
    setSaving(true);
    setMessage('');
    setSubmitError('');

    try {
      await updateProperty(property.id, payload);
      setEditing(false);
      setMessage('Property updated.');
    } catch (error) {
      setSubmitError(error.message || 'Could not update property.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    setSaving(true);
    setMessage('');
    setSubmitError('');

    try {
      await archiveProperty(property.id, property.status !== 'archived');
      setMessage(property.status === 'archived' ? 'Property restored.' : 'Property archived.');
    } catch (error) {
      setSubmitError(error.message || 'Could not update property status.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setMessage('');
    setSubmitError('');

    try {
      await uploadWorkspaceFile({
        file,
        category: 'property_photo',
        relatedTable: 'properties',
        relatedId: property.id,
        propertyId: property.id,
      });

      setMessage('File uploaded to private workspace storage.');
    } catch (error) {
      setSubmitError(error.message || 'File upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <AppLayout title={property.name} subtitle="Property profile, operations, files, and activity">
      <div className="detail-hero card">
        <div>
          <p className="eyebrow">{formatLabel(getPropertyType(property))}</p>
          <h2>{property.name}</h2>
          <p>{getPropertyAddress(property) || 'Address not added'}</p>

          <div className="action-row">
            <StatusBadge>{property.status || 'active'}</StatusBadge>
            <StatusBadge>{formatLabel(getRentalType(property))}</StatusBadge>
            <StatusBadge>{propertyCurrency}</StatusBadge>
          </div>

          {property.status === 'archived' && (
            <p className="helper">Archived property: restore it before adding new bookings, cleaning tasks, or maintenance work.</p>
          )}
        </div>

        <div className="photo-placeholder">
          <Image />
          Private photos
        </div>
      </div>

      <div className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, propertyCurrency)} icon={DollarSign} />
        <StatCard label="Net profit" value={formatCurrency(netProfit, propertyCurrency)} icon={FileText} tone={netProfit >= 0 ? 'accent' : 'warning'} />
        <StatCard label="Bookings" value={bookings.length} icon={CalendarCheck} />
        <StatCard label="Open maintenance" value={openMaintenance.length} icon={Wrench} tone={openMaintenance.length ? 'warning' : 'accent'} />
      </div>

      <div className="metadata-grid">
        <span><BedDouble size={16} />{property.bedrooms || 0} bedrooms</span>
        <span><Bath size={16} />{property.bathrooms || 0} bathrooms</span>
        <span><Building2 size={16} />{getSquareFeet(property) || 0} sq ft</span>
        <span><Home size={16} />{getPropertyRate(property)}</span>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Property details</h3>
            <p>Core profile information used across bookings, cleaning, maintenance, owners, and reports.</p>
          </div>
          {canEdit && (
            <button className="primary" type="button" onClick={() => setEditing(true)}>
              <Edit3 size={16} /> Edit property
            </button>
          )}
        </div>

        <div className="metadata-grid">
          <span><strong>Address:</strong> {property.address || 'Not set'}</span>
          <span><strong>City:</strong> {property.city || 'Not set'}</span>
          <span><strong>State / parish:</strong> {property.state || 'Not set'}</span>
          <span><strong>Country:</strong> {property.country || 'Not set'}</span>
          <span><strong>Property type:</strong> {formatLabel(getPropertyType(property))}</span>
          <span><strong>Rental type:</strong> {formatLabel(getRentalType(property))}</span>
          <span><strong>Nightly rate:</strong> {getNightlyRate(property) ? formatCurrency(getNightlyRate(property), propertyCurrency) : 'Not set'}</span>
          <span><strong>Monthly rent:</strong> {getMonthlyRent(property) ? formatCurrency(getMonthlyRent(property), propertyCurrency) : 'Not set'}</span>
        </div>

        <div className="helper">
          <strong>Notes:</strong> {property.notes || 'No property notes added yet.'}
        </div>

        {(message || submitError) && <p className={submitError ? 'helper error-helper' : 'helper'}>{submitError || message}</p>}
      </section>

      {canEdit && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property actions</h3>
              <p>Archive/restorе status or upload private property files.</p>
            </div>
          </div>

          <div className="action-row">
            <button type="button" className={property.status === 'archived' ? '' : 'danger'} onClick={handleArchiveToggle} disabled={saving}>
              {property.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
              {property.status === 'archived' ? 'Restore property' : 'Archive property'}
            </button>

            <label className="upload-button">
              <FileUp size={16} />
              {uploading ? 'Uploading...' : 'Upload private file'}
              <input type="file" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </section>
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header"><div><h3>Financial summary</h3><p>Local summary from related bookings, cleaning, and maintenance records.</p></div></div>
          <div className="stack-list">
            <div className="stack-item"><strong>Revenue</strong><span>{formatCurrency(grossRevenue, propertyCurrency)}</span></div>
            <div className="stack-item"><strong>Cleaning costs</strong><span>{formatCurrency(cleaningCost, propertyCurrency)}</span></div>
            <div className="stack-item"><strong>Maintenance costs</strong><span>{formatCurrency(maintenanceCost, propertyCurrency)}</span></div>
            <div className="stack-item"><strong>Net profit</strong><span>{formatCurrency(netProfit, propertyCurrency)}</span></div>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><h3>Operations summary</h3><p>Current operational records linked to this property.</p></div></div>
          <div className="stack-list">
            <div className="stack-item"><strong>Active bookings</strong><StatusBadge>{activeBookings.length}</StatusBadge></div>
            <div className="stack-item"><strong>Open cleaning</strong><StatusBadge tone={openCleaning.length ? 'warning' : 'success'}>{openCleaning.length ? 'Due' : 'Clear'}</StatusBadge></div>
            <div className="stack-item"><strong>Open maintenance</strong><StatusBadge tone={openMaintenance.length ? 'warning' : 'success'}>{openMaintenance.length ? 'Open' : 'Clear'}</StatusBadge></div>
            <div className="stack-item"><strong>Private files</strong><span>{files.length}</span></div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header"><div><h3>Related bookings</h3><p>{bookings.length} booking records linked to this property.</p></div></div>
        <DataTable
          compact
          rows={bookings.slice(0, 8)}
          empty="No bookings linked to this property yet."
          columns={[
            { key: 'guest', label: 'Guest', render: (booking) => booking.guestName || booking.guest_name || 'Guest booking' },
            { key: 'checkIn', label: 'Check-in', render: (booking) => formatDate(booking.checkIn || booking.check_in) },
            { key: 'checkOut', label: 'Check-out', render: (booking) => formatDate(booking.checkOut || booking.check_out) },
            { key: 'amount', label: 'Amount', render: (booking) => formatCurrency(getBookingAmount(booking), propertyCurrency) },
            { key: 'status', label: 'Status', render: (booking) => <StatusBadge>{booking.status || 'confirmed'}</StatusBadge> },
          ]}
        />
      </section>

      <section className="card">
        <div className="card-header"><div><h3>Related cleaning tasks</h3><p>{cleaning.length} cleaning records linked to this property.</p></div></div>
        <DataTable
          compact
          rows={cleaning.slice(0, 8)}
          empty="No cleaning tasks linked to this property yet."
          columns={[
            { key: 'scheduledFor', label: 'Scheduled', render: (task) => formatDate(task.scheduledFor || task.scheduled_for) },
            { key: 'status', label: 'Status', render: (task) => <StatusBadge>{task.status || 'scheduled'}</StatusBadge> },
            { key: 'notes', label: 'Notes', render: (task) => task.cleanerNotes || task.cleaner_notes || '—' },
            { key: 'cost', label: 'Cost', render: (task) => formatCurrency(getCleaningCost(task), propertyCurrency) },
          ]}
        />
      </section>

      <section className="card">
        <div className="card-header"><div><h3>Related maintenance work orders</h3><p>{maintenance.length} maintenance records linked to this property.</p></div></div>
        <DataTable
          compact
          rows={maintenance.slice(0, 8)}
          empty="No maintenance work orders linked to this property yet."
          columns={[
            { key: 'title', label: 'Issue', render: (workOrder) => workOrder.title || 'Maintenance issue' },
            { key: 'priority', label: 'Priority', render: (workOrder) => <StatusBadge>{workOrder.priority || 'medium'}</StatusBadge> },
            { key: 'status', label: 'Status', render: (workOrder) => <StatusBadge>{workOrder.status || 'open'}</StatusBadge> },
            { key: 'due', label: 'Due', render: (workOrder) => formatDate(workOrder.due || workOrder.due_date) },
            { key: 'cost', label: 'Cost', render: (workOrder) => formatCurrency(getMaintenanceCost(workOrder), propertyCurrency) },
          ]}
        />
      </section>

      {files.length > 0 && (
        <section className="card">
          <div className="card-header"><div><h3>Private files</h3><p>{files.length} uploaded files linked to this property.</p></div></div>
          <div className="stack-list">
            {files.slice(0, 8).map((file) => (
              <div className="stack-item" key={file.id || file.path}>
                <div><strong>{file.filename || file.path || 'Uploaded file'}</strong><small>{file.category || file.mime_type || 'Private workspace file'}</small></div>
                <StatusBadge>{file.bucket || 'private'}</StatusBadge>
              </div>
            ))}
          </div>
        </section>
      )}

      {!bookings.length && !cleaning.length && !maintenance.length && !files.length && (
        <EmptyState
          title="No linked operations yet"
          description="Bookings, cleaning tasks, maintenance work orders, and uploaded files for this property will appear here."
          compact
        />
      )}

      {editing && (
        <PropertyEditModal
          property={property}
          onSubmit={save}
          onCancel={() => {
            setEditing(false);
            setSubmitError('');
          }}
          submitting={saving}
          submitError={submitError}
        />
      )}
    </AppLayout>
  );
}
