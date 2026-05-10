import React from 'react';
import {
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  Home,
  Plus,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { currencies, roles, taskManagerRoles } from '../data/constants.js';
import { formatCurrency, formatDate, formatPercent } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';

const bookingSources = ['manual', 'direct', 'airbnb', 'booking_com', 'vrbo', 'ical', 'csv', 'other'];
const bookingStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'];
const paymentStatuses = ['unpaid', 'partially_paid', 'paid', 'refunded', 'failed'];
const leaseStatuses = ['active', 'ending_soon', 'expired', 'terminated', 'cancelled'];
const rentStatuses = ['current', 'overdue', 'partially_paid', 'paid_ahead', 'unknown'];

const today = () => new Date().toISOString().slice(0, 10);

const inDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const emptyBooking = {
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  property_id: '',
  check_in: today(),
  check_out: inDays(1),
  guest_count: 1,
  source: 'manual',
  status: 'confirmed',
  payment_status: 'unpaid',
  currency: '',
  total_amount: '',
  cleaning_fee: '',
  taxes_fees: '',
  owner_payout: '',
  notes: '',
  auto_create_cleaning: true,
};

const emptyLease = {
  tenant_name: '',
  tenant_email: '',
  tenant_phone: '',
  property_id: '',
  lease_start: today(),
  lease_end: '',
  monthly_rent: '',
  security_deposit: '',
  rent_payment_status: 'unknown',
  lease_status: 'active',
  currency: '',
  lease_document_file_id: '',
  notes: '',
};

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') return null;

  const numericValue = Number(cleanValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function activeWorkspaceRoles(memberships = [], currentWorkspace = null) {
  const activeMembership = memberships.find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status !== 'revoked',
  );

  return activeMembership?.roles || [];
}

function hasWorkspaceRole(roleList, allowedRoles) {
  return allowedRoles.some((role) => roleList.includes(role));
}

function isAllowedValue(value, allowedValues) {
  return allowedValues.includes(value);
}

function normalizeLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function hasDateOrderError(start, end) {
  return Boolean(start && end && end <= start);
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyName(record, properties = []) {
  const propertyId = getPropertyId(record);
  const property = properties.find((item) => item.id === propertyId);

  return record?.property || property?.name || 'Unassigned property';
}

function propertyCurrency(properties, workspace, propertyId) {
  return (
    properties.find((property) => property.id === propertyId)?.currency ||
    workspace?.defaultCurrency ||
    workspace?.default_currency ||
    'USD'
  );
}

function bookingAmount(booking) {
  return toNumber(booking.total_amount ?? booking.totalAmount);
}

function leaseMonthlyRent(lease) {
  return toNumber(lease.monthly_rent ?? lease.monthlyRent);
}

function isActiveBooking(booking) {
  return !['cancelled', 'refunded', 'void'].includes(String(booking.status || '').toLowerCase());
}

function isUpcomingBooking(booking) {
  const checkIn = dateOnly(booking.check_in || booking.checkIn);
  return Boolean(checkIn && checkIn >= today() && isActiveBooking(booking));
}

function isCurrentLease(lease) {
  const now = today();
  const start = dateOnly(lease.lease_start || lease.leaseStart);
  const end = dateOnly(lease.lease_end || lease.leaseEnd);
  const status = String(lease.lease_status || lease.leaseStatus || '').toLowerCase();

  return ['active', 'ending_soon'].includes(status) && start <= now && (!end || end >= now);
}

function withinRange(row, startKey, endKey, filters) {
  const startValue = dateOnly(row[startKey]);
  const endValue = dateOnly(row[endKey]);

  if (filters.start && endValue && endValue < filters.start) return false;
  if (filters.end && startValue && startValue > filters.end) return false;

  return true;
}

function matchesQuery(values, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;

  return values.filter(Boolean).join(' ').toLowerCase().includes(q);
}

function toBookingForm(row, properties = [], workspace = null) {
  const propertyId = row?.property_id || row?.propertyId || properties[0]?.id || '';

  return row
    ? {
        guest_name: row.guest_name || row.guestName || '',
        guest_email: row.guest_email || row.guestEmail || '',
        guest_phone: row.guest_phone || row.guestPhone || '',
        property_id: propertyId,
        check_in: dateOnly(row.check_in || row.checkIn),
        check_out: dateOnly(row.check_out || row.checkOut),
        guest_count: row.guest_count || row.guestCount || 1,
        source: row.source || 'manual',
        status: row.status || 'confirmed',
        payment_status: row.payment_status || row.paymentStatus || 'unpaid',
        currency: row.currency || propertyCurrency(properties, workspace, propertyId),
        total_amount: row.total_amount ?? row.totalAmount ?? '',
        cleaning_fee: row.cleaning_fee ?? row.cleaningFee ?? '',
        taxes_fees: row.taxes_fees ?? row.taxesFees ?? '',
        owner_payout: row.owner_payout ?? row.ownerPayout ?? '',
        notes: row.notes || '',
        auto_create_cleaning: row.auto_create_cleaning ?? row.autoCreateCleaning ?? true,
      }
    : {
        ...emptyBooking,
        property_id: propertyId,
        currency: propertyCurrency(properties, workspace, propertyId),
      };
}

function toLeaseForm(row, properties = [], workspace = null) {
  const propertyId = row?.property_id || row?.propertyId || properties[0]?.id || '';

  return row
    ? {
        tenant_name: row.tenant_name || row.tenantName || '',
        tenant_email: row.tenant_email || row.tenantEmail || '',
        tenant_phone: row.tenant_phone || row.tenantPhone || '',
        property_id: propertyId,
        lease_start: dateOnly(row.lease_start || row.leaseStart),
        lease_end: dateOnly(row.lease_end || row.leaseEnd),
        monthly_rent: row.monthly_rent ?? row.monthlyRent ?? '',
        security_deposit: row.security_deposit ?? row.securityDeposit ?? '',
        rent_payment_status: row.rent_payment_status || row.rentPaymentStatus || 'unknown',
        lease_status: row.lease_status || row.leaseStatus || 'active',
        currency: row.currency || propertyCurrency(properties, workspace, propertyId),
        lease_document_file_id: row.lease_document_file_id || row.leaseDocumentFileId || '',
        notes: row.notes || '',
      }
    : {
        ...emptyLease,
        property_id: propertyId,
        currency: propertyCurrency(properties, workspace, propertyId),
      };
}

function cleanBookingPayload(form) {
  return {
    property_id: form.property_id,
    guest_name: form.guest_name.trim(),
    guest_email: form.guest_email.trim() || null,
    guest_phone: form.guest_phone.trim() || null,
    check_in: form.check_in,
    check_out: form.check_out,
    guest_count: Number(form.guest_count || 1),
    source: form.source,
    status: form.status,
    payment_status: form.payment_status,
    currency: form.currency,
    total_amount: cleanNumber(form.total_amount),
    cleaning_fee: cleanNumber(form.cleaning_fee),
    taxes_fees: cleanNumber(form.taxes_fees),
    owner_payout: cleanNumber(form.owner_payout),
    notes: form.notes.trim() || null,
    auto_create_cleaning: Boolean(form.auto_create_cleaning),
  };
}

function cleanLeasePayload(form) {
  return {
    ...form,
    tenant_name: form.tenant_name.trim(),
    tenant_email: form.tenant_email.trim() || null,
    tenant_phone: form.tenant_phone.trim() || null,
    lease_end: form.lease_end || null,
    monthly_rent: cleanNumber(form.monthly_rent),
    security_deposit: cleanNumber(form.security_deposit),
    lease_document_file_id: form.lease_document_file_id || null,
    notes: form.notes.trim() || null,
  };
}

function formatSubmitError(error, fallback) {
  const message = error?.message || fallback;
  return /Cannot read properties|undefined|null/i.test(message) ? fallback : message;
}

function ModalShell({ title, description, children, onClose, submitting }) {
  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, submitting]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="booking-lease-modal-title">
        <header className="modal-header">
          <div>
            <h3 id="booking-lease-modal-title">{title}</h3>
            <p>{description}</p>
          </div>

          <button
            type="button"
            className="icon-btn"
            aria-label="Close modal"
            onClick={onClose}
            disabled={submitting}
            data-skip-create-action="true"
          >
            <X size={18} />
          </button>
        </header>

        {children}
      </section>
    </div>
  );
}

function ErrorList({ errors }) {
  if (!errors.length) return null;

  return (
    <div className="modal-error" role="alert">
      <strong>Please fix the following before saving:</strong>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function SelectOptions({ options }) {
  return options.map((item) => (
    <option key={item} value={item}>
      {normalizeLabel(item)}
    </option>
  ));
}

function BookingForm({
  initial,
  properties,
  workspace,
  session,
  onSubmit,
  onCancel,
  submitting,
  submitError,
}) {
  const [form, setForm] = React.useState(() => toBookingForm(initial, properties, workspace));
  const [validationErrors, setValidationErrors] = React.useState([]);

  React.useEffect(() => {
    setForm(toBookingForm(initial, properties, workspace));
    setValidationErrors([]);
  }, [initial?.id, properties, workspace]);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'property_id') {
        next.currency = propertyCurrency(properties, workspace, value);
      }

      return next;
    });
  };

  const validate = () => {
    const errors = [];

    if (!workspace?.id) errors.push('No workspace selected. Select or create a workspace before saving bookings.');
    if (!session?.user?.id) errors.push('Your session expired. Sign in again before saving bookings.');
    if (!properties.length) errors.push('Add a property before creating a booking.');
    if (properties.length && !form.property_id) errors.push('Select a property before saving.');
    if (!normalizeText(form.guest_name)) errors.push('Guest name is required.');
    if (!form.check_in) errors.push('Check-in date is required.');
    if (!form.check_out) errors.push('Check-out date is required.');
    if (hasDateOrderError(form.check_in, form.check_out)) errors.push('Check-out must be after check-in.');
    if (!form.source) errors.push('Booking source is required.');
    if (!form.status) errors.push('Booking status is required.');
    if (!form.payment_status) errors.push('Payment status is required.');
    if (!form.currency) errors.push('Currency is required.');
    if (form.property_id && !properties.some((property) => property.id === form.property_id)) {
      errors.push('Select an existing property in this workspace.');
    }
    if (form.source && !isAllowedValue(form.source, bookingSources)) errors.push('Select a valid booking source.');
    if (form.status && !isAllowedValue(form.status, bookingStatuses)) errors.push('Select a valid booking status.');
    if (form.payment_status && !isAllowedValue(form.payment_status, paymentStatuses)) errors.push('Select a valid payment status.');
    if (form.currency && !currencies.includes(form.currency)) errors.push('Select a valid currency.');

    const guestCount = Number(form.guest_count || 1);
    if (!Number.isInteger(guestCount) || guestCount < 1) errors.push('Guest count must be at least 1.');

    const invalidAmount = [
      ['total_amount', 'Total amount'],
      ['cleaning_fee', 'Cleaning fee'],
      ['taxes_fees', 'Taxes / fees'],
      ['owner_payout', 'Owner payout'],
    ].find(([key]) => form[key] !== '' && (cleanNumber(form[key]) === null || cleanNumber(form[key]) < 0));

    if (invalidAmount) errors.push(`${invalidAmount[1]} must be 0 or more.`);

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const errors = validate();
    setValidationErrors(errors);

    if (errors.length) return;

    await onSubmit(cleanBookingPayload(form));
  };

  return (
    <ModalShell
      title={initial ? 'Edit booking' : 'Add short-term booking'}
      description="Create or update the guest contact, reservation details, payment status, and optional checkout cleaning task."
      onClose={onCancel}
      submitting={submitting}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          <ErrorList errors={validationErrors} />

          {submitError && (
            <div className="modal-error" role="alert">
              {submitError}
            </div>
          )}

          {!properties.length && (
            <div className="modal-warning" role="status">
              Add a property before creating bookings.
            </div>
          )}

          <div className="form-grid">
            <label>
              Guest name
              <input required value={form.guest_name} onChange={set('guest_name')} />
            </label>

            <label>
              Guest email
              <input type="email" value={form.guest_email} onChange={set('guest_email')} />
            </label>

            <label>
              Guest phone
              <input value={form.guest_phone} onChange={set('guest_phone')} />
            </label>

            <label>
              Property
              <select required value={form.property_id} onChange={set('property_id')}>
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Check in
              <input type="date" required value={form.check_in} onChange={set('check_in')} />
            </label>

            <label>
              Check out
              <input type="date" required value={form.check_out} onChange={set('check_out')} />
            </label>

            <label>
              Guest count
              <input type="number" min="1" value={form.guest_count} onChange={set('guest_count')} />
            </label>

            <label>
              Source
              <select required value={form.source} onChange={set('source')}>
                <SelectOptions options={bookingSources} />
              </select>
            </label>

            <label>
              Status
              <select required value={form.status} onChange={set('status')}>
                <SelectOptions options={bookingStatuses} />
              </select>
            </label>

            <label>
              Payment status
              <select required value={form.payment_status} onChange={set('payment_status')}>
                <SelectOptions options={paymentStatuses} />
              </select>
            </label>

            <label>
              Currency
              <select required value={form.currency} onChange={set('currency')}>
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Total amount
              <input type="text" inputMode="decimal" value={form.total_amount} onChange={set('total_amount')} />
            </label>

            <label>
              Cleaning fee
              <input type="text" inputMode="decimal" value={form.cleaning_fee} onChange={set('cleaning_fee')} />
            </label>

            <label>
              Taxes / fees
              <input type="text" inputMode="decimal" value={form.taxes_fees} onChange={set('taxes_fees')} />
            </label>

            <label>
              Owner payout
              <input type="text" inputMode="decimal" value={form.owner_payout} onChange={set('owner_payout')} />
            </label>

            <label className="inline-check full">
              <input type="checkbox" checked={form.auto_create_cleaning} onChange={set('auto_create_cleaning')} />
              Auto-create checkout cleaning task
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

          <button type="submit" className="primary" disabled={submitting} data-skip-create-action="true">
            {submitting ? 'Saving…' : 'Save Booking'}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}

function LeaseForm({
  initial,
  properties,
  workspace,
  onSubmit,
  onCancel,
  submitting,
  submitError,
}) {
  const [form, setForm] = React.useState(() => toLeaseForm(initial, properties, workspace));
  const [validationErrors, setValidationErrors] = React.useState([]);

  React.useEffect(() => {
    setForm(toLeaseForm(initial, properties, workspace));
    setValidationErrors([]);
  }, [initial?.id, properties, workspace]);

  const set = (key) => (event) => {
    const value = event.target.value;

    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'property_id') {
        next.currency = propertyCurrency(properties, workspace, value);
      }

      return next;
    });
  };

  const validate = () => {
    const errors = [];

    if (!workspace?.id) errors.push('No workspace selected. Select or create a workspace before saving leases.');
    if (!properties.length) errors.push('Add a property before creating a lease.');
    if (properties.length && !form.property_id) errors.push('Select a property before saving.');
    if (!normalizeText(form.tenant_name)) errors.push('Tenant name is required.');
    if (!form.lease_start) errors.push('Lease start date is required.');
    if (hasDateOrderError(form.lease_start, form.lease_end)) errors.push('Lease end must be after lease start.');
    if (!form.lease_status) errors.push('Lease status is required.');
    if (!form.rent_payment_status) errors.push('Rent payment status is required.');
    if (!form.currency) errors.push('Currency is required.');

    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const errors = validate();
    setValidationErrors(errors);

    if (errors.length) return;

    await onSubmit(cleanLeasePayload(form));
  };

  return (
    <ModalShell
      title={initial ? 'Edit lease' : 'Add long-term lease'}
      description="Create or update a tenant lease linked to a property in this workspace."
      onClose={onCancel}
      submitting={submitting}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <div className="modal-body">
          <ErrorList errors={validationErrors} />

          {submitError && (
            <div className="modal-error" role="alert">
              {submitError}
            </div>
          )}

          {!properties.length && (
            <div className="modal-warning" role="status">
              Add a property before creating leases.
            </div>
          )}

          <div className="form-grid">
            <label>
              Tenant name
              <input required value={form.tenant_name} onChange={set('tenant_name')} />
            </label>

            <label>
              Tenant email
              <input type="email" value={form.tenant_email} onChange={set('tenant_email')} />
            </label>

            <label>
              Tenant phone
              <input value={form.tenant_phone} onChange={set('tenant_phone')} />
            </label>

            <label>
              Property
              <select required value={form.property_id} onChange={set('property_id')}>
                <option value="">Select property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Lease start
              <input type="date" required value={form.lease_start} onChange={set('lease_start')} />
            </label>

            <label>
              Lease end
              <input type="date" value={form.lease_end} onChange={set('lease_end')} />
            </label>

            <label>
              Monthly rent
              <input type="number" min="0" step="0.01" value={form.monthly_rent} onChange={set('monthly_rent')} />
            </label>

            <label>
              Security deposit
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.security_deposit}
                onChange={set('security_deposit')}
              />
            </label>

            <label>
              Lease status
              <select required value={form.lease_status} onChange={set('lease_status')}>
                <SelectOptions options={leaseStatuses} />
              </select>
            </label>

            <label>
              Rent payment status
              <select required value={form.rent_payment_status} onChange={set('rent_payment_status')}>
                <SelectOptions options={rentStatuses} />
              </select>
            </label>

            <label>
              Currency
              <select required value={form.currency} onChange={set('currency')}>
                {currencies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
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

          <button type="submit" className="primary" disabled={submitting} data-skip-create-action="true">
            {submitting ? 'Saving…' : 'Save Lease'}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}

export function BookingsPage() {
  const {
    data,
    session,
    memberships,
    currentWorkspace,
    createBooking,
    updateBooking,
    createLease,
    updateLease,
  } = useApp();

  const properties = data.properties || [];
  const bookings = data.bookings || [];
  const leases = data.leases || [];
  const cleaningTasks = data.cleaningTasks || [];

  const workspaceRoles = activeWorkspaceRoles(memberships, currentWorkspace);
  const canManage = hasWorkspaceRole(workspaceRoles, taskManagerRoles);
  const canViewBookingTotals = hasWorkspaceRole(workspaceRoles, [
    roles.OWNER_ADMIN,
    roles.PROPERTY_MANAGER,
    roles.HOST,
    roles.ACCOUNTANT,
  ]);
  const canViewDetailedFinancials = hasWorkspaceRole(workspaceRoles, [
    roles.OWNER_ADMIN,
    roles.PROPERTY_MANAGER,
    roles.ACCOUNTANT,
  ]);
  const canViewOwnerPayout = hasWorkspaceRole(workspaceRoles, [
    roles.OWNER_ADMIN,
    roles.PROPERTY_MANAGER,
    roles.ACCOUNTANT,
    roles.OWNER,
  ]);
  const workspaceCurrency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';

  const [activeTab, setActiveTab] = React.useState('bookings');
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState({
    propertyId: 'all',
    status: 'all',
    paymentStatus: 'all',
    start: '',
    end: '',
  });
  const [editingBooking, setEditingBooking] = React.useState(null);
  const [editingLease, setEditingLease] = React.useState(null);
  const [creatingLease, setCreatingLease] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const activeBookings = bookings.filter(isActiveBooking);
  const upcomingBookings = bookings.filter(isUpcomingBooking);
  const currentLeases = leases.filter(isCurrentLease);
  const bookingRevenue = activeBookings.reduce((total, booking) => total + bookingAmount(booking), 0);
  const monthlyLeaseRevenue = currentLeases.reduce((total, lease) => total + leaseMonthlyRent(lease), 0);
  const paidBookings = bookings.filter((booking) => booking.payment_status === 'paid' || booking.paymentStatus === 'paid');
  const paidRate = bookings.length ? (paidBookings.length / bookings.length) * 100 : 0;

  const propertyStatusRows = properties.map((property) => ({
    ...property,
    derivedStatus: derivedPropertyStatus(property, bookings, leases, cleaningTasks),
  }));

  const filteredBookings = bookings
    .filter((booking) => filters.propertyId === 'all' || getPropertyId(booking) === filters.propertyId)
    .filter((booking) => filters.status === 'all' || booking.status === filters.status)
    .filter((booking) => filters.paymentStatus === 'all' || booking.payment_status === filters.paymentStatus)
    .filter((booking) => withinRange(booking, 'check_in', 'check_out', filters))
    .filter((booking) =>
      matchesQuery(
        [
          booking.guest_name,
          booking.guestName,
          booking.guest_email,
          booking.guestEmail,
          booking.guest_phone,
          booking.guestPhone,
          getPropertyName(booking, properties),
          booking.source,
          booking.status,
          booking.payment_status,
        ],
        query,
      ),
    );

  const filteredLeases = leases
    .filter((lease) => filters.propertyId === 'all' || getPropertyId(lease) === filters.propertyId)
    .filter((lease) => filters.status === 'all' || lease.lease_status === filters.status)
    .filter((lease) => filters.paymentStatus === 'all' || lease.rent_payment_status === filters.paymentStatus)
    .filter((lease) => withinRange(lease, 'lease_start', 'lease_end', filters))
    .filter((lease) =>
      matchesQuery(
        [
          lease.tenant_name,
          lease.tenantName,
          lease.tenant_email,
          lease.tenantEmail,
          lease.tenant_phone,
          lease.tenantPhone,
          getPropertyName(lease, properties),
          lease.lease_status,
          lease.rent_payment_status,
        ],
        query,
      ),
    );

  const closeModal = () => {
    if (submitting) return;

    setEditingBooking(null);
    setEditingLease(null);
    setCreatingLease(false);
    setSubmitError('');
  };

  const clearMessageSoon = () => {
    window.setTimeout(() => setMessage(''), 3000);
  };

  const saveBooking = async (payload) => {
    setSubmitting(true);
    setSubmitError('');

    try {
      if (editingBooking?.id) {
        await updateBooking(editingBooking.id, payload);
        setMessage('Booking updated.');
      } else {
        await createBooking(payload);
        setMessage('Booking created.');
      }

      clearMessageSoon();
      closeModal();
    } catch (error) {
      setSubmitError(formatSubmitError(error, 'Booking could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  };

  const saveLease = async (payload) => {
    setSubmitting(true);
    setSubmitError('');

    try {
      if (editingLease?.id) {
        await updateLease(editingLease.id, payload);
        setMessage('Lease updated.');
      } else {
        await createLease(payload);
        setMessage('Lease created.');
      }

      clearMessageSoon();
      closeModal();
    } catch (error) {
      setSubmitError(formatSubmitError(error, 'Lease could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  };

  const setFilter = (key) => (event) => {
    setFilters((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const resetFilters = () => {
    setQuery('');
    setFilters({
      propertyId: 'all',
      status: 'all',
      paymentStatus: 'all',
      start: '',
      end: '',
    });
  };

  const hasRecords = bookings.length || leases.length;
  const bookingColumns = [
    {
      key: 'guest',
      label: 'Guest',
      render: (booking) => (
        <span>
          <strong>{booking.guest_name || booking.guestName || 'Guest'}</strong>
          <small>{booking.guest_email || booking.guestEmail || booking.guest_phone || booking.guestPhone || 'No contact'}</small>
        </span>
      ),
    },
    {
      key: 'property',
      label: 'Property',
      render: (booking) => getPropertyName(booking, properties),
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (booking) => `${formatDate(booking.check_in || booking.checkIn)} → ${formatDate(booking.check_out || booking.checkOut)}`,
    },
    {
      key: 'source',
      label: 'Source',
      render: (booking) => normalizeLabel(booking.source),
    },
    {
      key: 'status',
      label: 'Status',
      render: (booking) => <StatusBadge>{booking.status || 'confirmed'}</StatusBadge>,
    },
    {
      key: 'payment',
      label: 'Payment',
      render: (booking) => <StatusBadge>{booking.payment_status || booking.paymentStatus || 'unpaid'}</StatusBadge>,
    },
    canViewBookingTotals
      ? {
          key: 'amount',
          label: 'Amount',
          render: (booking) => formatCurrency(bookingAmount(booking), booking.currency || workspaceCurrency),
        }
      : null,
    canViewOwnerPayout
      ? {
          key: 'owner_payout',
          label: 'Owner payout',
          render: (booking) => formatCurrency(toNumber(booking.owner_payout ?? booking.ownerPayout), booking.currency || workspaceCurrency),
        }
      : null,
    canViewDetailedFinancials
      ? {
          key: 'fees',
          label: 'Fees',
          render: (booking) => {
            const cleaningFee = toNumber(booking.cleaning_fee ?? booking.cleaningFee);
            const taxesFees = toNumber(booking.taxes_fees ?? booking.taxesFees);
            return formatCurrency(cleaningFee + taxesFees, booking.currency || workspaceCurrency);
          },
        }
      : null,
    {
      key: 'actions',
      label: 'Actions',
      render: (booking) => (
        <div className="action-row">
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setSubmitError('');
                setEditingBooking(booking);
              }}
              data-skip-create-action="true"
            >
              <Edit3 size={16} />
              Edit
            </button>
          )}

          <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
            <Eye size={16} />
            Calendar
          </button>
        </div>
      ),
    },
  ].filter(Boolean);

  return (
    <AppLayout
      title="Bookings"
      subtitle="Manage short-term reservations, long-term leases, guest details, payment status, and booking operations."
    >
      {message && (
        <section className="helper" role="status">
          {message}
        </section>
      )}

      <section className="stat-grid">
        <StatCard
          label="Active bookings"
          value={activeBookings.length}
          subtitle={`${upcomingBookings.length} upcoming arrivals`}
          icon={CalendarCheck}
        />

        <StatCard
          label="Booking revenue"
          value={canViewBookingTotals ? formatCurrency(bookingRevenue, workspaceCurrency) : 'Restricted'}
          subtitle={canViewBookingTotals ? 'From active short-term bookings' : 'Financial totals are limited by workspace role'}
          icon={DollarSign}
        />

        <StatCard
          label="Current leases"
          value={currentLeases.length}
          subtitle={`${formatCurrency(monthlyLeaseRevenue, workspaceCurrency)} monthly rent`}
          icon={Home}
        />

        <StatCard
          label="Paid rate"
          value={canViewBookingTotals ? formatPercent(paidRate) : 'Restricted'}
          subtitle={canViewBookingTotals ? `${paidBookings.length} of ${bookings.length} bookings paid` : 'Payment visibility is role-limited'}
          icon={CheckCircle2}
        />
      </section>

      <section className="card bookings-toolbar">
        <div>
          <h3>Booking operations</h3>
          <p>Track reservations, leases, occupancy status, payment status, and guest/tenant records.</p>
        </div>

        <div className="bookings-toolbar-actions">
          {canManage && (
            <button type="button" className="primary" data-create-action="booking">
              <Plus size={16} />
              Add Booking
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setSubmitError('');
                setCreatingLease(true);
              }}
              data-skip-create-action="true"
            >
              <FileText size={16} />
              Add Lease
            </button>
          )}

          <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
            View Calendar
          </button>
        </div>
      </section>

      <section className="card">
        <div className="tabs bookings-tabs">
          <button
            type="button"
            className={activeTab === 'bookings' ? 'active' : ''}
            onClick={() => {
              setActiveTab('bookings');
              setFilters((current) => ({ ...current, status: 'all', paymentStatus: 'all' }));
            }}
            data-skip-create-action="true"
          >
            Short-term bookings
          </button>

          <button
            type="button"
            className={activeTab === 'leases' ? 'active' : ''}
            onClick={() => {
              setActiveTab('leases');
              setFilters((current) => ({ ...current, status: 'all', paymentStatus: 'all' }));
            }}
            data-skip-create-action="true"
          >
            Long-term leases
          </button>

          <button
            type="button"
            className={activeTab === 'property-status' ? 'active' : ''}
            onClick={() => setActiveTab('property-status')}
            data-skip-create-action="true"
          >
            Property status
          </button>
        </div>

        <div className="bookings-filters">
          <label className="bookings-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guest, tenant, property, status, source, or payment..."
              aria-label="Search bookings and leases"
            />

            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Property
            <select value={filters.propertyId} onChange={setFilter('propertyId')}>
              <option value="all">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="all">All statuses</option>
              {(activeTab === 'leases' ? leaseStatuses : bookingStatuses).map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {normalizeLabel(statusOption)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment
            <select value={filters.paymentStatus} onChange={setFilter('paymentStatus')}>
              <option value="all">All payments</option>
              {(activeTab === 'leases' ? rentStatuses : paymentStatuses).map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {normalizeLabel(statusOption)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Start
            <input type="date" value={filters.start} onChange={setFilter('start')} />
          </label>

          <label>
            End
            <input type="date" value={filters.end} onChange={setFilter('end')} />
          </label>
        </div>
      </section>

      {!hasRecords && activeTab !== 'property-status' && (
        <EmptyState
          eyebrow="Bookings"
          icon={CalendarPlus}
          title={properties.length ? 'Add your first booking or lease' : 'Add a property before creating bookings'}
          description={
            properties.length
              ? 'Use bookings for short-term reservations and leases for long-term rental tenants. Records are workspace-scoped and connected to properties.'
              : 'Bookings must be tied to a real property in the selected workspace. Add a property first, then return here to create the reservation.'
          }
          action={
            canManage ? (
              <button type="button" className="primary" data-create-action="booking">
                <Plus size={16} />
                Add Booking
              </button>
            ) : null
          }
          secondaryAction={
            canManage ? (
              <button
                type="button"
                onClick={() => setCreatingLease(true)}
                data-skip-create-action="true"
              >
                Add Lease
              </button>
            ) : null
          }
        />
      )}

      {activeTab === 'bookings' && hasRecords && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Short-term bookings</h3>
              <p>{filteredBookings.length} booking record{filteredBookings.length === 1 ? '' : 's'} match the filters.</p>
            </div>

            <button type="button" onClick={resetFilters} data-skip-create-action="true">
              Clear filters
            </button>
          </div>

          <DataTable
            rows={filteredBookings}
            empty="No bookings match these filters."
            columns={bookingColumns}
          />
        </section>
      )}

      {activeTab === 'leases' && hasRecords && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Long-term leases</h3>
              <p>{filteredLeases.length} lease record{filteredLeases.length === 1 ? '' : 's'} match the filters.</p>
            </div>

            <button type="button" onClick={resetFilters} data-skip-create-action="true">
              Clear filters
            </button>
          </div>

          <DataTable
            rows={filteredLeases}
            empty="No leases match these filters."
            columns={[
              {
                key: 'tenant',
                label: 'Tenant',
                render: (lease) => (
                  <span>
                    <strong>{lease.tenant_name || lease.tenantName || 'Tenant'}</strong>
                    <small>{lease.tenant_email || lease.tenantEmail || lease.tenant_phone || lease.tenantPhone || 'No contact'}</small>
                  </span>
                ),
              },
              {
                key: 'property',
                label: 'Property',
                render: (lease) => getPropertyName(lease, properties),
              },
              {
                key: 'dates',
                label: 'Lease period',
                render: (lease) => `${formatDate(lease.lease_start || lease.leaseStart)} → ${formatDate(lease.lease_end || lease.leaseEnd, 'Open-ended')}`,
              },
              {
                key: 'rent',
                label: 'Monthly rent',
                render: (lease) => formatCurrency(leaseMonthlyRent(lease), lease.currency || workspaceCurrency),
              },
              {
                key: 'status',
                label: 'Lease status',
                render: (lease) => <StatusBadge>{lease.lease_status || lease.leaseStatus || 'active'}</StatusBadge>,
              },
              {
                key: 'payment',
                label: 'Rent status',
                render: (lease) => <StatusBadge>{lease.rent_payment_status || lease.rentPaymentStatus || 'unknown'}</StatusBadge>,
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (lease) => (
                  <div className="action-row">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitError('');
                          setEditingLease(lease);
                        }}
                        data-skip-create-action="true"
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>
                    )}

                    <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
                      <Eye size={16} />
                      Calendar
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}

      {activeTab === 'property-status' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Property booking status</h3>
              <p>Derived occupancy status based on active leases, bookings, and cleaning tasks.</p>
            </div>
          </div>

          <DataTable
            rows={propertyStatusRows}
            empty="Add properties to track booking status."
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
                key: 'status',
                label: 'Property status',
                render: (property) => <StatusBadge>{property.derivedStatus || property.status || 'active'}</StatusBadge>,
              },
              {
                key: 'address',
                label: 'Location',
                render: (property) => [property.city, property.state, property.country].filter(Boolean).join(', ') || property.address || '—',
              },
              {
                key: 'type',
                label: 'Type',
                render: (property) => normalizeLabel(property.rental_type || property.rentalType || property.property_type || property.propertyType),
              },
            ]}
          />
        </section>
      )}

      {editingBooking && (
        <BookingForm
          initial={editingBooking}
          properties={properties}
          workspace={currentWorkspace}
          session={session}
          onSubmit={saveBooking}
          onCancel={closeModal}
          submitting={submitting}
          submitError={submitError}
        />
      )}

      {(editingLease || creatingLease) && (
        <LeaseForm
          initial={editingLease}
          properties={properties}
          workspace={currentWorkspace}
          onSubmit={saveLease}
          onCancel={closeModal}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </AppLayout>
  );
}

function derivedPropertyStatus(property, bookings, leases, cleaningTasks) {
  const now = today();

  if (
    leases.some(
      (lease) =>
        getPropertyId(lease) === property.id &&
        ['active', 'ending_soon'].includes(lease.lease_status || lease.leaseStatus) &&
        dateOnly(lease.lease_start || lease.leaseStart) <= now &&
        (!dateOnly(lease.lease_end || lease.leaseEnd) || dateOnly(lease.lease_end || lease.leaseEnd) >= now),
    )
  ) {
    return 'leased';
  }

  if (
    bookings.some(
      (booking) =>
        getPropertyId(booking) === property.id &&
        ['confirmed', 'checked_in'].includes(booking.status) &&
        dateOnly(booking.check_in || booking.checkIn) <= now &&
        dateOnly(booking.check_out || booking.checkOut) > now,
    )
  ) {
    return 'occupied';
  }

  if (
    cleaningTasks.some(
      (task) =>
        getPropertyId(task) === property.id &&
        ['scheduled', 'missed', 'needs_inspection'].includes(task.status) &&
        dateOnly(task.scheduledFor || task.scheduled_for) <= now,
    )
  ) {
    return 'cleaning_due';
  }

  return property.status || 'active';
}
