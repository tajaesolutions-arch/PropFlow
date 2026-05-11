import React from 'react';
import { CalendarCheck, CheckCircle2, ClipboardCheck, Copy, CreditCard, ExternalLink, Globe2, Home, Inbox, PauseCircle, Plus, Search, XCircle } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { directBookingConfirmationModes, directBookingPageStatuses, directBookingPaymentModes, directBookingRequestStatuses, roles } from '../data/constants.js';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { FEATURE_KEYS, canUseFeature, getUpgradeMessage, getWorkspacePlan } from '../lib/planLimits.js';
import { navigate } from '../routes/AppRouter.jsx';

const managerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];
const labelMap = (pairs) => Object.fromEntries(pairs);
const pageStatusLabels = labelMap(directBookingPageStatuses);
const requestStatusLabels = labelMap(directBookingRequestStatuses);
const paymentModeLabels = labelMap(directBookingPaymentModes);
const bookingModeLabels = labelMap(directBookingConfirmationModes);

const emptyPageForm = {
  id: '',
  property_id: '',
  slug: '',
  status: 'draft',
  page_title: '',
  headline: '',
  description: '',
  house_rules: '',
  check_in_instructions: '',
  cancellation_policy: '',
  contact_email: '',
  contact_phone: '',
  booking_mode: 'manual_approval',
  payment_mode: 'none',
  allow_inquiries: true,
  allow_booking_requests: true,
  require_guest_phone: true,
  require_guest_message: false,
  min_nights: 1,
  max_nights: '',
  base_rate: '',
  cleaning_fee: '',
  currency: '',
};

function activeWorkspaceRoles(memberships = [], currentWorkspace = null) {
  const activeMembership = memberships.find((membership) => membership.workspace_id === currentWorkspace?.id && membership.status === 'active');
  return activeMembership?.roles || [];
}

function hasManagerRole(memberships, currentWorkspace) {
  const activeRoles = activeWorkspaceRoles(memberships, currentWorkspace);
  return managerRoles.some((role) => activeRoles.includes(role));
}

function publicUrl(slug) {
  return `${window.location.origin}/book/${slug}`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toPageForm(page, properties, workspace) {
  if (!page) {
    const property = properties[0];
    return {
      ...emptyPageForm,
      property_id: property?.id || '',
      slug: slugify(property?.name || ''),
      currency: property?.currency || workspace?.defaultCurrency || workspace?.default_currency || 'USD',
    };
  }

  return {
    ...emptyPageForm,
    id: page.id,
    property_id: page.propertyId || page.property_id || '',
    slug: page.slug || '',
    status: page.status || 'draft',
    page_title: page.page_title || page.pageTitle || '',
    headline: page.headline || '',
    description: page.description || '',
    house_rules: page.house_rules || page.houseRules || '',
    check_in_instructions: page.check_in_instructions || page.checkInInstructions || '',
    cancellation_policy: page.cancellation_policy || page.cancellationPolicy || '',
    contact_email: page.contact_email || page.contactEmail || '',
    contact_phone: page.contact_phone || page.contactPhone || '',
    booking_mode: page.booking_mode || page.bookingMode || 'manual_approval',
    payment_mode: page.payment_mode || page.paymentMode || 'none',
    allow_inquiries: page.allow_inquiries ?? page.allowInquiries ?? true,
    allow_booking_requests: page.allow_booking_requests ?? page.allowBookingRequests ?? true,
    require_guest_phone: page.require_guest_phone ?? page.requireGuestPhone ?? true,
    require_guest_message: page.require_guest_message ?? page.requireGuestMessage ?? false,
    min_nights: page.min_nights || page.minNights || 1,
    max_nights: page.max_nights || page.maxNights || '',
    base_rate: page.base_rate ?? page.baseRate ?? '',
    cleaning_fee: page.cleaning_fee ?? page.cleaningFee ?? '',
    currency: page.currency || workspace?.defaultCurrency || workspace?.default_currency || 'USD',
  };
}

function getPropertyName(propertyId, properties) {
  return properties.find((property) => property.id === propertyId)?.name || 'Unassigned property';
}

function requestMatches(request, filters) {
  const query = filters.query.trim().toLowerCase();
  const haystack = [request.guestName, request.guestEmail, request.guestPhone, request.property].filter(Boolean).join(' ').toLowerCase();
  if (query && !haystack.includes(query)) return false;
  if (filters.status && request.status !== filters.status) return false;
  if (filters.propertyId && (request.propertyId || request.property_id) !== filters.propertyId) return false;
  if (filters.start && (request.checkIn || request.check_in || '') < filters.start) return false;
  if (filters.end && (request.checkIn || request.check_in || '') > filters.end) return false;
  return true;
}

function pageMatches(page, filters) {
  if (filters.pageStatus && page.status !== filters.pageStatus) return false;
  if (filters.propertyId && (page.propertyId || page.property_id) !== filters.propertyId) return false;
  return true;
}

export function DirectBookingsPage() {
  const {
    currentWorkspace,
    memberships,
    data,
    createOrUpdateDirectBookingPage,
    archiveDirectBookingPage,
    reviewDirectBookingRequest,
    convertDirectBookingRequestToBooking,
  } = useApp();

  const properties = data.properties || [];
  const pages = data.directBookingPages || [];
  const requests = data.directBookingRequests || [];
  const canManage = hasManagerRole(memberships, currentWorkspace);
  const workspacePlan = getWorkspacePlan(data.subscription, currentWorkspace);
  const directBookingAccess = canUseFeature(currentWorkspace, FEATURE_KEYS.DIRECT_BOOKING_PAGES, data.subscription);
  const directBookingLocked = !directBookingAccess.allowed;
  const [filters, setFilters] = React.useState({ query: '', status: '', propertyId: '', pageStatus: '', start: '', end: '' });
  const [form, setForm] = React.useState(toPageForm(null, properties, currentWorkspace));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [declineReasons, setDeclineReasons] = React.useState({});

  React.useEffect(() => {
    setForm((value) => (value.property_id ? value : toPageForm(null, properties, currentWorkspace)));
  }, [properties, currentWorkspace]);

  const filteredPages = pages.filter((page) => pageMatches(page, filters));
  const filteredRequests = requests.filter((request) => requestMatches(request, filters));
  const publishedCount = pages.filter((page) => page.status === 'published').length;
  const newRequestCount = requests.filter((request) => request.status === 'new').length;
  const approvedCount = requests.filter((request) => request.status === 'approved').length;

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePropertyChange(propertyId) {
    const property = properties.find((item) => item.id === propertyId);
    setForm((current) => ({
      ...current,
      property_id: propertyId,
      slug: current.id ? current.slug : slugify(property?.name || ''),
      currency: property?.currency || currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD',
    }));
  }

  async function savePage(event) {
    event.preventDefault();
    if (directBookingLocked) {
      setError(directBookingAccess.message || getUpgradeMessage(FEATURE_KEYS.DIRECT_BOOKING_PAGES, workspacePlan.key));
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const saved = await createOrUpdateDirectBookingPage(form);
      setForm(toPageForm(saved, properties, currentWorkspace));
      setMessage('Direct booking page settings saved.');
    } catch (saveError) {
      setError(saveError.message || 'Direct booking page could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, successMessage) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError.message || 'Action could not be completed.');
    }
  }

  const pageColumns = [
    { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(row.propertyId || row.property_id, properties) },
    { key: 'slug', label: 'Public link', render: (row) => <button type="button" className="link-button" onClick={() => navigator.clipboard?.writeText(publicUrl(row.slug))}><Copy size={14} /> /book/{row.slug}</button> },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge>{pageStatusLabels[row.status] || row.status}</StatusBadge> },
    { key: 'bookingMode', label: 'Booking mode', render: (row) => bookingModeLabels[row.bookingMode || row.booking_mode] || row.booking_mode },
    { key: 'paymentMode', label: 'Payment mode', render: (row) => paymentModeLabels[row.paymentMode || row.payment_mode] || row.payment_mode },
    { key: 'rate', label: 'Rate', render: (row) => row.baseRate || row.base_rate ? formatCurrency(row.baseRate || row.base_rate, row.currency) : 'Quote after review' },
    { key: 'cleaningFee', label: 'Cleaning fee', render: (row) => row.cleaningFee || row.cleaning_fee ? formatCurrency(row.cleaningFee || row.cleaning_fee, row.currency) : '—' },
    { key: 'publishedAt', label: 'Published', render: (row) => formatDate(row.publishedAt || row.published_at) },
    { key: 'requestCount', label: 'Requests', render: (row) => requests.filter((request) => (request.directBookingPageId || request.direct_booking_page_id) === row.id).length },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="direct-booking-table-actions">
          <button type="button" onClick={() => setForm(toPageForm(row, properties, currentWorkspace))}>Edit</button>
          <button type="button" onClick={() => window.open(`/book/${row.slug}`, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} /> Open</button>
          {canManage && row.status !== 'archived' && <button type="button" onClick={() => runAction(() => archiveDirectBookingPage(row.id, true), 'Direct booking page archived.')}>Archive</button>}
        </div>
      ),
    },
  ];

  const requestColumns = [
    { key: 'guestName', label: 'Guest', render: (row) => <span><strong>{row.guestName || row.guest_name}</strong><br /><small>{row.guestEmail || row.guest_email}</small></span> },
    { key: 'phone', label: 'Phone', render: (row) => row.guestPhone || row.guest_phone || '—' },
    { key: 'property', label: 'Property', render: (row) => row.property || getPropertyName(row.propertyId || row.property_id, properties) },
    { key: 'dates', label: 'Dates', render: (row) => `${formatDate(row.checkIn || row.check_in)} → ${formatDate(row.checkOut || row.check_out)}` },
    { key: 'guestCount', label: 'Guests', render: (row) => row.guestCount || row.guest_count || 1 },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge>{requestStatusLabels[row.status] || row.status}</StatusBadge> },
    { key: 'total', label: 'Quote', render: (row) => row.quotedTotal || row.quoted_total ? formatCurrency(row.quotedTotal || row.quoted_total, row.currency) : '—' },
    { key: 'submitted', label: 'Submitted', render: (row) => formatDate(row.createdAt || row.created_at) },
    { key: 'message', label: 'Message', render: (row) => <small>{String(row.message || '—').slice(0, 90)}</small> },
    {
      key: 'actions',
      label: 'Review',
      render: (row) => (
        <div className="direct-booking-review-actions">
          <button type="button" onClick={() => runAction(() => reviewDirectBookingRequest(row.id, 'under_review'), 'Request marked under review.')}>Review</button>
          <button type="button" onClick={() => runAction(() => reviewDirectBookingRequest(row.id, 'approved'), 'Request approved.')}>Approve</button>
          <input
            aria-label="Decline reason"
            placeholder="Decline reason"
            value={declineReasons[row.id] || ''}
            onChange={(event) => setDeclineReasons((value) => ({ ...value, [row.id]: event.target.value }))}
          />
          <button type="button" onClick={() => runAction(() => reviewDirectBookingRequest(row.id, 'declined', { decline_reason: declineReasons[row.id] }), 'Request declined.')}>Decline</button>
          <button type="button" className="primary" onClick={() => runAction(() => convertDirectBookingRequestToBooking(row.id), 'Request converted into an internal pending booking.')}>Convert</button>
        </div>
      ),
    },
  ];

  if (!canManage) {
    return (
      <AppLayout title="Direct Bookings" subtitle="Public booking request management">
        <EmptyState
          eyebrow="Role restricted"
          icon={LockIcon}
          title="Direct booking management is restricted"
          description="Workspace Owners, Property Managers, and Hosts can manage public booking pages and review direct booking requests."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Direct Bookings" subtitle="Public booking pages, manual approval requests, and safe conversion workflow.">
      <section className="stats-grid">
        <StatCard label="Public pages" value={pages.length} icon={Globe2} subtitle={`${publishedCount} published`} />
        <StatCard label="New requests" value={newRequestCount} icon={Inbox} subtitle="Awaiting manager review" tone="warning" />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle2} subtitle="Ready to convert manually" tone="success" />
        <StatCard label="Payment mode" value="Placeholder" icon={CreditCard} subtitle="No live guest checkout" tone="warning" />
      </section>

      {(message || error) && <section className={error ? 'modal-error' : 'helper success-helper'}>{error || message}</section>}

      <section className="card direct-booking-setup-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Page setup</p>
            <h2>{form.id ? 'Edit direct booking page' : 'Create direct booking page'}</h2>
            <p>Manual approval is the safe default. Payment placeholders do not collect card details or call SaaS billing checkout.</p>
          </div>
          <button type="button" onClick={() => setForm(toPageForm(null, properties, currentWorkspace))} disabled={directBookingLocked} title={directBookingLocked ? getUpgradeMessage(FEATURE_KEYS.DIRECT_BOOKING_PAGES, workspacePlan.key) : undefined}><Plus size={16} /> New page</button>
        </div>

        {directBookingLocked ? (
          <EmptyState compact eyebrow="Locked feature" icon={LockIcon} title="Direct booking pages require Pro or Business" description={directBookingAccess.message || getUpgradeMessage(FEATURE_KEYS.DIRECT_BOOKING_PAGES, workspacePlan.key)} />
        ) : !properties.length ? (
          <EmptyState compact eyebrow="Dependency" icon={Home} title="Create a property first" description="Direct booking pages are linked one-to-one with existing workspace properties." />
        ) : (
          <form className="modal-form direct-booking-form" onSubmit={savePage}>
            <div className="form-grid three">
              <label>Property
                <select value={form.property_id} onChange={(event) => handlePropertyChange(event.target.value)}>
                  <option value="">Select property</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </label>
              <label>Slug<input value={form.slug} onChange={(event) => updateForm('slug', event.target.value)} placeholder="beach-villa" /></label>
              <label>Status
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  {directBookingPageStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="form-grid two">
              <label>Page title<input value={form.page_title} onChange={(event) => updateForm('page_title', event.target.value)} /></label>
              <label>Headline<input value={form.headline} onChange={(event) => updateForm('headline', event.target.value)} /></label>
            </div>
            <label>Description<textarea rows="3" value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>

            <div className="form-grid three">
              <label>Booking mode
                <select value={form.booking_mode} onChange={(event) => updateForm('booking_mode', event.target.value)}>
                  {directBookingConfirmationModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Payment mode
                <select value={form.payment_mode} onChange={(event) => updateForm('payment_mode', event.target.value)}>
                  {directBookingPaymentModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Currency<input value={form.currency} onChange={(event) => updateForm('currency', event.target.value.toUpperCase())} /></label>
            </div>

            <div className="form-grid four">
              <label>Min nights<input type="number" min="1" value={form.min_nights} onChange={(event) => updateForm('min_nights', event.target.value)} /></label>
              <label>Max nights<input type="number" min="1" value={form.max_nights} onChange={(event) => updateForm('max_nights', event.target.value)} /></label>
              <label>Base rate<input value={form.base_rate} onChange={(event) => updateForm('base_rate', event.target.value)} /></label>
              <label>Cleaning fee<input value={form.cleaning_fee} onChange={(event) => updateForm('cleaning_fee', event.target.value)} /></label>
            </div>

            <div className="form-grid two">
              <label>Contact email<input type="email" value={form.contact_email} onChange={(event) => updateForm('contact_email', event.target.value)} /></label>
              <label>Contact phone<input value={form.contact_phone} onChange={(event) => updateForm('contact_phone', event.target.value)} /></label>
            </div>

            <div className="form-grid two">
              <label>House rules<textarea rows="2" value={form.house_rules} onChange={(event) => updateForm('house_rules', event.target.value)} /></label>
              <label>Cancellation policy<textarea rows="2" value={form.cancellation_policy} onChange={(event) => updateForm('cancellation_policy', event.target.value)} /></label>
            </div>
            <label>Check-in instructions<textarea rows="2" value={form.check_in_instructions} onChange={(event) => updateForm('check_in_instructions', event.target.value)} /></label>

            <div className="direct-booking-checkbox-grid">
              <label><input type="checkbox" checked={form.allow_booking_requests} onChange={(event) => updateForm('allow_booking_requests', event.target.checked)} /> Allow booking requests</label>
              <label><input type="checkbox" checked={form.allow_inquiries} onChange={(event) => updateForm('allow_inquiries', event.target.checked)} /> Allow general inquiries</label>
              <label><input type="checkbox" checked={form.require_guest_phone} onChange={(event) => updateForm('require_guest_phone', event.target.checked)} /> Require guest phone</label>
              <label><input type="checkbox" checked={form.require_guest_message} onChange={(event) => updateForm('require_guest_message', event.target.checked)} /> Require guest message</label>
            </div>

            <div className="modal-actions">
              <button type="submit" className="primary" disabled={saving || directBookingLocked}>{saving ? 'Saving…' : 'Save direct booking page'}</button>
              {form.slug && <button type="button" onClick={() => navigator.clipboard?.writeText(publicUrl(form.slug))}><Copy size={16} /> Copy public link</button>}
            </div>
          </form>
        )}
      </section>

      <section className="card direct-booking-filters-card">
        <div className="card-header"><div><p className="eyebrow">Filters</p><h2>Find pages and requests</h2></div><Search size={20} className="muted" /></div>
        <div className="direct-booking-filters">
          <label>Search<input value={filters.query} onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} placeholder="Guest name or email" /></label>
          <label>Property<select value={filters.propertyId} onChange={(event) => setFilters((value) => ({ ...value, propertyId: event.target.value }))}><option value="">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label>Request status<select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><option value="">All request statuses</option>{directBookingRequestStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Page status<select value={filters.pageStatus} onChange={(event) => setFilters((value) => ({ ...value, pageStatus: event.target.value }))}><option value="">All page statuses</option>{directBookingPageStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>From<input type="date" value={filters.start} onChange={(event) => setFilters((value) => ({ ...value, start: event.target.value }))} /></label>
          <label>To<input type="date" value={filters.end} onChange={(event) => setFilters((value) => ({ ...value, end: event.target.value }))} /></label>
        </div>
      </section>

      <section className="card">
        <div className="card-header"><div><p className="eyebrow">Public pages</p><h2>Direct booking pages</h2><p>Archived pages are soft-archived and are not public.</p></div><PauseCircle size={20} className="muted" /></div>
        <DataTable columns={pageColumns} rows={filteredPages} empty={{ eyebrow: 'No pages', title: 'No direct booking pages yet', description: 'Create and publish a page for an existing property to start collecting manual requests.' }} />
      </section>

      <section className="card">
        <div className="card-header"><div><p className="eyebrow">Review queue</p><h2>Booking requests</h2><p>Requests remain separate from internal bookings until a manager approves and converts them.</p></div><ClipboardCheck size={20} className="muted" /></div>
        <DataTable columns={requestColumns} rows={filteredRequests} empty={{ eyebrow: 'No requests', title: 'No direct booking requests yet', description: 'Public request submissions will appear here. No fake/demo direct booking requests are added.' }} />
      </section>
    </AppLayout>
  );
}

function LockIcon(props) {
  return <XCircle {...props} />;
}
