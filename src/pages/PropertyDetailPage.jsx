import React from 'react';
import {
  Archive,
  Bath,
  BedDouble,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  DollarSign,
  DownloadCloud,
  Edit3,
  Eye,
  FileText,
  FileUp,
  Globe2,
  Home,
  Image,
  Lock,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { FileList } from '../components/FileList.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import {
  currencies,
  propertyEditorRoles,
  propertyStatuses,
  propertyTypes,
  rentalTypes,
  roles,
  taskManagerRoles,
  calendarImportProviderTypes,
} from '../data/constants.js';
import { FEATURE_KEYS, canUseFeature, getUpgradeMessage, getWorkspacePlan } from '../lib/planLimits.js';
import { navigate } from '../routes/AppRouter.jsx';

const closedStatuses = new Set(['completed', 'cancelled', 'guest_ready']);
const cancelledStatuses = new Set(['cancelled', 'void', 'refunded']);
const inactiveLeaseStatuses = new Set(['ended', 'terminated', 'archived']);
const financePropertyRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT, roles.OWNER];
const broadPropertyAccessRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT];

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

function getOwnerId(property) {
  return property.assignedOwnerId || property.assigned_owner_id || property.ownerId || property.owner_id || '';
}

function getOwnerName(property, contacts = [], members = []) {
  const ownerId = getOwnerId(property);

  if (!ownerId) return 'No owner assigned';

  const contact = contacts.find((item) => item.id === ownerId);
  const member = members.find((item) => item.user_id === ownerId || item.userId === ownerId || item.id === ownerId);

  return (
    contact?.full_name ||
    contact?.fullName ||
    contact?.name ||
    member?.profile?.full_name ||
    member?.profiles?.full_name ||
    member?.email ||
    ownerId
  );
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

function getOwnerPayout(booking) {
  return toNumber(booking.ownerPayout || booking.owner_payout);
}

function getCleaningCost(task) {
  return toNumber(
    task.actualCost ||
      task.actual_cost ||
      task.estimatedCost ||
      task.estimated_cost ||
      task.cleaningFee ||
      task.cleaning_fee,
  );
}

function getMaintenanceCost(workOrder) {
  return toNumber(
    workOrder.actualCost ||
      workOrder.actual_cost ||
      workOrder.estimatedCost ||
      workOrder.estimated_cost,
  );
}

function getBookingCheckIn(booking) {
  return booking.checkIn || booking.check_in || '';
}

function getBookingCheckOut(booking) {
  return booking.checkOut || booking.check_out || '';
}

function getLeaseStart(lease) {
  return lease.leaseStart || lease.lease_start || '';
}

function getLeaseEnd(lease) {
  return lease.leaseEnd || lease.lease_end || '';
}

function getLeaseStatus(lease) {
  return lease.leaseStatus || lease.lease_status || 'draft';
}

function getLeasePaymentStatus(lease) {
  return lease.paymentStatus || lease.payment_status || lease.rentPaymentStatus || lease.rent_payment_status || 'not_tracked';
}

function getLeaseRent(lease) {
  const value = Number(lease.rentAmount ?? lease.rent_amount ?? lease.monthlyRent ?? lease.monthly_rent ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getCleaningDate(task) {
  return task.scheduledFor || task.scheduled_for || task.created_at || '';
}

function getMaintenanceDate(workOrder) {
  return workOrder.due || workOrder.due_date || workOrder.created_at || '';
}

function getFileName(file) {
  return file.fileName || file.file_name || file.filename || file.name || file.filePath || file.path || 'Workspace file';
}

function getFileCategory(file) {
  return file.fileCategory || file.file_category || file.category || 'file';
}

function getAssignedCleanerId(task) {
  return task.assignedCleanerId || task.assigned_cleaner_id || task.cleanerId || task.cleaner_id || '';
}

function getAssignedMaintenanceId(workOrder) {
  return (
    workOrder.assignedMaintenanceId ||
    workOrder.assigned_maintenance_id ||
    workOrder.maintenanceId ||
    workOrder.maintenance_id ||
    ''
  );
}

function isOwnerAssignedToProperty(property, currentUser) {
  return currentUser?.roles?.includes(roles.OWNER) && getOwnerId(property) === currentUser?.id;
}

function hasAssignedCleaningForProperty(propertyId, cleaning = [], currentUser) {
  if (!currentUser?.roles?.includes(roles.CLEANER)) return false;

  const hasAssignmentData = cleaning.some((task) => Boolean(getAssignedCleanerId(task)));
  if (!hasAssignmentData) return false;

  return cleaning.some(
    (task) => getPropertyId(task) === propertyId && getAssignedCleanerId(task) === currentUser?.id,
  );
}

function hasAssignedMaintenanceForProperty(propertyId, maintenance = [], currentUser) {
  if (!currentUser?.roles?.includes(roles.MAINTENANCE)) return false;

  const hasAssignmentData = maintenance.some((workOrder) => Boolean(getAssignedMaintenanceId(workOrder)));
  if (!hasAssignmentData) return false;

  return maintenance.some(
    (workOrder) => getPropertyId(workOrder) === propertyId && getAssignedMaintenanceId(workOrder) === currentUser?.id,
  );
}

function canViewPropertyDetail({ property, currentUser, cleaning, maintenance, memberships, currentWorkspace }) {
  if (hasAnyActiveWorkspaceRole(memberships, currentWorkspace, broadPropertyAccessRoles)) return true;
  if (isOwnerAssignedToProperty(property, currentUser)) return true;
  if (hasAssignedCleaningForProperty(property.id, cleaning, currentUser)) return true;
  if (hasAssignedMaintenanceForProperty(property.id, maintenance, currentUser)) return true;

  return false;
}

function canViewPropertyFinance(property, currentUser, memberships, currentWorkspace) {
  if (!hasAnyActiveWorkspaceRole(memberships, currentWorkspace, financePropertyRoles)) return false;
  if (currentUser?.roles?.includes(roles.OWNER)) return isOwnerAssignedToProperty(property, currentUser);

  return true;
}

function statusTone(value) {
  const status = String(value || '').toLowerCase();

  if (['archived', 'cancelled', 'urgent', 'missed', 'overdue'].includes(status)) return 'error';
  if (['pending', 'scheduled', 'reported', 'in_progress', 'waiting_parts', 'needs_inspection'].includes(status)) return 'warning';
  if (['active', 'confirmed', 'completed', 'guest_ready', 'paid'].includes(status)) return 'success';

  return 'info';
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

          <button
            type="button"
            className="icon-btn"
            aria-label="Close edit form"
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

            <button className="primary" disabled={submitting} data-skip-create-action="true">
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
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
    getFileSignedUrl,
    currentUser,
    memberships,
    currentWorkspace,
    createCalendarImportFeed,
    archiveCalendarImportFeed,
    syncCalendarImportFeed,
  } = useApp();

  const property = (data.properties || []).find((item) => item.id === propertyId);
  const allCleaning = data.cleaningTasks || [];
  const allMaintenance = data.maintenanceWorkOrders || [];

  const [editing, setEditing] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [submitError, setSubmitError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [feedForm, setFeedForm] = React.useState({ name: '', providerType: 'airbnb_ical', feedUrl: '' });
  const [feedBusyId, setFeedBusyId] = React.useState('');

  if (!property) {
    return (
      <AppLayout title="Property" subtitle="Property profile">
        <EmptyState
          eyebrow="Property"
          icon={Building2}
          title="Property not found"
          description="This property does not exist, was removed, or is not available for your role."
          action={
            <button type="button" onClick={() => navigate('/properties')} data-skip-create-action="true">
              Back to properties
            </button>
          }
        />
      </AppLayout>
    );
  }

  const canView = canViewPropertyDetail({
    property,
    currentUser,
    cleaning: allCleaning,
    maintenance: allMaintenance,
    memberships,
    currentWorkspace,
  });

  if (!canView) {
    return (
      <AppLayout title="Property access restricted" subtitle="Property profile access is role-scoped.">
        <EmptyState
          eyebrow="Access restricted"
          icon={Lock}
          title="This property is not available for your role"
          description="Property Owners can only view assigned properties. Cleaners and Maintenance Crew can only view properties tied to their assigned tasks or work orders."
          action={
            <button type="button" onClick={() => navigate('/properties')} data-skip-create-action="true">
              Back to properties
            </button>
          }
        />
      </AppLayout>
    );
  }

  const canEdit = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, propertyEditorRoles);
  const canManageDirectBooking = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, taskManagerRoles);
  const canManageCalendarImports = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, taskManagerRoles);
  const workspacePlan = getWorkspacePlan(data.subscription, currentWorkspace);
  const directBookingAccess = canUseFeature(currentWorkspace, FEATURE_KEYS.DIRECT_BOOKING_PAGES, data.subscription);
  const directBookingPage = (data.directBookingPages || []).find((page) => (page.propertyId || page.property_id) === property.id);
  const directBookingUrl = directBookingPage?.slug ? `${window.location.origin}/book/${directBookingPage.slug}` : '';
  const canCreateOperationalRecords = hasAnyActiveWorkspaceRole(memberships, currentWorkspace, taskManagerRoles);
  const canSeeFinance = canViewPropertyFinance(property, currentUser, memberships, currentWorkspace);
  const propertyCurrency = property.currency || 'USD';

  const bookings = (data.bookings || []).filter((booking) => getPropertyId(booking) === property.id);
  const leases = (data.leases || []).filter((lease) => getPropertyId(lease) === property.id);
  const activeLease = leases.find((lease) => !inactiveLeaseStatuses.has(getLeaseStatus(lease)) && !(lease.archivedAt || lease.archived_at));
  const cleaning = allCleaning.filter((task) => getPropertyId(task) === property.id);
  const maintenance = allMaintenance.filter((workOrder) => getPropertyId(workOrder) === property.id);
  const files = (data.fileUploads || data.files || []).filter(
    (file) => getPropertyId(file) === property.id || file.property_id === property.id || file.propertyId === property.id,
  );
  const calendarImportFeeds = (data.calendarImportFeeds || []).filter((feed) => (feed.propertyId || feed.property_id) === property.id);
  const calendarImportConflicts = (data.calendarImportConflicts || []).filter((conflict) => (conflict.propertyId || conflict.property_id) === property.id && ['open', 'acknowledged'].includes(conflict.status));
  const lastCalendarImportSync = calendarImportFeeds
    .map((feed) => feed.lastSyncAt || feed.last_sync_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastCalendarImportStatus = calendarImportFeeds.find((feed) => (feed.lastSyncAt || feed.last_sync_at) === lastCalendarImportSync)?.lastSyncStatus || calendarImportFeeds.find((feed) => (feed.last_sync_at) === lastCalendarImportSync)?.last_sync_status || 'not_synced';

  const activeBookings = bookings.filter((booking) => !cancelledStatuses.has(booking.status));
  const openCleaning = cleaning.filter((task) => !closedStatuses.has(task.status));
  const openMaintenance = maintenance.filter((workOrder) => !closedStatuses.has(workOrder.status));

  const grossRevenue = activeBookings.reduce((total, booking) => total + getBookingAmount(booking), 0);
  const ownerPayout = activeBookings.reduce((total, booking) => total + getOwnerPayout(booking), 0);
  const cleaningCost = cleaning.reduce((total, task) => total + getCleaningCost(task), 0);
  const maintenanceCost = maintenance.reduce((total, workOrder) => total + getMaintenanceCost(workOrder), 0);
  const netProfit = grossRevenue - cleaningCost - maintenanceCost;

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const save = async (payload) => {
    setSaving(true);
    setMessage('');
    setSubmitError('');

    try {
      await updateProperty(property.id, payload);
      setEditing(false);
      setMessage('Property updated.');
      clearMessageSoon();
    } catch (error) {
      setSubmitError(error.message || 'Property could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!canEdit) return;

    setSaving(true);
    setMessage('');

    try {
      const shouldArchive = property.status !== 'archived';
      await archiveProperty(property.id, shouldArchive);
      setMessage(shouldArchive ? 'Property archived.' : 'Property restored.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Property archive status could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) return;

    if (!canEdit) {
      setMessage('You do not have permission to upload files for this property.');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      await uploadWorkspaceFile({
        file,
        category: file.type?.startsWith('image/') ? 'property_photo' : 'general_document',
        relatedTable: 'properties',
        relatedId: property.id,
        propertyId: property.id,
      });

      setMessage('File uploaded to private workspace storage.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };


  const submitCalendarFeed = async (event) => {
    event.preventDefault();
    if (!canManageCalendarImports) return;

    setSaving(true);
    setMessage('');

    try {
      await createCalendarImportFeed({
        propertyId: property.id,
        name: feedForm.name,
        providerType: feedForm.providerType,
        feedUrl: feedForm.feedUrl,
        status: 'active',
        importAs: 'booking_block',
      });
      setFeedForm({ name: '', providerType: 'airbnb_ical', feedUrl: '' });
      setMessage('iCal feed added. Use manual import when you are ready to pull blocks.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'iCal feed could not be added.');
    } finally {
      setSaving(false);
    }
  };

  const runCalendarImport = async (feedId) => {
    if (!canManageCalendarImports) return;
    setFeedBusyId(feedId);
    setMessage('');

    try {
      const result = await syncCalendarImportFeed(feedId);
      setMessage(`Manual import complete: ${result.eventsCreated || 0} created, ${result.eventsUpdated || 0} updated.`);
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'Manual iCal import failed.');
    } finally {
      setFeedBusyId('');
    }
  };

  const archiveCalendarFeed = async (feedId) => {
    if (!canManageCalendarImports) return;
    setFeedBusyId(feedId);
    setMessage('');

    try {
      await archiveCalendarImportFeed(feedId, true);
      setMessage('iCal feed archived. Imported event history remains preserved.');
      clearMessageSoon();
    } catch (error) {
      setMessage(error.message || 'iCal feed could not be archived.');
    } finally {
      setFeedBusyId('');
    }
  };

  const viewFile = async (file) => {
    setMessage('');
    try {
      const signedUrl = await getFileSignedUrl(file, 300);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setMessage(error.message || 'Signed file link could not be created.');
    }
  };

  return (
    <AppLayout
      title={property.name || 'Property profile'}
      subtitle={getPropertyAddress(property) || 'Property profile and operational records'}
    >
      {message && (
        <section
          className={
            message.toLowerCase().includes('failed') || message.toLowerCase().includes('could not')
              ? 'helper error-helper'
              : 'helper'
          }
          role="status"
        >
          {message}
        </section>
      )}

      <section className="card property-detail-hero">
        <div className="property-detail-hero-main">
          <div className="property-detail-icon">
            <Building2 size={26} />
          </div>

          <div>
            <p className="eyebrow">Property profile</p>
            <h2>{property.name || 'Unnamed property'}</h2>
            <p>
              <MapPin size={15} />
              {getPropertyAddress(property) || 'No address saved'}
            </p>
          </div>
        </div>

        <div className="property-detail-hero-actions">
          <StatusBadge tone={statusTone(property.status || 'active')}>{property.status || 'active'}</StatusBadge>

          {canEdit && (
            <>
              <button type="button" onClick={() => setEditing(true)} data-skip-create-action="true">
                <Edit3 size={16} />
                Edit
              </button>

              <button type="button" onClick={toggleArchive} disabled={saving} data-skip-create-action="true">
                {property.status === 'archived' ? <RotateCcw size={16} /> : <Archive size={16} />}
                {property.status === 'archived' ? 'Restore' : 'Archive'}
              </button>
            </>
          )}
        </div>
      </section>

      {!canSeeFinance && (
        <section className="card owner-dashboard-notice">
          <div className="card-header">
            <div>
              <p className="eyebrow">Property visibility</p>
              <h3>Finance details are hidden for this role</h3>
              <p>
                This view is limited to property profile and operational records relevant to your assigned work. Revenue, owner payout, net profit, cleaning cost, and maintenance cost summaries are hidden.
              </p>
            </div>
            <ShieldCheck size={22} className="muted" />
          </div>
        </section>
      )}

      <section className="stat-grid dense">
        {canSeeFinance && (
          <>
            <StatCard label="Gross revenue" value={formatCurrency(grossRevenue, propertyCurrency)} icon={DollarSign} />
            <StatCard label="Net profit" value={formatCurrency(netProfit, propertyCurrency)} icon={DollarSign} />
          </>
        )}
        <StatCard label="Open cleaning" value={openCleaning.length} icon={ClipboardCheck} />
        <StatCard label="Open maintenance" value={openMaintenance.length} icon={Wrench} tone={openMaintenance.length ? 'warning' : 'accent'} />
      </section>

      {canManageDirectBooking && (
        <section className="card property-direct-booking-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Direct booking</p>
              <h3>{directBookingPage ? 'Public booking page configured' : 'Set up public booking requests'}</h3>
              <p>
                {directBookingPage
                  ? 'Share the public page for manual booking requests. Requests do not become internal bookings until reviewed and converted.'
                  : 'Create a direct booking page so guests can send manual requests without exposing private files or owner financial data.'}
              </p>
            </div>
            <Globe2 size={20} className="muted" />
          </div>

          {!directBookingAccess.allowed ? (
            <div className="helper warning-helper">
              Existing direct booking data is preserved, but creating or publishing pages is locked on {workspacePlan.label}. {directBookingAccess.message || getUpgradeMessage(FEATURE_KEYS.DIRECT_BOOKING_PAGES, workspacePlan.key)}
            </div>
          ) : directBookingPage ? (
            <div className="property-direct-booking-actions">
              <StatusBadge>{directBookingPage.status}</StatusBadge>
              <code>{directBookingUrl}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(directBookingUrl)} data-skip-create-action="true">
                Copy link
              </button>
              <button type="button" onClick={() => window.open(directBookingUrl, '_blank', 'noopener,noreferrer')} data-skip-create-action="true">
                Open public page
              </button>
              <button type="button" className="primary" onClick={() => navigate('/direct-bookings')} data-skip-create-action="true">
                Manage
              </button>
            </div>
          ) : (
            <button type="button" className="primary" onClick={() => navigate('/direct-bookings')} data-skip-create-action="true">
              Set up direct booking page
            </button>
          )}
        </section>
      )}


      {canManageCalendarImports && (
        <section className="card property-direct-booking-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Calendar imports</p>
              <h3>{calendarImportFeeds.length ? 'iCal imports configured' : 'Add external iCal blocks'}</h3>
              <p>Import feeds are scoped to this property. Feed URLs stay restricted to workspace managers and are not shown to owners, cleaners, maintenance, or public guests.</p>
            </div>
            <DownloadCloud size={20} className="muted" />
          </div>

          <div className="property-detail-finance-grid">
            <span><strong>{calendarImportFeeds.filter((feed) => feed.status === 'active').length}</strong><small>Active feeds</small></span>
            <span><strong>{lastCalendarImportStatus.replaceAll('_', ' ')}</strong><small>Last sync status</small></span>
            <span><strong>{calendarImportConflicts.length}</strong><small>Open conflicts</small></span>
          </div>

          <form className="property-ical-form" onSubmit={submitCalendarFeed}>
            <label>
              Feed name
              <input
                value={feedForm.name}
                onChange={(event) => setFeedForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Airbnb calendar"
                required
              />
            </label>
            <label>
              Provider
              <select value={feedForm.providerType} onChange={(event) => setFeedForm((current) => ({ ...current, providerType: event.target.value }))}>
                {calendarImportProviderTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="wide">
              HTTPS iCal URL
              <input
                value={feedForm.feedUrl}
                onChange={(event) => setFeedForm((current) => ({ ...current, feedUrl: event.target.value }))}
                placeholder="https://example.com/calendar.ics"
                required
              />
            </label>
            <button type="submit" className="primary" disabled={saving} data-skip-create-action="true">
              {saving ? 'Saving…' : 'Save feed'}
            </button>
          </form>

          <div className="calendar-feed-list">
            {calendarImportFeeds.length ? calendarImportFeeds.map((feed) => (
              <article key={feed.id} className="calendar-feed-row">
                <div>
                  <strong>{feed.name}</strong>
                  <small>{formatLabel(feed.providerType || feed.provider_type)} · Last sync: {feed.lastSyncAt || feed.last_sync_at ? formatDate(feed.lastSyncAt || feed.last_sync_at) : 'Not synced yet'}</small>
                  {(feed.lastError || feed.last_error) && <small className="error-text">{feed.lastError || feed.last_error}</small>}
                </div>
                <StatusBadge tone={statusTone(feed.lastSyncStatus || feed.last_sync_status || feed.status)}>{feed.lastSyncStatus || feed.last_sync_status || feed.status}</StatusBadge>
                <button type="button" onClick={() => runCalendarImport(feed.id)} disabled={feedBusyId === feed.id} data-skip-create-action="true">
                  {feedBusyId === feed.id ? 'Importing…' : 'Manual import'}
                </button>
                <button type="button" onClick={() => archiveCalendarFeed(feed.id)} disabled={feedBusyId === feed.id} data-skip-create-action="true">
                  Archive
                </button>
              </article>
            )) : (
              <p className="helper">No external feeds yet. Save an HTTPS iCal feed to enable manual imports for this property.</p>
            )}
          </div>

          <div className="property-direct-booking-actions">
            <button type="button" onClick={() => navigate('/calendar-imports')} data-skip-create-action="true">
              Open full import center
            </button>
          </div>
        </section>
      )}

      <section className="property-detail-grid">
        <section className="card property-detail-summary-card">
          <div className="card-header">
            <div>
              <h3>Property details</h3>
              <p>Core profile information used across bookings, reporting, cleaning, and maintenance.</p>
            </div>
            <Home size={20} className="muted" />
          </div>

          <div className="property-detail-metadata">
            <span>
              <Building2 size={16} />
              <strong>{formatLabel(getPropertyType(property))}</strong>
              <small>Property type</small>
            </span>

            <span>
              <CalendarCheck size={16} />
              <strong>{formatLabel(getRentalType(property))}</strong>
              <small>Rental type</small>
            </span>

            {canSeeFinance && (
              <span>
                <DollarSign size={16} />
                <strong>{getPropertyRate(property)}</strong>
                <small>Rate</small>
              </span>
            )}

            <span>
              <BedDouble size={16} />
              <strong>{property.bedrooms ?? '—'}</strong>
              <small>Bedrooms</small>
            </span>

            <span>
              <Bath size={16} />
              <strong>{property.bathrooms ?? '—'}</strong>
              <small>Bathrooms</small>
            </span>

            <span>
              <Home size={16} />
              <strong>{getSquareFeet(property) || '—'}</strong>
              <small>Square feet</small>
            </span>

            {canSeeFinance && (
              <span>
                <DollarSign size={16} />
                <strong>{propertyCurrency}</strong>
                <small>Currency</small>
              </span>
            )}

            <span>
              <UsersPlaceholder />
              <strong>{getOwnerName(property, data.contacts || [], data.members || [])}</strong>
              <small>Assigned owner</small>
            </span>
          </div>

          {property.notes && (
            <div className="property-detail-notes">
              <strong>Notes</strong>
              <p>{property.notes}</p>
            </div>
          )}
        </section>

        {canSeeFinance && (
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Financial snapshot</h3>
                <p>Revenue, owner payout, expenses, and profitability for this property.</p>
              </div>
              <DollarSign size={20} className="muted" />
            </div>

            <div className="property-detail-finance-grid">
              <span>
                <strong>{formatCurrency(grossRevenue, propertyCurrency)}</strong>
                <small>Gross revenue</small>
              </span>

              <span>
                <strong>{formatCurrency(ownerPayout, propertyCurrency)}</strong>
                <small>Owner payout</small>
              </span>

              <span>
                <strong>{formatCurrency(cleaningCost, propertyCurrency)}</strong>
                <small>Cleaning cost</small>
              </span>

              <span>
                <strong>{formatCurrency(maintenanceCost, propertyCurrency)}</strong>
                <small>Maintenance cost</small>
              </span>

              <span>
                <strong>{formatCurrency(netProfit, propertyCurrency)}</strong>
                <small>Net profit</small>
              </span>

              <span>
                <strong>{activeBookings.length}</strong>
                <small>Active bookings</small>
              </span>
            </div>
          </section>
        )}
      </section>

      <section className="property-detail-actions-grid">
        {canCreateOperationalRecords && (
          <>
            <button type="button" data-create-action="booking">
              <CalendarCheck size={16} />
              Add Booking
            </button>

            <button type="button" data-create-action="cleaning">
              <ClipboardCheck size={16} />
              Add Cleaning Task
            </button>

            <button type="button" data-create-action="maintenance">
              <Wrench size={16} />
              Add Work Order
            </button>
          </>
        )}

        <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
          <Eye size={16} />
          View Calendar
        </button>

        {canEdit && (
          <label className="upload-button property-detail-upload">
            <FileUp size={16} />
            {uploading ? 'Uploading…' : 'Upload File'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx"
              disabled={uploading}
              onChange={uploadFile}
            />
          </label>
        )}
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Bookings</h3>
              <p>Reservation and lease records linked to this property.</p>
            </div>
            <CalendarCheck size={20} className="muted" />
          </div>

          <DataTable
            rows={bookings.slice(0, 8)}
            empty="No bookings linked to this property."
            columns={[
              {
                key: 'guest',
                label: 'Guest',
                render: (row) => row.guestName || row.guest_name || row.tenantName || row.tenant_name || 'Guest',
              },
              {
                key: 'dates',
                label: 'Dates',
                render: (row) => `${formatDate(getBookingCheckIn(row))} → ${formatDate(getBookingCheckOut(row))}`,
              },
              ...(canSeeFinance
                ? [
                    {
                      key: 'amount',
                      label: 'Amount',
                      render: (row) => formatCurrency(getBookingAmount(row), row.currency || propertyCurrency),
                    },
                  ]
                : []),
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={statusTone(row.status || 'confirmed')}>{row.status || 'confirmed'}</StatusBadge>,
              },
            ]}
          />
        </section>


        <section className="card">
          <div className="card-header">
            <div>
              <h3>Long-term rental / leases</h3>
              <p>{getRentalType(property) === 'long_term' ? 'Long-term setup is recommended for this property.' : 'Manual lease tracking connected to this property.'}</p>
            </div>
            <FileText size={20} className="muted" />
          </div>

          {activeLease ? (
            <div className="list-row">
              <span>
                <strong>{activeLease.tenantName || activeLease.tenant_name || 'Tenant'}</strong>
                <small>{formatDate(getLeaseStart(activeLease))} → {formatDate(getLeaseEnd(activeLease), 'Open-ended')}</small>
              </span>
              <span className="table-actions">
                {canSeeFinance && <strong>{formatCurrency(getLeaseRent(activeLease), activeLease.currency || propertyCurrency)} / {(activeLease.rentFrequency || activeLease.rent_frequency || 'monthly').replaceAll('_', ' ')}</strong>}
                {canSeeFinance && <StatusBadge tone={statusTone(getLeasePaymentStatus(activeLease))}>{getLeasePaymentStatus(activeLease)}</StatusBadge>}
                <StatusBadge tone={statusTone(getLeaseStatus(activeLease))}>{getLeaseStatus(activeLease)}</StatusBadge>
              </span>
            </div>
          ) : (
            <EmptyState
              eyebrow="Leases"
              icon={FileText}
              title={leases.length ? 'No active lease' : 'No lease linked yet'}
              description="Lease records are manual, workspace-scoped, and do not trigger rent collection, e-signature, or legal document generation."
              action={canEdit ? <button type="button" className="primary" data-create-action="lease"><Plus size={16} /> Add Lease</button> : null}
            />
          )}

          {leases.length > 0 && (
            <div className="helper">
              {leases.length} lease record{leases.length === 1 ? '' : 's'} linked to this property. <button type="button" onClick={() => navigate('/leases')} data-skip-create-action="true">Manage leases</button>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Cleaning history</h3>
              <p>Cleaning tasks, guest-ready updates, and issue reports.</p>
            </div>
            <ClipboardCheck size={20} className="muted" />
          </div>

          <DataTable
            rows={cleaning.slice(0, 8)}
            empty="No cleaning tasks linked to this property."
            columns={[
              {
                key: 'scheduled',
                label: 'Scheduled',
                render: (row) => formatDate(getCleaningDate(row)),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={statusTone(row.status || 'scheduled')}>{row.status || 'scheduled'}</StatusBadge>,
              },
              {
                key: 'issue',
                label: 'Issue',
                render: (row) =>
                  row.issue_reported ? (
                    <StatusBadge tone="warning">reported</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">clear</StatusBadge>
                  ),
              },
              {
                key: 'notes',
                label: 'Notes',
                render: (row) => row.cleanerNotes || row.cleaner_notes || row.notes || '—',
              },
            ]}
          />
        </section>
      </section>

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Maintenance history</h3>
              <p>Work orders, repair status, priority, and permitted repair details.</p>
            </div>
            <Wrench size={20} className="muted" />
          </div>

          <DataTable
            rows={maintenance.slice(0, 8)}
            empty="No maintenance work orders linked to this property."
            columns={[
              {
                key: 'title',
                label: 'Issue',
                render: (row) => row.title || 'Maintenance issue',
              },
              {
                key: 'due',
                label: 'Due',
                render: (row) => formatDate(getMaintenanceDate(row)),
              },
              ...(canSeeFinance
                ? [
                    {
                      key: 'cost',
                      label: 'Cost',
                      render: (row) => formatCurrency(getMaintenanceCost(row), propertyCurrency),
                    },
                  ]
                : []),
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge tone={statusTone(row.status || row.priority || 'reported')}>{row.status || row.priority || 'reported'}</StatusBadge>,
              },
            ]}
          />
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Files and photos</h3>
              <p>Private property files, photos, documents, receipts, leases, and contracts.</p>
            </div>
            <FileText size={20} className="muted" />
          </div>

          <FileList
            files={files.slice(0, 10)}
            onView={viewFile}
            emptyTitle="No property files yet"
            emptyDescription="Private property photos, leases, contracts, receipts, and documents will appear here after upload."
          />
        </section>
      </section>

      {editing && (
        <PropertyEditModal
          property={property}
          onSubmit={save}
          onCancel={() => {
            if (!saving) {
              setEditing(false);
              setSubmitError('');
            }
          }}
          submitting={saving}
          submitError={submitError}
        />
      )}
    </AppLayout>
  );
}

function UsersPlaceholder() {
  return <Building2 size={16} />;
}
