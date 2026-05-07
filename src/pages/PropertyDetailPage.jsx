import React from 'react';
import {
  Archive,
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  DollarSign,
  FileUp,
  Home,
  Image,
  RotateCcw,
  Wrench,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';
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

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatLabel(value) {
  return value ? value.replaceAll('_', ' ') : '—';
}

function getPropertyAddress(property) {
  return [property.address, property.city, property.state, property.country].filter(Boolean).join(', ');
}

function getPropertyRate(property) {
  if (property.rental_type === 'long_term') {
    return property.monthly_rent
      ? `${formatCurrency(property.monthly_rent, property.currency)} / mo`
      : 'Rate not set';
  }

  if (property.rental_type === 'both') {
    const nightly = property.nightly_rate
      ? `${formatCurrency(property.nightly_rate, property.currency)} nightly`
      : null;
    const monthly = property.monthly_rent
      ? `${formatCurrency(property.monthly_rent, property.currency)} monthly`
      : null;

    return [nightly, monthly].filter(Boolean).join(' / ') || 'Rate not set';
  }

  return property.nightly_rate
    ? `${formatCurrency(property.nightly_rate, property.currency)} / night`
    : 'Rate not set';
}

function getBookingAmount(booking) {
  return Number(booking.totalAmount || booking.total_amount || booking.amount || 0);
}

export function PropertyDetailPage({ propertyId }) {
  const {
    data,
    updateProperty,
    archiveProperty,
    uploadWorkspaceFile,
    currentUser,
  } = useApp();

  const property = data.properties.find((item) => item.id === propertyId);

  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(property || {});
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    setForm(property || {});
  }, [property?.id]);

  if (!property) {
    return (
      <AppLayout title="Property">
        <section className="card">
          <h3>Property not found</h3>
          <p>This property does not exist, was removed, or is not available for your role.</p>
          <button type="button" onClick={() => navigate('/properties')}>
            Back to properties
          </button>
        </section>
      </AppLayout>
    );
  }

  const canEdit = hasAnyRole(currentUser, propertyEditorRoles);

  const bookings = (data.bookings || []).filter((booking) => booking.propertyId === property.id);
  const cleaning = (data.cleaningTasks || []).filter((task) => task.propertyId === property.id);
  const maintenance = (data.maintenanceWorkOrders || []).filter(
    (workOrder) => workOrder.propertyId === property.id,
  );
  const files = (data.fileUploads || []).filter((file) => file.property_id === property.id);

  const activeBookings = bookings.filter((booking) => booking.status !== 'cancelled');
  const openCleaning = cleaning.filter((task) => !completedStatuses.has(task.status));
  const openMaintenance = maintenance.filter((workOrder) => !completedStatuses.has(workOrder.status));
  const grossRevenue = activeBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await updateProperty(property.id, {
        name: form.name?.trim(),
        address: form.address?.trim(),
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        country: form.country?.trim(),
        property_type: form.property_type,
        rental_type: form.rental_type,
        currency: form.currency,
        nightly_rate: cleanNumber(form.nightly_rate),
        monthly_rent: cleanNumber(form.monthly_rent),
        status: form.status,
        bedrooms: cleanNumber(form.bedrooms),
        bathrooms: cleanNumber(form.bathrooms),
        square_feet: cleanNumber(form.square_feet),
        notes: form.notes?.trim() || null,
      });

      setEditing(false);
      setMessage('Property updated.');
    } catch (error) {
      setMessage(error.message || 'Could not update property.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    setSaving(true);
    setMessage('');

    try {
      await archiveProperty(property.id, property.status !== 'archived');
      setMessage(property.status === 'archived' ? 'Property restored.' : 'Property archived.');
    } catch (error) {
      setMessage(error.message || 'Could not update property status.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setMessage('');

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
      setMessage(error.message || 'File upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <AppLayout title={property.name} subtitle="Property profile, operations, files, and activity">
      <div className="detail-hero card">
        <div>
          <p className="eyebrow">{formatLabel(property.property_type)}</p>
          <h2>{property.name}</h2>
          <p>{getPropertyAddress(property) || 'Address not added'}</p>

          <div className="action-row">
            <StatusBadge>{property.status || 'active'}</StatusBadge>
            <StatusBadge>{formatLabel(property.rental_type)}</StatusBadge>
          </div>

          {property.status === 'archived' && (
            <p className="helper">
              Archived property: restore it before adding new bookings, cleaning tasks, or
              maintenance work.
            </p>
          )}
        </div>

        <div className="photo-placeholder">
          <Image />
          Private photos
        </div>
      </div>

      <div className="stat-grid dense">
        <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, property.currency)} icon={DollarSign} />
        <StatCard label="Bookings" value={bookings.length} icon={CalendarCheck} />
        <StatCard label="Open cleaning" value={openCleaning.length} icon={Home} />
        <StatCard label="Open maintenance" value={openMaintenance.length} icon={Wrench} />
      </div>

      <div className="metadata-grid">
        <span>
          <BedDouble size={16} />
          {property.bedrooms || 0} bedrooms
        </span>
        <span>
          <Bath size={16} />
          {property.bathrooms || 0} bathrooms
        </span>
        <span>
          <Building2 size={16} />
          {formatLabel(property.rental_type)}
        </span>
        <span>{getPropertyRate(property)}</span>
      </div>

      {canEdit && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property actions</h3>
              <p>Edit property details, archive/restorе status, or upload private property files.</p>
            </div>
          </div>

          <div className="action-row">
            <button className="primary" type="button" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Close edit' : 'Edit property'}
            </button>

            <button
              type="button"
              className={property.status === 'archived' ? '' : 'danger'}
              onClick={handleArchiveToggle}
              disabled={saving}
            >
              {property.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
              {property.status === 'archived' ? 'Restore' : 'Archive'}
            </button>

            <label className="upload-button">
              <FileUp size={16} />
              {uploading ? 'Uploading…' : 'Upload private file'}
              <input type="file" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          {message && <p className="helper">{message}</p>}
        </section>
      )}

      {editing && (
        <form className="card" onSubmit={save}>
          <div className="card-header">
            <div>
              <h3>Edit property</h3>
              <p>Update the core property profile details used across PropFlow.</p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Name
              <input value={form.name || ''} onChange={set('name')} required />
            </label>

            <label>
              Address
              <input value={form.address || ''} onChange={set('address')} required />
            </label>

            <label>
              Country
              <input value={form.country || ''} onChange={set('country')} required />
            </label>

            <label>
              Property type
              <select value={form.property_type || 'short_term_rental'} onChange={set('property_type')}>
                {propertyTypes.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rental type
              <select value={form.rental_type || 'short_term'} onChange={set('rental_type')}>
                {rentalTypes.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Currency
              <select value={form.currency || 'USD'} onChange={set('currency')}>
                {currencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </label>

            <label>
              Nightly rate
              <input value={form.nightly_rate || ''} onChange={set('nightly_rate')} type="number" min="0" />
            </label>

            <label>
              Monthly rent
              <input value={form.monthly_rent || ''} onChange={set('monthly_rent')} type="number" min="0" />
            </label>

            <label>
              Status
              <select value={form.status || 'active'} onChange={set('status')}>
                {propertyStatuses.map((item) => (
                  <option key={item} value={item}>
                    {formatLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              City
              <input value={form.city || ''} onChange={set('city')} />
            </label>

            <label>
              State / parish
              <input value={form.state || ''} onChange={set('state')} />
            </label>

            <label>
              Bedrooms
              <input value={form.bedrooms || ''} onChange={set('bedrooms')} type="number" min="0" />
            </label>

            <label>
              Bathrooms
              <input
                value={form.bathrooms || ''}
                onChange={set('bathrooms')}
                type="number"
                min="0"
                step="0.5"
              />
            </label>

            <label>
              Square feet
              <input value={form.square_feet || ''} onChange={set('square_feet')} type="number" min="0" />
            </label>

            <label className="full">
              Notes
              <textarea value={form.notes || ''} onChange={set('notes')} />
            </label>
          </div>

          <div className="action-row">
            <button className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Cleaning tasks</h3>
              <p>Cleaning history and upcoming cleaning operations for this property.</p>
            </div>
            <button type="button" onClick={() => navigate('/cleaning')}>
              View cleaning
            </button>
          </div>

          {cleaning.length ? (
            cleaning.slice(0, 6).map((task) => (
              <div className="list-row" key={task.id}>
                <span>
                  {task.scheduledFor || task.scheduled_for || 'Unscheduled'}
                  <small>{task.cleanerNotes || task.cleaner_notes || 'No notes'}</small>
                </span>
                <StatusBadge>{task.status || 'pending'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No cleaning tasks yet."
              description="Cleaning tasks connected to this property will appear here."
            />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Maintenance work orders</h3>
              <p>Open and completed repairs connected to this property.</p>
            </div>
            <button type="button" onClick={() => navigate('/maintenance')}>
              View maintenance
            </button>
          </div>

          {maintenance.length ? (
            maintenance.slice(0, 6).map((workOrder) => (
              <div className="list-row" key={workOrder.id}>
                <span>
                  {workOrder.title || 'Maintenance issue'}
                  <small>{workOrder.description || 'No description'}</small>
                </span>
                <StatusBadge>{workOrder.priority || workOrder.status || 'open'}</StatusBadge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No maintenance work orders yet."
              description="Maintenance issues and completed repairs will appear here."
            />
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Private files</h3>
            <p>Property photos, documents, leases, receipts, and other private workspace files.</p>
          </div>
        </div>

        {files.length ? (
          files.slice(0, 8).map((file) => (
            <div className="list-row" key={file.id}>
              <span>
                {file.filename || file.path}
                <small>{file.category || 'file'} · private storage</small>
              </span>
              <StatusBadge>{file.mime_type || 'uploaded'}</StatusBadge>
            </div>
          ))
        ) : (
          <EmptyState
            title="No private files uploaded yet."
            description="Upload property photos, documents, leases, receipts, or invoices from the property actions panel."
          />
        )}
      </section>
    </AppLayout>
  );
}
