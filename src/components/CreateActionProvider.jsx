import React from 'react';
import { X } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { currencies, expenseCategories, expensePaymentStatuses, inviteRoleOptions, leasePaymentStatuses, leaseStatuses, leaseTypes, rentFrequencies, roleLabels, roles } from '../data/constants.js';

const CreateActionContext = React.createContext(null);

const today = () => new Date().toISOString().slice(0, 10);

const inDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const actionMatchers = [
  { action: 'property', labels: ['add property', 'add first property', 'new property'] },
  { action: 'booking', labels: ['add booking', 'new booking', 'add reservation', 'new reservation'] },
  { action: 'lease', labels: ['add lease', 'new lease', 'add long-term rental', 'new long-term rental'] },
  {
    action: 'cleaning',
    labels: ['add cleaning task', 'new cleaning task', 'add cleaning', 'schedule cleaning'],
  },
  {
    action: 'maintenance',
    labels: [
      'add maintenance work order',
      'add work order',
      'new work order',
      'add maintenance',
      'report issue',
    ],
  },
  { action: 'owner', labels: ['add owner', 'new owner'] },
  { action: 'guest', labels: ['add guest', 'new guest', 'add guest / crm', 'add contact'] },
  { action: 'invite', labels: ['invite team member', 'invite team', 'add team member', 'invite member'] },
  { action: 'expense', labels: ['add expense', 'new expense'] },
  { action: 'report', labels: ['add report', 'new report', 'create report'] },
];

const actionMeta = {
  property: {
    title: 'Add property',
    description: 'Create a real property record for the selected workspace.',
  },
  booking: {
    title: 'Add booking',
    description: 'Create a reservation, guest record, and optional checkout cleaning task.',
  },
  lease: {
    title: 'Add lease',
    description: 'Track a manual long-term rental lease. No rent collection, e-signature, or legal document generation is included.',
  },
  cleaning: {
    title: 'Add cleaning task',
    description: 'Schedule a cleaning task for a property.',
  },
  maintenance: {
    title: 'Add maintenance work order',
    description: 'Create a repair or issue work order for a property.',
  },
  owner: {
    title: 'Add owner',
    description: 'Add a property owner contact to the workspace CRM.',
  },
  guest: {
    title: 'Add guest',
    description: 'Add a guest contact to the workspace CRM.',
  },
  invite: {
    title: 'Invite team member',
    description: 'Create a workspace invite with a role assignment.',
  },
  expense: {
    title: 'Add expense',
    description: 'Create a real manual expense record for this workspace. Exports and accounting automation remain disabled.',
  },
  report: {
    title: 'Add report',
    description: 'Create a workspace-scoped report record. PDF/CSV generation remains disabled.',
  },
};

const propertyTypeOptions = [
  ['short_term_rental', 'Short-term rental'],
  ['long_term_rental', 'Long-term rental'],
  ['villa', 'Villa'],
  ['apartment', 'Apartment'],
  ['house', 'House'],
  ['condo', 'Condo'],
  ['guesthouse', 'Guesthouse'],
  ['hotel_small_resort', 'Hotel / small resort'],
  ['commercial_property', 'Commercial property'],
  ['model_unit', 'Model unit'],
];

const rentalTypeOptions = [
  ['short_term', 'Short term'],
  ['long_term', 'Long term'],
  ['both', 'Both'],
];

const propertyStatusOptions = [
  ['active', 'Active'],
  ['vacant', 'Vacant'],
  ['occupied', 'Occupied'],
  ['maintenance_issue', 'Maintenance issue'],
];

const bookingSourceOptions = [
  ['manual', 'Manual'],
  ['direct', 'Direct'],
  ['airbnb', 'Airbnb'],
  ['booking_com', 'Booking.com'],
  ['vrbo', 'Vrbo'],
  ['other', 'Other'],
];

const bookingStatusOptions = [
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['checked_in', 'Checked in'],
  ['checked_out', 'Checked out'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const paymentStatusOptions = [
  ['unpaid', 'Unpaid'],
  ['partially_paid', 'Partially paid'],
  ['paid', 'Paid'],
  ['refunded', 'Refunded'],
];

const cleaningStatusOptions = [
  ['scheduled', 'Scheduled'],
  ['in_progress', 'In progress'],
  ['needs_inspection', 'Needs inspection'],
  ['completed', 'Completed'],
  ['guest_ready', 'Guest ready'],
  ['missed', 'Missed'],
];

const priorityOptions = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];

const maintenanceStatusOptions = [
  ['reported', 'Reported'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In progress'],
  ['waiting_parts', 'Waiting for parts'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const reportTypeOptions = [
  ['owner_statement', 'Owner statement'],
  ['revenue_report', 'Revenue report'],
  ['expense_report', 'Expense report'],
  ['occupancy_report', 'Occupancy report'],
  ['maintenance_cost_report', 'Maintenance cost report'],
  ['cleaning_cost_report', 'Cleaning cost report'],
  ['property_performance', 'Property performance'],
  ['booking_summary', 'Booking summary'],
];

const expenseCurrencyOptions = ['USD', 'JMD', 'CAD', 'GBP', 'EUR'];

const reportStatusOptions = [
  ['draft', 'Draft / internal'],
  ['released', 'Released to owner'],
  ['published', 'Published'],
  ['sent', 'Sent'],
  ['delivered', 'Delivered'],
  ['completed', 'Completed'],
];

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getActionFromLabel(label) {
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) return null;

  return (
    actionMatchers.find(({ labels }) =>
      labels.some((item) => normalizedLabel === item || normalizedLabel.includes(item)),
    )?.action || null
  );
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const cleanValue = String(value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();

  if (!cleanValue || cleanValue === '-' || cleanValue === '.' || cleanValue === '-.') {
    return null;
  }

  const numericValue = Number(cleanValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function firstPropertyId(properties) {
  return properties?.[0]?.id || '';
}

function getWorkspaceCurrency(workspace) {
  return workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function propertyCurrency(properties, workspace, propertyId) {
  return (
    properties.find((property) => property.id === propertyId)?.currency ||
    getWorkspaceCurrency(workspace)
  );
}

function toLines(value) {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function closeOnEscape(onClose, disabled) {
  return (event) => {
    if (event.key === 'Escape' && !disabled) onClose();
  };
}

function labelFromValue(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const scopedInviteRoles = [roles.OWNER, roles.CLEANER, roles.MAINTENANCE];

const createActionAllowedRoles = {
  property: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  booking: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  lease: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  cleaning: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  maintenance: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  owner: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  guest: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST],
  invite: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  expense: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER],
  report: [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST, roles.ACCOUNTANT],
};

function activeWorkspaceRoles(app) {
  const activeMembership = (app.memberships || []).find(
    (membership) => membership.workspace_id === app.currentWorkspace?.id && membership.status !== 'revoked',
  );

  return activeMembership?.roles || [];
}

function canOpenCreateAction(app, action) {
  const allowedRoles = createActionAllowedRoles[action];
  if (!allowedRoles) return false;
  if (!app.currentWorkspace?.id) return true;

  const userRoles = activeWorkspaceRoles(app);
  return allowedRoles.some((role) => userRoles.includes(role));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function cleanPhone(value) {
  const text = String(value || '')
    .replace(/[^+\d()\-.\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}

function optionValues(options) {
  return options.map((option) => (Array.isArray(option) ? option[0] : option));
}

function isAllowedValue(value, options) {
  return optionValues(options).includes(value);
}

function findProperty(properties, propertyId) {
  return properties.find((property) => property.id === propertyId);
}

function findBooking(bookings, bookingId) {
  return bookings.find((booking) => booking.id === bookingId);
}

function bookingPropertyId(booking) {
  return booking?.property_id || booking?.propertyId || '';
}

function OptionList({ options }) {
  return options.map((option) => {
    const value = Array.isArray(option) ? option[0] : option;
    const label = Array.isArray(option) ? option[1] : option;

    return (
      <option key={value} value={value}>
        {label}
      </option>
    );
  });
}

function PropertyOptions({ properties, emptyLabel = 'Select property' }) {
  if (!properties.length) {
    return <option value="">{emptyLabel}</option>;
  }

  return properties.map((property) => (
    <option key={property.id} value={property.id}>
      {property.name || property.address || 'Unnamed property'}
    </option>
  ));
}

function MemberOptions({ members, fallbackLabel = 'Unassigned' }) {
  return (
    <>
      <option value="">{fallbackLabel}</option>
      {members.map((member) => {
        const profile = member.profile || member.profiles || {};
        const name =
          profile.full_name ||
          profile.name ||
          profile.email ||
          member.email ||
          member.user_email ||
          member.id;

        return (
          <option key={member.id || member.user_id || name} value={member.user_id || member.id}>
            {name}
          </option>
        );
      })}
    </>
  );
}

function ContactOptions({ contacts, fallbackLabel = 'No owner contact' }) {
  return (
    <>
      <option value="">{fallbackLabel}</option>
      {contacts.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.fullName || contact.full_name || contact.name || contact.email || 'Owner contact'}
        </option>
      ))}
    </>
  );
}

function memberHasRole(member, role) {
  return (member.roles || []).includes(role);
}

function ownerMembers(members) {
  return members.filter((member) => member.status === 'active' && memberHasRole(member, roles.OWNER));
}

function cleanerMembers(members) {
  return members.filter((member) => member.status === 'active' && memberHasRole(member, roles.CLEANER));
}

function maintenanceMembers(members) {
  return members.filter((member) => member.status === 'active' && memberHasRole(member, roles.MAINTENANCE));
}

function cleanDateOrNull(value, label) {
  if (!value) return null;

  const dateValue = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(new Date(`${dateValue}T00:00:00`).getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return dateValue;
}

function BookingOptions({ bookings, properties, emptyLabel = 'No related booking' }) {
  return (
    <>
      <option value="">{emptyLabel}</option>
      {bookings.map((booking) => {
        const property = properties.find(
          (item) => item.id === (booking.property_id || booking.propertyId),
        );
        const label = [
          booking.guest_name || booking.guestName || 'Guest booking',
          property?.name || booking.property,
          booking.check_in || booking.checkIn,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <option key={booking.id} value={booking.id}>
            {label}
          </option>
        );
      })}
    </>
  );
}

function selectedPropertyNames(properties, propertyIds) {
  const selected = properties
    .filter((property) => propertyIds.includes(property.id))
    .map((property) => property.name || property.address || 'Unnamed property');

  return selected.join(', ');
}

function buildContactNotes({ notes, contextLines }) {
  const cleanNotes = String(notes || '').replace(/\s+$/g, '').trim();
  const cleanContext = contextLines.map((line) => String(line || '').trim()).filter(Boolean);

  if (!cleanContext.length) return cleanNotes || null;

  return [cleanNotes, cleanContext.join('\n')].filter(Boolean).join('\n\n');
}

async function runAppAction(app, actionNames, payload) {
  const actionName = actionNames.find((name) => typeof app?.[name] === 'function');

  if (!actionName) {
    throw new Error(
      'This form is ready, but the save action is not connected in AppContext yet. The UI will stay safe instead of saving to the wrong table.',
    );
  }

  return app[actionName](payload);
}

async function refreshAfterSave(app) {
  if (typeof app?.refreshWorkspaceData === 'function') {
    await app.refreshWorkspaceData();
  }
}

function ModalShell({ action, error, children, onClose, submitting }) {
  const meta = actionMeta[action] || {
    title: 'Create record',
    description: 'Add a new workspace record.',
  };

  React.useEffect(() => {
    const handler = closeOnEscape(onClose, submitting);
    document.addEventListener('keydown', handler);

    return () => document.removeEventListener('keydown', handler);
  }, [onClose, submitting]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-action-title"
      >
        <header className="modal-header">
          <div>
            <h3 id="create-action-title">{meta.title}</h3>
            <p>{meta.description}</p>
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

        {error && (
          <div className="modal-error" role="alert">
            {error}
          </div>
        )}

        {children}
      </section>
    </div>
  );
}


function FormGuidance({ children }) {
  return (
    <div className="modal-guidance" role="note">
      {children}
    </div>
  );
}

function EmptyDependencyNotice({ message }) {
  return (
    <div className="modal-warning" role="status">
      {message}
    </div>
  );
}

function WorkspaceBlockedNotice({ app }) {
  if (app.currentWorkspace?.id) return null;

  return (
    <EmptyDependencyNotice message="Select or create a workspace before saving records. This protects every record with a workspace_id." />
  );
}

function PropertyForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const workspaceCurrency = getWorkspaceCurrency(app.currentWorkspace);
  const owners = ownerMembers(app.data.members || []);
  const ownerIds = new Set(owners.map((owner) => owner.user_id || owner.userId || owner.id).filter(Boolean));

  const [form, setForm] = React.useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: app.currentWorkspace?.country || 'United States',
    property_type: 'short_term_rental',
    rental_type: 'short_term',
    currency: workspaceCurrency,
    status: 'active',
    nightly_rate: '',
    monthly_rent: '',
    assigned_owner_id: '',
    bedrooms: '',
    bathrooms: '',
    square_feet: '',
    notes: '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a property.');
      return;
    }

    if (!form.name.trim()) {
      setError('Property name is required.');
      return;
    }

    if (!form.address.trim()) {
      setError('Address or location is required.');
      return;
    }

    if (!isAllowedValue(form.property_type, propertyTypeOptions)) {
      setError('Select a valid property type.');
      return;
    }

    if (!isAllowedValue(form.rental_type, rentalTypeOptions)) {
      setError('Select a valid rental type.');
      return;
    }

    if (!isAllowedValue(form.status, propertyStatusOptions)) {
      setError('Select a valid property status.');
      return;
    }

    if (!currencies.includes(form.currency)) {
      setError('Select a valid currency.');
      return;
    }

    const numericChecks = [
      ['nightly_rate', 'Nightly rate'],
      ['monthly_rent', 'Monthly rent'],
      ['bedrooms', 'Bedrooms'],
      ['bathrooms', 'Bathrooms'],
      ['square_feet', 'Square footage'],
    ];

    const invalidNumber = numericChecks.find(([key]) => {
      const value = form[key];
      const numericValue = cleanNumber(value);
      return value !== '' && (numericValue === null || numericValue < 0);
    });

    if (invalidNumber) {
      setError(`${invalidNumber[1]} must be 0 or more.`);
      return;
    }

    if (form.assigned_owner_id && !ownerIds.has(form.assigned_owner_id)) {
      setError('Assigned owner must be an invited Property Owner in this workspace.');
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createProperty'], {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        property_type: form.property_type,
        rental_type: form.rental_type,
        currency: form.currency || workspaceCurrency,
        status: form.status,
        nightly_rate: cleanNumber(form.nightly_rate),
        monthly_rent: cleanNumber(form.monthly_rent),
        assigned_owner_id: form.assigned_owner_id || null,
        bedrooms: cleanNumber(form.bedrooms),
        bathrooms: cleanNumber(form.bathrooms),
        square_feet: cleanNumber(form.square_feet),
        notes: form.notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Property saved successfully.');
      close();
    } catch (error) {
      setError(error?.message || 'Property could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        <FormGuidance>Property name, address/location, property type, rental type, status, and currency are required. Rates, owner assignment, size, and notes can be added now or later.</FormGuidance>

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
            <input value={form.country} onChange={set('country')} />
          </label>

          <label>
            Property type
            <select value={form.property_type} onChange={set('property_type')}>
              <OptionList options={propertyTypeOptions} />
            </select>
          </label>

          <label>
            Rental type
            <select value={form.rental_type} onChange={set('rental_type')}>
              <OptionList options={rentalTypeOptions} />
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              <OptionList options={propertyStatusOptions} />
            </select>
          </label>

          <label>
            Currency
            <select value={form.currency} onChange={set('currency')}>
              <OptionList options={currencies} />
            </select>
          </label>

          <label>
            Nightly rate
            <input
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.nightly_rate}
              onChange={set('nightly_rate')}
              data-comma-format="true"
            />
          </label>

          <label>
            Monthly rent
            <input
              type="text"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.monthly_rent}
              onChange={set('monthly_rent')}
              data-comma-format="true"
            />
          </label>

          <label>
            Assigned owner
            <select value={form.assigned_owner_id} onChange={set('assigned_owner_id')}>
              <MemberOptions members={owners} fallbackLabel="No owner assigned" />
            </select>
            <small className="form-hint">
              {owners.length
                ? 'Only active property owner members in this workspace can be assigned here.'
                : 'Invite a Property Owner to this workspace before assigning owner access.'}
            </small>
          </label>

          <label>
            Bedrooms
            <input type="number" min="0" value={form.bedrooms} onChange={set('bedrooms')} />
          </label>

          <label>
            Bathrooms
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.bathrooms}
              onChange={set('bathrooms')}
            />
          </label>

          <label>
            Square feet
            <input
              type="text"
              inputMode="numeric"
              min="0"
              value={form.square_feet}
              onChange={set('square_feet')}
              data-comma-format="true"
            />
          </label>

          <label className="full">
            Notes
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting} data-skip-create-action="true">
          {submitting ? 'Saving…' : 'Save property'}
        </button>
      </footer>
    </form>
  );
}

function BookingForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = app.data.properties || [];
  const initialPropertyId = firstPropertyId(properties);

  const [form, setForm] = React.useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    property_id: initialPropertyId,
    check_in: today(),
    check_out: inDays(1),
    guest_count: 1,
    source: 'manual',
    status: 'confirmed',
    payment_status: 'unpaid',
    currency: propertyCurrency(properties, app.currentWorkspace, initialPropertyId),
    total_amount: '',
    cleaning_fee: '',
    taxes_fees: '',
    owner_payout: '',
    notes: '',
    auto_create_cleaning: true,
  });

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'property_id') {
        next.currency = propertyCurrency(properties, app.currentWorkspace, value);
      }

      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a booking.');
      return;
    }

    if (!properties.length) {
      setError('Add a property before creating a booking.');
      return;
    }

    if (!form.property_id) {
      setError('Select a property before saving the booking.');
      return;
    }

    if (!findProperty(properties, form.property_id)) {
      setError('Select an existing property in this workspace before saving the booking.');
      return;
    }

    if (!form.guest_name.trim()) {
      setError('Guest name is required.');
      return;
    }

    if (!form.check_in || !form.check_out) {
      setError('Check-in and check-out dates are required.');
      return;
    }

    if (form.check_out <= form.check_in) {
      setError('Check-out must be after check-in.');
      return;
    }

    if (!isAllowedValue(form.source, bookingSourceOptions)) {
      setError('Select a valid booking source.');
      return;
    }

    if (!isAllowedValue(form.status, bookingStatusOptions)) {
      setError('Select a valid booking status.');
      return;
    }

    if (!isAllowedValue(form.payment_status, paymentStatusOptions)) {
      setError('Select a valid payment status.');
      return;
    }

    if (!currencies.includes(form.currency)) {
      setError('Select a valid currency.');
      return;
    }

    const guestCount = cleanNumber(form.guest_count);

    if (!Number.isInteger(guestCount) || guestCount < 1) {
      setError('Guest count must be at least 1.');
      return;
    }

    const invalidAmount = [
      ['total_amount', 'Total amount'],
      ['cleaning_fee', 'Cleaning fee'],
      ['taxes_fees', 'Taxes / fees'],
      ['owner_payout', 'Owner payout'],
    ].find(([key]) => form[key] !== '' && (cleanNumber(form[key]) === null || cleanNumber(form[key]) < 0));

    if (invalidAmount) {
      setError(`${invalidAmount[1]} must be 0 or more.`);
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createBooking'], {
        property_id: form.property_id,
        check_in: form.check_in,
        check_out: form.check_out,
        source: form.source,
        status: form.status,
        payment_status: form.payment_status,
        currency: form.currency,
        auto_create_cleaning: Boolean(form.auto_create_cleaning),
        guest_name: form.guest_name.trim(),
        guest_email: normalizeEmail(form.guest_email) || null,
        guest_phone: form.guest_phone.trim() || null,
        guest_count: guestCount,
        total_amount: cleanNumber(form.total_amount),
        cleaning_fee: cleanNumber(form.cleaning_fee),
        taxes_fees: cleanNumber(form.taxes_fees),
        owner_payout: cleanNumber(form.owner_payout),
        notes: form.notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Booking saved successfully.');
      close();
    } catch (error) {
      setError(error?.message || 'Booking could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        {!properties.length && (
          <EmptyDependencyNotice message="Add your first property before creating bookings. Bookings must be connected to a real workspace property." />
        )}

        <FormGuidance>Required: guest name, property, check-in, check-out, booking source, booking status, payment status, currency, and total amount when known. Optional contact and fee fields can stay blank without blocking save.</FormGuidance>

        <div className="form-grid">
          <label>
            Guest name
            <input value={form.guest_name} onChange={set('guest_name')} required />
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
            <select value={form.property_id} onChange={set('property_id')} required>
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
          </label>

          <label>
            Check-in
            <input type="date" value={form.check_in} onChange={set('check_in')} required />
          </label>

          <label>
            Check-out
            <input type="date" value={form.check_out} onChange={set('check_out')} required />
          </label>

          <label>
            Guests
            <input
              type="number"
              min="1"
              value={form.guest_count}
              onChange={set('guest_count')}
            />
          </label>

          <label>
            Source
            <select value={form.source} onChange={set('source')}>
              <OptionList options={bookingSourceOptions} />
            </select>
          </label>

          <label>
            Booking status
            <select value={form.status} onChange={set('status')}>
              <OptionList options={bookingStatusOptions} />
            </select>
          </label>

          <label>
            Payment status
            <select value={form.payment_status} onChange={set('payment_status')}>
              <OptionList options={paymentStatusOptions} />
            </select>
          </label>

          <label>
            Currency
            <select value={form.currency} onChange={set('currency')}>
              <OptionList options={currencies} />
            </select>
          </label>

          <label>
            Total amount
            <input
              type="text"
              inputMode="decimal"
              value={form.total_amount}
              onChange={set('total_amount')}
              data-comma-format="true"
            />
          </label>

          <label>
            Cleaning fee
            <input
              type="text"
              inputMode="decimal"
              value={form.cleaning_fee}
              onChange={set('cleaning_fee')}
              data-comma-format="true"
            />
          </label>

          <label>
            Taxes / fees
            <input
              type="text"
              inputMode="decimal"
              value={form.taxes_fees}
              onChange={set('taxes_fees')}
              data-comma-format="true"
            />
          </label>

          <label>
            Owner payout
            <input
              type="text"
              inputMode="decimal"
              value={form.owner_payout}
              onChange={set('owner_payout')}
              data-comma-format="true"
            />
          </label>

          <label className="inline-check full">
            <input
              type="checkbox"
              checked={form.auto_create_cleaning}
              onChange={set('auto_create_cleaning')}
            />
            Auto-create checkout cleaning task
          </label>

          <label className="full">
            Notes
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting || !properties.length} data-skip-create-action="true">
          {submitting ? 'Saving…' : properties.length ? 'Save booking' : 'Add a property first'}
        </button>
      </footer>
    </form>
  );
}


function LeaseForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = app.data.properties || [];
  const initialPropertyId = firstPropertyId(properties);

  const [form, setForm] = React.useState({
    property_id: initialPropertyId,
    tenant_name: '',
    tenant_email: '',
    tenant_phone: '',
    lease_type: 'fixed_term',
    lease_status: 'draft',
    lease_start: today(),
    lease_end: '',
    rent_amount: '',
    rent_frequency: 'monthly',
    currency: propertyCurrency(properties, app.currentWorkspace, initialPropertyId),
    security_deposit_amount: '',
    deposit_status: 'not_tracked',
    payment_status: 'not_tracked',
    due_day: '',
    grace_period_days: '0',
    late_fee_amount: '',
    move_in_notes: '',
    internal_notes: '',
  });

  const set = (key) => (event) => {
    setForm((current) => {
      const next = { ...current, [key]: event.target.value };
      if (key === 'property_id') next.currency = propertyCurrency(properties, app.currentWorkspace, event.target.value);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a lease.');
      return;
    }

    if (!properties.length) {
      setError('Add a property before creating a long-term lease.');
      return;
    }

    if (!form.property_id || !findProperty(properties, form.property_id)) {
      setError('Select an existing property in this workspace before saving the lease.');
      return;
    }

    if (!form.tenant_name.trim()) {
      setError('Tenant name is required.');
      return;
    }

    if (form.tenant_email && !isValidEmail(form.tenant_email)) {
      setError('Enter a valid tenant email or leave it blank.');
      return;
    }

    if (!form.lease_start) {
      setError('Lease start is required.');
      return;
    }

    if (form.lease_end && form.lease_end <= form.lease_start) {
      setError('Lease end must be after lease start.');
      return;
    }

    const invalidAmount = [
      ['rent_amount', 'Rent amount'],
      ['security_deposit_amount', 'Security deposit'],
      ['late_fee_amount', 'Late fee amount'],
    ].find(([key]) => form[key] !== '' && (cleanNumber(form[key]) === null || cleanNumber(form[key]) < 0));

    if (invalidAmount) {
      setError(`${invalidAmount[1]} must be 0 or more.`);
      return;
    }

    const dueDay = form.due_day === '' ? null : Number(form.due_day);
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      setError('Due day must be between 1 and 31.');
      return;
    }

    const gracePeriodDays = form.grace_period_days === '' ? 0 : Number(form.grace_period_days);
    if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
      setError('Grace period days must be 0 or more.');
      return;
    }

    if (!isAllowedValue(form.lease_type, leaseTypes)) {
      setError('Select a valid lease type.');
      return;
    }

    if (!isAllowedValue(form.lease_status, leaseStatuses)) {
      setError('Select a valid lease status.');
      return;
    }

    if (!isAllowedValue(form.rent_frequency, rentFrequencies)) {
      setError('Select a valid rent frequency.');
      return;
    }

    if (!isAllowedValue(form.payment_status, leasePaymentStatuses) || !isAllowedValue(form.deposit_status, leasePaymentStatuses)) {
      setError('Select valid manual payment and deposit statuses.');
      return;
    }

    if (!currencies.includes(form.currency)) {
      setError('Select a valid currency.');
      return;
    }

    try {
      setSubmitting(true);
      await runAppAction(app, ['createLease'], {
        property_id: form.property_id,
        tenant_name: form.tenant_name.trim(),
        tenant_email: normalizeEmail(form.tenant_email) || null,
        tenant_phone: cleanPhone(form.tenant_phone),
        lease_type: form.lease_type,
        lease_status: form.lease_status,
        lease_start: form.lease_start,
        lease_end: form.lease_end || null,
        rent_amount: cleanNumber(form.rent_amount) ?? 0,
        rent_frequency: form.rent_frequency,
        currency: form.currency,
        security_deposit_amount: cleanNumber(form.security_deposit_amount),
        deposit_status: form.deposit_status,
        payment_status: form.payment_status,
        due_day: dueDay,
        grace_period_days: gracePeriodDays,
        late_fee_amount: cleanNumber(form.late_fee_amount),
        move_in_notes: form.move_in_notes.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Lease saved successfully.');
      close();
    } catch (error) {
      setError(error?.message || 'Lease could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />
        {!properties.length && <EmptyDependencyNotice message="Add your first property before creating leases." />}
        <div className="helper">
          Manual tracking only: PropFlow will not collect rent, generate legal documents, or request e-signatures from this form.
        </div>

        <div className="form-grid">
          <label>
            Property
            <select value={form.property_id} onChange={set('property_id')} required>
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
          </label>

          <label>
            Tenant name
            <input value={form.tenant_name} onChange={set('tenant_name')} required />
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
            Lease type
            <select value={form.lease_type} onChange={set('lease_type')}>
              {leaseTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Lease status
            <select value={form.lease_status} onChange={set('lease_status')}>
              {leaseStatuses.filter(([value]) => value !== 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Lease start
            <input type="date" value={form.lease_start} onChange={set('lease_start')} required />
          </label>

          <label>
            Lease end
            <input type="date" value={form.lease_end} onChange={set('lease_end')} />
          </label>

          <label>
            Rent amount
            <input type="text" inputMode="decimal" value={form.rent_amount} onChange={set('rent_amount')} data-comma-format="true" />
          </label>

          <label>
            Rent frequency
            <select value={form.rent_frequency} onChange={set('rent_frequency')}>
              {rentFrequencies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Currency
            <select value={form.currency} onChange={set('currency')} required>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>

          <label>
            Security deposit
            <input type="text" inputMode="decimal" value={form.security_deposit_amount} onChange={set('security_deposit_amount')} data-comma-format="true" />
          </label>

          <label>
            Deposit status
            <select value={form.deposit_status} onChange={set('deposit_status')}>
              {leasePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Manual payment status
            <select value={form.payment_status} onChange={set('payment_status')}>
              {leasePaymentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label>
            Due day
            <input type="number" min="1" max="31" value={form.due_day} onChange={set('due_day')} />
          </label>

          <label>
            Grace period days
            <input type="number" min="0" value={form.grace_period_days} onChange={set('grace_period_days')} />
          </label>

          <label>
            Late fee amount
            <input type="text" inputMode="decimal" value={form.late_fee_amount} onChange={set('late_fee_amount')} data-comma-format="true" />
          </label>

          <label className="full">
            Move-in notes
            <textarea rows={3} value={form.move_in_notes} onChange={set('move_in_notes')} />
          </label>

          <label className="full">
            Internal notes
            <textarea rows={3} value={form.internal_notes} onChange={set('internal_notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">Cancel</button>
        <button className="primary" type="submit" disabled={submitting} data-skip-create-action="true">
          {submitting ? 'Saving…' : 'Save lease'}
        </button>
      </footer>
    </form>
  );
}

function CleaningForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = app.data.properties || [];
  const members = app.data.members || [];
  const cleaners = cleanerMembers(members);
  const bookings = app.data.bookings || [];
  const initialPropertyId = firstPropertyId(properties);

  const [form, setForm] = React.useState({
    property_id: initialPropertyId,
    assigned_cleaner_id: '',
    scheduled_for: today(),
    scheduled_time: '11:00',
    booking_id: '',
    status: 'scheduled',
    checklist_items: 'Strip beds\nSanitize bathrooms\nMop floors\nRestock supplies\nConfirm guest-ready condition',
    supplies_used: '',
    cleaner_notes: '',
  });

  const selectedCleanerIds = new Set(cleaners.map((member) => member.user_id || member.userId || member.id).filter(Boolean));
  const propertyBookings = bookings.filter((booking) => bookingPropertyId(booking) === form.property_id);

  const set = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
      ...(key === 'property_id' ? { booking_id: '' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a cleaning task.');
      return;
    }

    if (!properties.length) {
      setError('Add a property before creating cleaning tasks.');
      return;
    }

    if (!form.property_id) {
      setError('Select a property before saving.');
      return;
    }

    if (!findProperty(properties, form.property_id)) {
      setError('Select an existing property in this workspace before saving the cleaning task.');
      return;
    }

    if (!form.scheduled_for) {
      setError('Cleaning date is required.');
      return;
    }

    if (form.assigned_cleaner_id && !selectedCleanerIds.has(form.assigned_cleaner_id)) {
      setError('Assigned cleaner must be an active cleaner in this workspace.');
      return;
    }

    const scheduledTimestamp = new Date(`${form.scheduled_for}T${form.scheduled_time || '11:00'}:00`);
    if (Number.isNaN(scheduledTimestamp.getTime())) {
      setError('Select a valid scheduled date and time.');
      return;
    }

    const linkedBooking = form.booking_id ? findBooking(bookings, form.booking_id) : null;

    if (form.booking_id && (!linkedBooking || bookingPropertyId(linkedBooking) !== form.property_id)) {
      setError('Related booking must belong to the selected property in this workspace.');
      return;
    }

    if (!isAllowedValue(form.status, cleaningStatusOptions)) {
      setError('Select a valid cleaning status.');
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createCleaningTask'], {
        property_id: form.property_id,
        status: form.status,
        assigned_cleaner_id: form.assigned_cleaner_id || null,
        booking_id: form.booking_id || null,
        scheduled_for: scheduledTimestamp.toISOString(),
        checklist_items: toLines(form.checklist_items),
        supplies_used: form.supplies_used.trim() || null,
        cleaner_notes: form.cleaner_notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Cleaning task saved successfully.');
      close();
    } catch (error) {
      setError(error?.message || 'Cleaning task could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        {!properties.length && (
          <EmptyDependencyNotice message="Add your first property before creating cleaning tasks. Cleaning work must be connected to a real workspace property." />
        )}

        {properties.length > 0 && !cleaners.length && (
          <EmptyDependencyNotice message="No cleaner is invited yet. You can save this task unassigned and invite a cleaner from Team settings when ready." />
        )}

        <FormGuidance>Required: property, scheduled date/time, and status. Cleaner assignment and related booking are optional; booking choices are limited to the selected property.</FormGuidance>

        <div className="form-grid">
          <label>
            Property
            <select value={form.property_id} onChange={set('property_id')} required>
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
          </label>

          <label>
            Assigned cleaner
            <select value={form.assigned_cleaner_id} onChange={set('assigned_cleaner_id')}>
              <MemberOptions members={cleaners} fallbackLabel="Unassigned cleaner" />
            </select>
          </label>

          <label>
            Cleaning date
            <input
              type="date"
              value={form.scheduled_for}
              onChange={set('scheduled_for')}
              required
            />
          </label>

          <label>
            Cleaning time
            <input type="time" value={form.scheduled_time} onChange={set('scheduled_time')} />
          </label>

          <label>
            Related booking
            <select value={form.booking_id} onChange={set('booking_id')}>
              <BookingOptions bookings={propertyBookings} properties={properties} />
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              <OptionList options={cleaningStatusOptions} />
            </select>
          </label>

          <label className="full">
            Checklist items
            <textarea
              rows={5}
              value={form.checklist_items}
              onChange={set('checklist_items')}
              placeholder="One checklist item per line"
            />
          </label>

          <label>
            Supplies used / low supplies
            <input value={form.supplies_used} onChange={set('supplies_used')} />
          </label>

          <label>
            Cleaner notes
            <input value={form.cleaner_notes} onChange={set('cleaner_notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting || !properties.length} data-skip-create-action="true">
          {submitting ? 'Saving…' : properties.length ? 'Save cleaning task' : 'Add a property first'}
        </button>
      </footer>
    </form>
  );
}

function MaintenanceForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = app.data.properties || [];
  const members = app.data.members || [];
  const maintenancePeople = maintenanceMembers(members);
  const maintenanceMemberIds = new Set(maintenancePeople.map((member) => member.user_id || member.userId || member.id).filter(Boolean));
  const initialPropertyId = firstPropertyId(properties);
  const currency = propertyCurrency(properties, app.currentWorkspace, initialPropertyId);

  const [form, setForm] = React.useState({
    property_id: initialPropertyId,
    assigned_maintenance_id: '',
    title: '',
    issue_description: '',
    priority: 'medium',
    status: 'reported',
    estimated_cost: '',
    actual_cost: '',
    parts_needed: '',
    due_date: inDays(2),
    notes: '',
    currency,
  });

  const set = (key) => (event) => {
    setForm((current) => {
      const next = { ...current, [key]: event.target.value };

      if (key === 'property_id') {
        next.currency = propertyCurrency(properties, app.currentWorkspace, event.target.value);
      }

      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a maintenance work order.');
      return;
    }

    if (!properties.length) {
      setError('Add a property before creating maintenance work orders.');
      return;
    }

    if (!form.property_id) {
      setError('Select a property before saving.');
      return;
    }

    if (!findProperty(properties, form.property_id)) {
      setError('Select an existing property in this workspace before saving the work order.');
      return;
    }

    if (!form.title.trim()) {
      setError('Issue title is required.');
      return;
    }

    if (!isAllowedValue(form.priority, priorityOptions)) {
      setError('Select a valid priority.');
      return;
    }

    if (!isAllowedValue(form.status, maintenanceStatusOptions)) {
      setError('Select a valid maintenance status.');
      return;
    }

    if (form.assigned_maintenance_id && !maintenanceMemberIds.has(form.assigned_maintenance_id)) {
      setError('Assigned maintenance person must be an active Maintenance Crew member in this workspace.');
      return;
    }

    const estimatedCost = cleanNumber(form.estimated_cost);
    const actualCost = cleanNumber(form.actual_cost);

    if ((form.estimated_cost !== '' && estimatedCost === null) || estimatedCost < 0) {
      setError('Estimated cost must be 0 or more.');
      return;
    }

    if ((form.actual_cost !== '' && actualCost === null) || actualCost < 0) {
      setError('Actual cost must be 0 or more.');
      return;
    }

    let dueDate = null;
    try {
      dueDate = cleanDateOrNull(form.due_date, 'Due date');
    } catch (error) {
      setError(error.message);
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createMaintenanceWorkOrder'], {
        property_id: form.property_id,
        priority: form.priority,
        status: form.status,
        title: form.title.trim(),
        issue_description: form.issue_description.trim() || null,
        assigned_maintenance_id: form.assigned_maintenance_id || null,
        estimated_cost: estimatedCost,
        actual_cost: actualCost,
        parts_needed: toLines(form.parts_needed).join('\n') || null,
        due_date: dueDate,
        notes: form.notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Maintenance work order saved successfully.');
      close();
    } catch (error) {
      setError(error?.message || 'Maintenance work order could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        {!properties.length && (
          <EmptyDependencyNotice message="Add your first property before creating maintenance work orders. Work orders must be connected to a real workspace property." />
        )}

        {properties.length > 0 && !maintenancePeople.length && (
          <EmptyDependencyNotice message="No Maintenance Crew member is invited yet. You can save this work order unassigned and assign it after inviting maintenance staff." />
        )}

        <FormGuidance>Required: property, issue title, priority, and status. Estimated cost, actual cost, parts needed, due date, notes, and photo context are optional but help the maintenance dashboard stay clear.</FormGuidance>

        <div className="form-grid">
          <label>
            Property
            <select value={form.property_id} onChange={set('property_id')} required>
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
          </label>

          <label>
            Assigned maintenance person
            <select value={form.assigned_maintenance_id} onChange={set('assigned_maintenance_id')}>
              <MemberOptions members={maintenancePeople} fallbackLabel="Unassigned maintenance" />
            </select>
          </label>

          <label>
            Issue title
            <input value={form.title} onChange={set('title')} required />
          </label>

          <label>
            Priority
            <select value={form.priority} onChange={set('priority')}>
              <OptionList options={priorityOptions} />
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              <OptionList options={maintenanceStatusOptions} />
            </select>
          </label>

          <label>
            Due date
            <input type="date" value={form.due_date} onChange={set('due_date')} />
          </label>

          <label>
            Estimated cost
            <input
              type="text"
              inputMode="decimal"
              value={form.estimated_cost}
              onChange={set('estimated_cost')}
              data-comma-format="true"
            />
          </label>

          <label>
            Actual cost
            <input
              type="text"
              inputMode="decimal"
              value={form.actual_cost}
              onChange={set('actual_cost')}
              data-comma-format="true"
            />
          </label>

          <label className="full">
            Issue description
            <textarea rows={4} value={form.issue_description} onChange={set('issue_description')} />
          </label>

          <label className="full">
            Parts / materials needed
            <textarea rows={3} value={form.parts_needed} onChange={set('parts_needed')} />
          </label>

          <label className="full">
            Notes
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting || !properties.length} data-skip-create-action="true">
          {submitting ? 'Saving…' : properties.length ? 'Save work order' : 'Add a property first'}
        </button>
      </footer>
    </form>
  );
}

function ContactForm({ app, close, submitting, setSubmitting, setError, notifySuccess, type }) {
  const isOwner = type === 'owner';
  const properties = app.data.properties || [];
  const bookings = app.data.bookings || [];

  const [form, setForm] = React.useState({
    contact_type: isOwner ? 'owner' : 'guest',
    name: '',
    email: '',
    phone: '',
    company_name: '',
    property_id: '',
    booking_id: '',
    payout_percentage: '',
    notes: '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!app.currentWorkspace?.id) {
      setError(`Select or create a workspace before saving a ${isOwner ? 'owner' : 'guest'}.`);
      return;
    }

    if (!form.name.trim()) {
      setError(`${isOwner ? 'Owner' : 'Guest'} name is required.`);
      return;
    }

    const email = normalizeEmail(form.email);

    if (email && !isValidEmail(email)) {
      setError('Enter a valid email address or leave email blank.');
      return;
    }

    const phone = cleanPhone(form.phone);

    try {
      setSubmitting(true);

      const selectedPropertyName = selectedPropertyNames(
        properties,
        form.property_id ? [form.property_id] : [],
      );
      const relatedBooking = bookings.find((booking) => booking.id === form.booking_id);
      const notes = buildContactNotes({
        notes: form.notes,
        contextLines: [
          form.company_name.trim() && `Company / business: ${form.company_name.trim()}`,
          selectedPropertyName && `Requested property context: ${selectedPropertyName}`,
          isOwner && form.payout_percentage && `Requested payout percentage: ${form.payout_percentage}%`,
          !isOwner &&
            relatedBooking &&
            `Related booking: ${
              relatedBooking.guest_name || relatedBooking.guestName || relatedBooking.id
            }`,
        ],
      });

      await runAppAction(
        app,
        isOwner
          ? ['createOwner', 'createContact', 'createOwnerContact']
          : ['createGuest', 'createContact', 'createGuestContact'],
        {
          contact_type: isOwner ? 'owner' : 'guest',
          name: form.name.trim(),
          full_name: form.name.trim(),
          email: email || null,
          phone,
          notes,
        },
      );

      await refreshAfterSave(app);
      notifySuccess(`${type === 'owner' ? 'Owner' : 'Guest'} saved successfully.`);
      close();
    } catch (error) {
      setError(error?.message || `${isOwner ? 'Owner' : 'Guest'} could not be saved.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        <FormGuidance>{isOwner ? 'Owner contacts are CRM records for ownership/report context. They do not become portal logins unless you also invite them as Property Owner team members.' : 'Guest contacts are CRM records for stay history and communication context. They do not become portal logins.'}</FormGuidance>

        <div className="form-grid">
          <label>
            {isOwner ? 'Owner name' : 'Guest name'}
            <input value={form.name} onChange={set('name')} required />
          </label>

          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} />
          </label>

          <label>
            Phone
            <input value={form.phone} onChange={set('phone')} />
          </label>

          <label>
            Company / business name
            <input value={form.company_name} onChange={set('company_name')} />
          </label>

          <label>
            {isOwner ? 'Assigned property' : 'Property / stay context'}
            <select value={form.property_id} onChange={set('property_id')}>
              <option value="">No property selected</option>
              <PropertyOptions properties={properties} />
            </select>
          </label>

          {isOwner ? (
            <label>
              Payout percentage
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.payout_percentage}
                onChange={set('payout_percentage')}
              />
            </label>
          ) : (
            <label>
              Related booking
              <select value={form.booking_id} onChange={set('booking_id')}>
                <BookingOptions bookings={bookings} properties={properties} />
              </select>
            </label>
          )}

          <label className="full">
            Notes
            <textarea rows={4} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting} data-skip-create-action="true">
          {submitting ? 'Saving…' : `Save ${isOwner ? 'owner' : 'guest'}`}
        </button>
      </footer>
    </form>
  );
}

function InviteForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = app.data.properties || [];

  const [form, setForm] = React.useState({
    email: '',
    role: inviteRoleOptions[0] || 'property_manager',
    assigned_property_ids: [],
    expires_at: inDays(7),
    permission_level: 'standard',
    message: '',
  });

  const set = (key) => (event) => {
    setForm((current) => {
      const next = { ...current, [key]: event.target.value };

      if (key === 'role' && !scopedInviteRoles.includes(event.target.value)) {
        next.assigned_property_ids = [];
      }

      return next;
    });
  };

  const setAssignedPropertyIds = (event) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setForm((current) => ({ ...current, assigned_property_ids: values }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before inviting a team member.');
      return;
    }

    if (!form.email.trim()) {
      setError('Invitee email is required.');
      return;
    }

    if (!isValidEmail(form.email)) {
      setError('Enter a valid invitee email address.');
      return;
    }

    if (!form.role || !inviteRoleOptions.includes(form.role)) {
      setError('Select at least one valid role for this invite.');
      return;
    }

    const scopedPropertyIds = scopedInviteRoles.includes(form.role)
      ? form.assigned_property_ids.filter((propertyId) => findProperty(properties, propertyId))
      : [];

    if (scopedInviteRoles.includes(form.role) && !scopedPropertyIds.length) {
      setError('Property Owner, Cleaner, and Maintenance invites require at least one assigned property.');
      return;
    }

    if (!scopedInviteRoles.includes(form.role) && form.assigned_property_ids.length) {
      setError('Assigned properties only apply to Property Owner, Cleaner, and Maintenance invites.');
      return;
    }

    if (form.assigned_property_ids.length && scopedPropertyIds.length !== form.assigned_property_ids.length) {
      setError('Assigned properties must be existing properties in this workspace.');
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createInvite', 'createWorkspaceInvite', 'inviteTeamMember'], {
        email: normalizeEmail(form.email),
        role: form.role,
        roles: [form.role],
        property_id: scopedPropertyIds[0] || null,
        assigned_property_id: scopedPropertyIds[0] || null,
        assigned_property_ids: scopedPropertyIds,
        expires_at: form.expires_at || null,
        message: form.message.trim() || null,
        permission_level: form.permission_level,
      });

      await refreshAfterSave(app);
      notifySuccess('Invite created. If email delivery is not configured, use Settings → Team to copy the one-time invite link and send it only to the invited email.');
      close();
    } catch (error) {
      setError(error?.message || 'Invite could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        <FormGuidance>Invites create a pending workspace access record. Email delivery is attempted from the server when configured; otherwise copy the invite link from Settings → Team and send it only to the invited email.</FormGuidance>

        <div className="form-grid">
          <label>
            Invitee email
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>

          <label>
            Role
            <select value={form.role} onChange={set('role')}>
              {inviteRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role] || labelFromValue(role)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assigned properties, if relevant
            <select
              multiple
              value={form.assigned_property_ids}
              onChange={setAssignedPropertyIds}
              size={Math.min(Math.max(properties.length, 2), 5)}
            >
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
            <small className="form-hint">Required for Property Owner, Cleaner, and Maintenance roles. Hold Cmd/Ctrl to select multiple assigned properties.</small>
          </label>

          <label>
            Invite expiration
            <input type="date" value={form.expires_at} onChange={set('expires_at')} />
          </label>

          <label>
            Permission level
            <select value={form.permission_level} onChange={set('permission_level')}>
              <option value="standard">Standard role permissions</option>
              <option value="limited">Limited access</option>
            </select>
          </label>

          <label className="full">
            Optional message
            <textarea rows={4} value={form.message} onChange={set('message')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting} data-skip-create-action="true">
          {submitting ? 'Saving…' : 'Create invite'}
        </button>
      </footer>
    </form>
  );
}

function ExpenseForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = (app.data.properties || []).filter((property) => property.status !== 'archived');
  const bookings = app.data.bookings || [];
  const cleaningTasks = app.data.cleaningTasks || [];
  const maintenanceWorkOrders = app.data.maintenanceWorkOrders || [];
  const contacts = app.data.contacts || [];
  const initialPropertyId = firstPropertyId(properties);

  const [form, setForm] = React.useState({
    property_id: initialPropertyId,
    category: 'maintenance',
    description: '',
    vendor_name: '',
    expense_date: today(),
    amount: '',
    currency: propertyCurrency(properties, app.currentWorkspace, initialPropertyId),
    payment_status: 'unpaid',
    booking_id: '',
    cleaning_task_id: '',
    maintenance_work_order_id: '',
    contact_id: '',
    notes: '',
  });

  const filteredBookings = bookings.filter((booking) => !form.property_id || booking.property_id === form.property_id || booking.propertyId === form.property_id);
  const filteredCleaningTasks = cleaningTasks.filter((task) => !form.property_id || task.property_id === form.property_id || task.propertyId === form.property_id);
  const filteredMaintenance = maintenanceWorkOrders.filter((workOrder) => !form.property_id || workOrder.property_id === form.property_id || workOrder.propertyId === form.property_id);
  const vendorContacts = contacts.filter((contact) => ['vendor', 'cleaner', 'maintenance', 'other'].includes(contact.contact_type || contact.contactType));

  const set = (key) => (event) => {
    setForm((current) => {
      const next = { ...current, [key]: event.target.value };

      if (key === 'property_id') {
        next.currency = propertyCurrency(properties, app.currentWorkspace, event.target.value);
        next.booking_id = '';
        next.cleaning_task_id = '';
        next.maintenance_work_order_id = '';
      }

      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Create or select a workspace before saving an expense.');
      return;
    }

    const amount = cleanNumber(form.amount);
    if (!form.description.trim()) {
      setError('Expense description is required.');
      return;
    }
    if (!form.category) {
      setError('Expense category is required.');
      return;
    }
    if (!form.expense_date) {
      setError('Expense date is required.');
      return;
    }
    if (amount === null || amount < 0) {
      setError('Expense amount must be 0 or more.');
      return;
    }
    if (!form.currency) {
      setError('Currency is required.');
      return;
    }

    setSubmitting(true);

    try {
      await app.createExpense({
        property_id: form.property_id || null,
        category: form.category,
        description: form.description,
        vendor_name: form.vendor_name,
        expense_date: form.expense_date,
        amount,
        currency: form.currency,
        payment_status: form.payment_status,
        booking_id: form.booking_id || null,
        cleaning_task_id: form.cleaning_task_id || null,
        maintenance_work_order_id: form.maintenance_work_order_id || null,
        contact_id: form.contact_id || null,
        notes: form.notes,
      });
      notifySuccess('Expense saved.');
      close();
    } catch (error) {
      setError(error?.message || 'Expense could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        <div className="helper">
          Receipt upload will be connected in a later file-storage pass. CSV/PDF exports, tax filings, accounting automation, Stripe, and online payments remain disabled.
        </div>

        <div className="form-grid">
          <label>
            Property
            <select value={form.property_id} onChange={set('property_id')}>
              <option value="">Workspace-level expense</option>
              <PropertyOptions properties={properties} />
            </select>
          </label>

          <label>
            Category
            <select value={form.category} onChange={set('category')} required>
              {expenseCategories
                .filter(([value]) => value !== 'owner_payout' || activeWorkspaceRoles(app).some((role) => [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER].includes(role)))
                .map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
            </select>
          </label>

          <label className="full">
            Description
            <input value={form.description} onChange={set('description')} required />
          </label>

          <label>
            Vendor name
            <input value={form.vendor_name} onChange={set('vendor_name')} />
          </label>

          <label>
            Expense date
            <input type="date" value={form.expense_date} onChange={set('expense_date')} required />
          </label>

          <label>
            Amount
            <input type="text" inputMode="decimal" value={form.amount} onChange={set('amount')} data-comma-format="true" required />
          </label>

          <label>
            Currency
            <select value={form.currency} onChange={set('currency')} required>
              <OptionList options={expenseCurrencyOptions} />
            </select>
          </label>

          <label>
            Payment status
            <select value={form.payment_status} onChange={set('payment_status')}>
              {expensePaymentStatuses.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Related booking
            <select value={form.booking_id} onChange={set('booking_id')}>
              <option value="">No booking link</option>
              {filteredBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>{booking.guestName || booking.guest_name || 'Booking'} · {booking.checkIn || booking.check_in || 'date not set'}</option>
              ))}
            </select>
          </label>

          <label>
            Related cleaning task
            <select value={form.cleaning_task_id} onChange={set('cleaning_task_id')}>
              <option value="">No cleaning link</option>
              {filteredCleaningTasks.map((task) => (
                <option key={task.id} value={task.id}>{task.property || 'Cleaning task'} · {task.scheduledFor || task.scheduled_for || 'date not set'}</option>
              ))}
            </select>
          </label>

          <label>
            Related maintenance work order
            <select value={form.maintenance_work_order_id} onChange={set('maintenance_work_order_id')}>
              <option value="">No maintenance link</option>
              {filteredMaintenance.map((workOrder) => (
                <option key={workOrder.id} value={workOrder.id}>{workOrder.title || 'Work order'} · {workOrder.status || 'reported'}</option>
              ))}
            </select>
          </label>

          <label>
            Vendor/contact link
            <select value={form.contact_id} onChange={set('contact_id')}>
              <option value="">No contact link</option>
              {vendorContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name || contact.fullName || contact.full_name}</option>
              ))}
            </select>
          </label>

          <label className="full">
            Notes
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting || !app.currentWorkspace?.id} data-skip-create-action="true">
          {submitting ? 'Saving…' : 'Save expense'}
        </button>
      </footer>
    </form>
  );
}

function ReportForm({ app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const properties = (app.data.properties || []).filter((property) => property.status !== 'archived');
  const ownerContacts = (app.data.contacts || []).filter((contact) => contact.contact_type === 'owner');
  const owners = ownerMembers(app.data.members || []);
  const ownerIds = new Set(owners.map((owner) => owner.user_id || owner.userId || owner.id).filter(Boolean));
  const ownerContactIds = new Set(ownerContacts.map((contact) => contact.id));

  const [form, setForm] = React.useState({
    title: '',
    report_type: 'owner_statement',
    status: 'draft',
    property_id: firstPropertyId(properties),
    owner_id: '',
    contact_id: '',
    start_date: today(),
    end_date: today(),
    notes: '',
  });

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError('');

    if (!app.currentWorkspace?.id) {
      setError('Select or create a workspace before saving a report.');
      return;
    }

    if (!properties.length) {
      setError('Add a real property before creating a report record.');
      return;
    }

    if (!form.property_id || !findProperty(properties, form.property_id)) {
      setError('Select an existing property in this workspace before saving the report.');
      return;
    }

    if (!isAllowedValue(form.report_type, reportTypeOptions)) {
      setError('Select a valid report type.');
      return;
    }

    if (!isAllowedValue(form.status, reportStatusOptions)) {
      setError('Select a valid report status.');
      return;
    }

    if (form.owner_id && !ownerIds.has(form.owner_id)) {
      setError('Selected owner must be an active Property Owner member in this workspace.');
      return;
    }

    if (form.contact_id && !ownerContactIds.has(form.contact_id)) {
      setError('Selected owner contact must be an owner contact in this workspace.');
      return;
    }

    let startDate = '';
    let endDate = '';
    try {
      startDate = cleanDateOrNull(form.start_date, 'Start date');
      endDate = cleanDateOrNull(form.end_date, 'End date');
    } catch (error) {
      setError(error.message);
      return;
    }

    if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
      setError('End date must be on or after start date.');
      return;
    }

    try {
      setSubmitting(true);

      await runAppAction(app, ['createReport', 'createOwnerReport'], {
        title: form.title.trim() || 'Owner report',
        report_type: form.report_type,
        status: form.status,
        property_id: form.property_id,
        owner_id: form.owner_id || null,
        contact_id: form.contact_id || null,
        start_date: startDate,
        end_date: endDate,
        notes: form.notes.trim() || null,
      });

      await refreshAfterSave(app);
      notifySuccess('Report record saved. PDF/CSV export generation is still disabled.');
      close();
    } catch (error) {
      setError(error?.message || 'Report could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <WorkspaceBlockedNotice app={app} />

        <EmptyDependencyNotice message="This saves only report metadata from real workspace records. PDF/CSV export and scheduled generation remain disabled." />

        {!properties.length && (
          <EmptyDependencyNotice message="Add your first property before creating owner or finance report records." />
        )}

        <div className="form-grid">
          <label>
            Report title
            <input value={form.title} onChange={set('title')} placeholder="Monthly owner statement" />
          </label>

          <label>
            Report type
            <select value={form.report_type} onChange={set('report_type')}>
              <OptionList options={reportTypeOptions} />
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              <OptionList options={reportStatusOptions} />
            </select>
          </label>

          <label>
            Property
            <select value={form.property_id} onChange={set('property_id')} required>
              <PropertyOptions properties={properties} emptyLabel="No properties available" />
            </select>
          </label>

          <label>
            Owner member
            <select value={form.owner_id} onChange={set('owner_id')}>
              <MemberOptions members={owners} fallbackLabel="No owner member" />
            </select>
          </label>

          <label>
            Owner contact
            <select value={form.contact_id} onChange={set('contact_id')}>
              <ContactOptions contacts={ownerContacts} />
            </select>
          </label>

          <label>
            Start date
            <input type="date" value={form.start_date} onChange={set('start_date')} required />
          </label>

          <label>
            End date
            <input type="date" value={form.end_date} onChange={set('end_date')} required />
          </label>

          <label className="full">
            Summary / notes
            <textarea rows={4} value={form.notes} onChange={set('notes')} placeholder="Optional summary from real records. Not a finalized tax or accounting statement." />
          </label>
        </div>
      </div>

      <footer className="modal-actions">
        <button type="button" onClick={close} disabled={submitting} data-skip-create-action="true">
          Cancel
        </button>
        <button className="primary" type="submit" disabled={submitting || !app.currentWorkspace?.id || !properties.length} data-skip-create-action="true">
          {submitting ? 'Saving…' : 'Save report record'}
        </button>
      </footer>
    </form>
  );
}

function CreateForm({ action, app, close, submitting, setSubmitting, setError, notifySuccess }) {
  const sharedProps = { app, close, submitting, setSubmitting, setError, notifySuccess };

  if (!canOpenCreateAction(app, action)) {
    return (
      <div className="modal-body">
        <EmptyDependencyNotice message="Your current workspace role cannot create this type of record. Ask a workspace owner or property manager for access." />
      </div>
    );
  }

  if (action === 'property') return <PropertyForm {...sharedProps} />;
  if (action === 'booking') return <BookingForm {...sharedProps} />;
  if (action === 'lease') return <LeaseForm {...sharedProps} />;
  if (action === 'cleaning') return <CleaningForm {...sharedProps} />;
  if (action === 'maintenance') return <MaintenanceForm {...sharedProps} />;
  if (action === 'owner') return <ContactForm {...sharedProps} type="owner" />;
  if (action === 'guest') return <ContactForm {...sharedProps} type="guest" />;
  if (action === 'invite') return <InviteForm {...sharedProps} />;
  if (action === 'expense') return <ExpenseForm {...sharedProps} />;
  if (action === 'report') return <ReportForm {...sharedProps} />;

  return (
    <div className="modal-body">
      <EmptyDependencyNotice message="This create action is not available yet." />
    </div>
  );
}

function getTextFromElement(element) {
  return normalizeText(
    [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.dataset?.createAction,
      element.textContent,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function shouldIgnoreClickTarget(target) {
  const element = target?.closest?.('button, a, [role="button"]');

  if (!element) return true;
  if (element.closest('.modal-panel')) return true;
  if (element.closest('form')) return true;
  if (element.dataset.skipCreateAction === 'true') return true;
  if (element.getAttribute('type') === 'submit') return true;
  if (element.hasAttribute('disabled')) return true;

  const href = element.getAttribute('href');
  if (href && href !== '#' && !href.toLowerCase().startsWith('javascript:')) {
    return true;
  }

  return false;
}

export function CreateActionProvider({ children }) {
  const app = useApp();
  const [action, setAction] = React.useState(null);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const notifySuccess = React.useCallback((message) => {
    setToast({ id: Date.now(), message });
  }, []);

  React.useEffect(() => {
    if (!toast) return undefined;

    const timeout = window.setTimeout(() => setToast(null), 4000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const openCreateAction = React.useCallback(
    (nextAction) => {
      if (!nextAction) return;

      if (!canOpenCreateAction(app, nextAction)) {
        setToast(null);
        setError('Your current workspace role cannot use this create action.');
        setSubmitting(false);
        setAction(nextAction);
        return;
      }

      setError('');
      setSubmitting(false);
      setAction(nextAction);
    },
    [app],
  );

  const close = React.useCallback(() => {
    if (submitting) return;

    setAction(null);
    setError('');
  }, [submitting]);

  React.useEffect(() => {
    const handleClick = (event) => {
      if (shouldIgnoreClickTarget(event.target)) return;

      const element = event.target.closest('button, a, [role="button"]');
      const directAction = element?.dataset?.createAction;
      const matchedAction = directAction || getActionFromLabel(getTextFromElement(element));

      if (!matchedAction) return;

      event.preventDefault();
      event.stopPropagation();

      openCreateAction(matchedAction);
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [openCreateAction]);

  const contextValue = React.useMemo(
    () => ({
      openCreateAction,
      closeCreateAction: close,
      activeCreateAction: action,
    }),
    [action, close, openCreateAction],
  );

  return (
    <CreateActionContext.Provider value={contextValue}>
      {children}

      {toast && (
        <div className="create-action-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {action && (
        <ModalShell action={action} error={error} onClose={close} submitting={submitting}>
          <CreateForm
            action={action}
            app={app}
            close={close}
            submitting={submitting}
            setSubmitting={setSubmitting}
            setError={setError}
            notifySuccess={notifySuccess}
          />
        </ModalShell>
      )}
    </CreateActionContext.Provider>
  );
}

export function useCreateAction() {
  const context = React.useContext(CreateActionContext);

  if (!context) {
    throw new Error('useCreateAction must be used inside CreateActionProvider.');
  }

  return context;
}
