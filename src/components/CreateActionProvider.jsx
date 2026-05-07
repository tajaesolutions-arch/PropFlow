import React from 'react';
import { X } from 'lucide-react';

import { useApp } from '../lib/AppContext.jsx';
import { currencies } from '../data/constants.js';

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
  { action: 'cleaning', labels: ['add cleaning task', 'new cleaning task', 'add cleaning', 'schedule cleaning'] },
  { action: 'maintenance', labels: ['add maintenance work order', 'add work order', 'new work order', 'add maintenance', 'report issue'] },
  { action: 'owner', labels: ['add owner', 'new owner'] },
  { action: 'guest', labels: ['add guest', 'new guest', 'add guest / crm', 'add contact'] },
  { action: 'invite', labels: ['invite team member', 'invite team', 'add team member', 'invite member'] },
  { action: 'expense', labels: ['add expense', 'new expense'] },
  { action: 'report', labels: ['add report', 'new report', 'create report'] },
];

const actionMeta = {
  property: {
    title: 'Add property',
    description: 'Create a real property record for the current workspace.',
  },
  booking: {
    title: 'Add booking',
    description: 'Create a short-term reservation and guest contact.',
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
    description: 'Send a workspace invite with a role assignment.',
  },
  expense: {
    title: 'Add expense',
    description: 'Capture expense details. Database save will be connected when finance tables are added.',
  },
  report: {
    title: 'Add report',
    description: 'Prepare report details. Database save will be connected when report generation is finalized.',
  },
};

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getActionFromLabel(label) {
  const normalizedLabel = normalizeText(label);
  if (!normalizedLabel) return null;

  return actionMatchers.find(({ labels }) => labels.some((item) => normalizedLabel === item || normalizedLabel.includes(item)))?.action || null;
}

function cleanNumber(value) {
  if (value === '' || value === null || value === undefined) return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function firstPropertyId(properties) {
  return properties?.[0]?.id || '';
}

function propertyCurrency(properties, workspace, propertyId) {
  return properties.find((property) => property.id === propertyId)?.currency || workspace?.defaultCurrency || workspace?.default_currency || 'USD';
}

function ModalShell({ action, error, children, onClose, submitting }) {
  const meta = actionMeta[action] || { title: 'Create record', description: 'Add a new workspace record.' };

  React.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-action-title">
        <header className="modal-header">
          <div>
            <h3 id="create-action-title">{meta.title}</h3>
            <p>{meta.description}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close modal" onClick={onClose} disabled={submitting}>
            <X size={18} />
          </button>
        </header>

        {error && <div className="modal-error" role="alert">{error}</div>}
        {children}
      </section>
    </div>
  );
}

function EmptyDependencyNotice({ message }) {
  return <div className="modal-warning" role="status">{message}</div>;
}

function PropertyForm({ app, close, submitting, setSubmitting, setError }) {
  const workspaceCurrency = app.currentWorkspace?.defaultCurrency || app.currentWorkspace?.default_currency || 'USD';
  const [form, setForm] = React.useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: app.currentWorkspace?.country || 'United States',
    property_type: 'short_term_rental',
    rental_type: 'short_term',
    currency: workspaceCurrency,
    nightly_rate: '',
    monthly_rent: '',
    status: 'active',
    bedrooms: '',
    bathrooms: '',
    square_feet: '',
    notes: '',
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Property name is required.');
    if (!form.address.trim()) return setError('Address or location is required.');

    try {
      setSubmitting(true);
      await app.createProperty({
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        country: form.country.trim() || null,
        nightly_rate: cleanNumber(form.nightly_rate),
        monthly_rent: cleanNumber(form.monthly_rent),
        bedrooms: cleanNumber(form.bedrooms),
        bathrooms: cleanNumber(form.bathrooms),
        square_feet: cleanNumber(form.square_feet),
        notes: form.notes.trim() || null,
      });
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
        <div className="form-grid">
          <label>Property name<input value={form.name} onChange={set('name')} required /></label>
          <label>Address/location<input value={form.address} onChange={set('address')} required /></label>
          <label>City<input value={form.city} onChange={set('city')} /></label>
          <label>State / parish<input value={form.state} onChange={set('state')} /></label>
          <label>Country<input value={form.country} onChange={set('country')} /></label>
          <label>Property type<select value={form.property_type} onChange={set('property_type')}><option value="short_term_rental">Short-term rental</option><option value="long_term_rental">Long-term rental</option><option value="villa">Villa</option><option value="apartment">Apartment</option><option value="house">House</option><option value="condo">Condo</option><option value="commercial_property">Commercial property</option></select></label>
          <label>Rental type<select value={form.rental_type} onChange={set('rental_type')}><option value="short_term">Short term</option><option value="long_term">Long term</option><option value="both">Both</option></select></label>
          <label>Currency<select value={form.currency} onChange={set('currency')}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
          <label>Nightly rate<input type="number" min="0" step="0.01" value={form.nightly_rate} onChange={set('nightly_rate')} /></label>
          <label>Monthly rent<input type="number" min="0" step="0.01" value={form.monthly_rent} onChange={set('monthly_rent')} /></label>
          <label>Bedrooms<input type="number" min="0" value={form.bedrooms} onChange={set('bedrooms')} /></label>
          <label>Bathrooms<input type="number" min="0" step="0.5" value={form.bathrooms} onChange={set('bathrooms')} /></label>
          <label className="full">Notes<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save property'}</button></footer>
    </form>
  );
}

function BookingForm({ app, close, submitting, setSubmitting, setError }) {
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

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  React.useEffect(() => {
    if (!form.property_id) return;
    setForm((current) => ({ ...current, currency: current.currency || propertyCurrency(properties, app.currentWorkspace, current.property_id) }));
  }, [form.property_id, properties, app.currentWorkspace]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!properties.length) return setError('Add a property before creating a booking.');
    if (!form.property_id) return setError('Select a property before saving.');
    if (!form.guest_name.trim()) return setError('Guest name is required.');
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) return setError('Check-out must be after check-in.');

    try {
      setSubmitting(true);
      await app.createBooking({
        ...form,
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim() || null,
        guest_phone: form.guest_phone.trim() || null,
        guest_count: Number(form.guest_count || 1),
        total_amount: cleanNumber(form.total_amount),
        cleaning_fee: cleanNumber(form.cleaning_fee),
        taxes_fees: cleanNumber(form.taxes_fees),
        owner_payout: cleanNumber(form.owner_payout),
        notes: form.notes.trim() || null,
      });
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
        {!properties.length && <EmptyDependencyNotice message="Add a property before creating bookings." />}
        <div className="form-grid">
          <label>Guest name<input value={form.guest_name} onChange={set('guest_name')} required /></label>
          <label>Guest email<input type="email" value={form.guest_email} onChange={set('guest_email')} /></label>
          <label>Guest phone<input value={form.guest_phone} onChange={set('guest_phone')} /></label>
          <label>Property<select value={form.property_id} onChange={set('property_id')} required><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Check in<input type="date" value={form.check_in} onChange={set('check_in')} required /></label>
          <label>Check out<input type="date" value={form.check_out} onChange={set('check_out')} required /></label>
          <label>Guest count<input type="number" min="1" value={form.guest_count} onChange={set('guest_count')} /></label>
          <label>Source<select value={form.source} onChange={set('source')}><option value="manual">Manual</option><option value="direct">Direct</option><option value="airbnb">Airbnb</option><option value="booking_com">Booking.com</option><option value="vrbo">Vrbo</option><option value="other">Other</option></select></label>
          <label>Status<select value={form.status} onChange={set('status')}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="checked_in">Checked in</option><option value="checked_out">Checked out</option><option value="completed">Completed</option></select></label>
          <label>Payment status<select value={form.payment_status} onChange={set('payment_status')}><option value="unpaid">Unpaid</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></label>
          <label>Currency<select value={form.currency} onChange={set('currency')}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
          <label>Total amount<input type="number" min="0" step="0.01" value={form.total_amount} onChange={set('total_amount')} /></label>
          <label>Cleaning fee<input type="number" min="0" step="0.01" value={form.cleaning_fee} onChange={set('cleaning_fee')} /></label>
          <label>Taxes / fees<input type="number" min="0" step="0.01" value={form.taxes_fees} onChange={set('taxes_fees')} /></label>
          <label>Owner payout<input type="number" min="0" step="0.01" value={form.owner_payout} onChange={set('owner_payout')} /></label>
          <label className="inline-check full"><input type="checkbox" checked={form.auto_create_cleaning} onChange={set('auto_create_cleaning')} /> Auto-create checkout cleaning task</label>
          <label className="full">Notes<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save booking'}</button></footer>
    </form>
  );
}

function CleaningForm({ app, close, submitting, setSubmitting, setError }) {
  const properties = app.data.properties || [];
  const [form, setForm] = React.useState({ property_id: firstPropertyId(properties), scheduled_for: today(), status: 'scheduled', checklist_items: '', cleaner_notes: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!properties.length) return setError('Add a property before creating cleaning tasks.');
    if (!form.property_id) return setError('Select a property before saving.');
    if (!form.scheduled_for) return setError('Cleaning date is required.');

    try {
      setSubmitting(true);
      await app.createCleaningTask({
        property_id: form.property_id,
        scheduled_for: form.scheduled_for,
        status: form.status,
        checklist_items: form.checklist_items.split('\n').map((item) => item.trim()).filter(Boolean),
        cleaner_notes: form.cleaner_notes.trim() || null,
      });
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
        {!properties.length && <EmptyDependencyNotice message="Add a property before creating cleaning tasks." />}
        <div className="form-grid">
          <label>Property<select value={form.property_id} onChange={set('property_id')}><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Cleaning date<input type="date" value={form.scheduled_for} onChange={set('scheduled_for')} required /></label>
          <label>Status<select value={form.status} onChange={set('status')}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="needs_inspection">Needs inspection</option><option value="completed">Completed</option></select></label>
          <label className="full">Checklist items<textarea rows={4} value={form.checklist_items} onChange={set('checklist_items')} placeholder="One checklist item per line" /></label>
          <label className="full">Cleaner notes<textarea rows={3} value={form.cleaner_notes} onChange={set('cleaner_notes')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save cleaning task'}</button></footer>
    </form>
  );
}

function MaintenanceForm({ app, close, submitting, setSubmitting, setError }) {
  const properties = app.data.properties || [];
  const [form, setForm] = React.useState({ property_id: firstPropertyId(properties), title: '', issue_description: '', priority: 'medium', status: 'open', due_date: today(), estimated_cost: '', parts_needed: '', notes: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!properties.length) return setError('Add a property before creating maintenance work orders.');
    if (!form.property_id) return setError('Select a property before saving.');
    if (!form.title.trim()) return setError('Issue title is required.');

    try {
      setSubmitting(true);
      await app.createMaintenanceWorkOrder({
        property_id: form.property_id,
        title: form.title.trim(),
        issue_description: form.issue_description.trim() || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        estimated_cost: cleanNumber(form.estimated_cost),
        parts_needed: form.parts_needed.trim() || null,
        notes: form.notes.trim() || null,
      });
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
        {!properties.length && <EmptyDependencyNotice message="Add a property before creating maintenance work orders." />}
        <div className="form-grid">
          <label>Property<select value={form.property_id} onChange={set('property_id')}><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Issue title<input value={form.title} onChange={set('title')} required /></label>
          <label>Priority<select value={form.priority} onChange={set('priority')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          <label>Status<select value={form.status} onChange={set('status')}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_parts">Waiting for parts</option><option value="completed">Completed</option></select></label>
          <label>Due date<input type="date" value={form.due_date} onChange={set('due_date')} /></label>
          <label>Estimated cost<input type="number" min="0" step="0.01" value={form.estimated_cost} onChange={set('estimated_cost')} /></label>
          <label className="full">Issue description<textarea rows={3} value={form.issue_description} onChange={set('issue_description')} /></label>
          <label className="full">Parts needed<textarea rows={2} value={form.parts_needed} onChange={set('parts_needed')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save work order'}</button></footer>
    </form>
  );
}

function ContactForm({ app, close, submitting, setSubmitting, setError, type }) {
  const isOwner = type === 'owner';
  const [form, setForm] = React.useState({ full_name: '', email: '', phone: '', notes: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.full_name.trim()) return setError(`${isOwner ? 'Owner' : 'Guest'} name is required.`);

    try {
      setSubmitting(true);
      await app.upsertContact({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        contact_type: isOwner ? 'owner' : 'guest',
        notes: form.notes.trim() || null,
      });
      await app.refreshWorkspaceData?.();
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
        <div className="form-grid">
          <label>{isOwner ? 'Owner' : 'Guest'} name<input value={form.full_name} onChange={set('full_name')} required /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} /></label>
          <label className="full">Notes<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : `Save ${isOwner ? 'owner' : 'guest'}`}</button></footer>
    </form>
  );
}

function InviteForm({ app, close, submitting, setSubmitting, setError }) {
  const [form, setForm] = React.useState({ email: '', role: 'property_manager', expires_at: '', message: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email.trim()) return setError('Invitee email is required.');

    try {
      setSubmitting(true);
      await app.createInvite({
        email: form.email.trim(),
        roles: [form.role],
        expires_at: form.expires_at || null,
        message: form.message.trim() || null,
      });
      close();
    } catch (error) {
      setError(error?.message || 'Team invite could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="modal-form" onSubmit={submit} noValidate>
      <div className="modal-body">
        <div className="form-grid">
          <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>Role<select value={form.role} onChange={set('role')}><option value="workspace_owner">Workspace owner</option><option value="property_manager">Property manager</option><option value="host">Host</option><option value="property_owner">Property owner</option><option value="cleaner">Cleaner</option><option value="maintenance">Maintenance crew</option><option value="accountant">Accountant</option></select></label>
          <label>Invite expiration<input type="date" value={form.expires_at} onChange={set('expires_at')} /></label>
          <label className="full">Optional message<textarea rows={3} value={form.message} onChange={set('message')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Send invite'}</button></footer>
    </form>
  );
}

function PlaceholderForm({ close, action }) {
  const isExpense = action === 'expense';
  const [form, setForm] = React.useState({ title: '', amount: '', date: today(), notes: '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form className="modal-form" onSubmit={(event) => event.preventDefault()} noValidate>
      <div className="modal-body">
        <EmptyDependencyNotice message={`${isExpense ? 'Expense' : 'Report'} saving is intentionally blocked until the matching database table is connected. The modal opens now so the workflow is not broken.`} />
        <div className="form-grid">
          <label>{isExpense ? 'Expense title' : 'Report name'}<input value={form.title} onChange={set('title')} /></label>
          {isExpense && <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} /></label>}
          <label>Date<input type="date" value={form.date} onChange={set('date')} /></label>
          <label className="full">Notes<textarea rows={3} value={form.notes} onChange={set('notes')} /></label>
        </div>
      </div>
      <footer className="modal-actions"><button type="button" className="primary" onClick={close}>Close</button></footer>
    </form>
  );
}

function CreateActionModal({ action, app, close }) {
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => setError(''), [action]);

  const sharedProps = { app, close, submitting, setSubmitting, setError };

  return (
    <ModalShell action={action} error={error} onClose={close} submitting={submitting}>
      {action === 'property' && <PropertyForm {...sharedProps} />}
      {action === 'booking' && <BookingForm {...sharedProps} />}
      {action === 'cleaning' && <CleaningForm {...sharedProps} />}
      {action === 'maintenance' && <MaintenanceForm {...sharedProps} />}
      {action === 'owner' && <ContactForm {...sharedProps} type="owner" />}
      {action === 'guest' && <ContactForm {...sharedProps} type="guest" />}
      {action === 'invite' && <InviteForm {...sharedProps} />}
      {['expense', 'report'].includes(action) && <PlaceholderForm close={close} action={action} />}
    </ModalShell>
  );
}

export function CreateActionProvider({ children }) {
  const app = useApp();
  const [activeAction, setActiveAction] = React.useState(null);

  const openCreateAction = React.useCallback((action) => {
    if (!actionMeta[action]) return;
    setActiveAction(action);
  }, []);

  const closeCreateAction = React.useCallback(() => setActiveAction(null), []);

  React.useEffect(() => {
    const onDocumentClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a, [role="button"]') : null;
      if (!target) return;
      if (target.closest('.modal-backdrop')) return;
      if (target.dataset?.skipCreateAction === 'true') return;

      const action = target.dataset?.createAction || getActionFromLabel(target.getAttribute('aria-label') || target.textContent);
      if (!action || !actionMeta[action]) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openCreateAction(action);
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [openCreateAction]);

  const value = React.useMemo(() => ({ openCreateAction, closeCreateAction }), [openCreateAction, closeCreateAction]);

  return (
    <CreateActionContext.Provider value={value}>
      {children}
      {activeAction && <CreateActionModal action={activeAction} app={app} close={closeCreateAction} />}
    </CreateActionContext.Provider>
  );
}

export function useCreateAction() {
  const context = React.useContext(CreateActionContext);
  if (!context) throw new Error('useCreateAction must be used inside CreateActionProvider');
  return context;
}
