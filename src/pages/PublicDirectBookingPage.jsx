import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Home,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { navigate } from '../routes/AppRouter.jsx';
import { formatCurrency } from '../lib/formatters.js';

const initialForm = {
  inquiry_type: 'booking_request',
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  check_in: '',
  check_out: '',
  guest_count: '1',
  message: '',
};

function getSlugFromPath() {
  return decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '').trim().toLowerCase();
}

function dateDiffNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(diff) ? diff : 0;
}

function rangesOverlap(start, end, blockedStart, blockedEnd) {
  return Boolean(start && end && blockedStart && blockedEnd && start < blockedEnd && end > blockedStart);
}

function normalizePage(row) {
  if (!row) return null;

  return {
    ...row,
    propertyName: row.property_name || row.page_title || 'Direct booking property',
    propertyType: row.property_type,
    checkInInstructions: row.check_in_instructions,
    cancellationPolicy: row.cancellation_policy,
    bookingMode: row.booking_mode,
    paymentMode: row.payment_mode,
    allowBookingRequests: row.allow_booking_requests,
    allowInquiries: row.allow_inquiries,
    requireGuestPhone: row.require_guest_phone,
    requireGuestMessage: row.require_guest_message,
    minNights: row.min_nights || 1,
    maxNights: row.max_nights,
    baseRate: row.base_rate,
    cleaningFee: row.cleaning_fee,
    squareFeet: row.square_feet,
  };
}

function validateForm(form, page, unavailableRanges) {
  const errors = [];
  const isBookingRequest = form.inquiry_type === 'booking_request';

  if (!form.guest_name.trim()) errors.push('Guest name is required.');
  if (!/^\S+@\S+\.\S+$/.test(form.guest_email.trim())) errors.push('A valid email address is required.');
  if (page.requireGuestPhone && !form.guest_phone.trim()) errors.push('Phone number is required for this property.');
  if (page.requireGuestMessage && !form.message.trim()) errors.push('Message is required for this property.');

  if (isBookingRequest) {
    if (!form.check_in) errors.push('Check-in date is required.');
    if (!form.check_out) errors.push('Check-out date is required.');
    if (form.check_in && form.check_out && form.check_out <= form.check_in) errors.push('Check-out must be after check-in.');

    const nights = dateDiffNights(form.check_in, form.check_out);
    if (nights > 0 && nights < page.minNights) errors.push(`Minimum stay is ${page.minNights} night${page.minNights === 1 ? '' : 's'}.`);
    if (page.maxNights && nights > page.maxNights) errors.push(`Maximum stay is ${page.maxNights} nights.`);

    const overlaps = unavailableRanges.some((range) => rangesOverlap(form.check_in, form.check_out, range.check_in, range.check_out));
    if (overlaps) errors.push('Those dates overlap an unavailable stay. Please choose different dates.');
  }

  const guests = Number(form.guest_count || 1);
  if (!Number.isInteger(guests) || guests < 1) errors.push('Guest count must be at least 1.');

  if (isBookingRequest && !page.allowBookingRequests) errors.push('Booking requests are currently paused for this property.');
  if (!isBookingRequest && !page.allowInquiries) errors.push('General inquiries are currently paused for this property.');

  return errors;
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <span className="public-booking-info-pill">
      <Icon size={16} />
      <strong>{label}</strong>
      <small>{value || 'Available on request'}</small>
    </span>
  );
}

function SuccessView({ page, onReset }) {
  return (
    <div className="public-page public-booking-page">
      <nav className="public-nav public-booking-nav">
        <strong>PropFlow</strong>
        <button type="button" onClick={() => navigate('/')}>Home</button>
      </nav>
      <section className="public-booking-success-wrap">
        <div className="auth-card wide public-booking-success-card">
          <EmptyState
            eyebrow="Request sent"
            icon={CheckCircle2}
            title="Your request was sent."
            description="Your request was sent. The property manager will review and confirm availability."
            action={<button type="button" className="primary" onClick={onReset}>Send another request</button>}
            secondaryAction={<button type="button" onClick={() => navigate(`/book/${page.slug}`)}>Back to property</button>}
          />
        </div>
      </section>
    </div>
  );
}

export function PublicDirectBookingPage() {
  const slug = getSlugFromPath();
  const [page, setPage] = React.useState(null);
  const [unavailableRanges, setUnavailableRanges] = React.useState([]);
  const [form, setForm] = React.useState(initialForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState([]);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function loadPublicPage() {
      setLoading(true);
      setErrors([]);

      if (!isSupabaseConfigured || !slug) {
        if (mounted) {
          setPage(null);
          setLoading(false);
        }
        return;
      }

      const [{ data: pageRows, error: pageError }, { data: ranges, error: rangeError }] = await Promise.all([
        supabase.rpc('get_public_direct_booking_page', { target_slug: slug }),
        supabase.rpc('get_public_direct_booking_unavailable_ranges', { target_slug: slug }),
      ]);

      if (!mounted) return;

      if (pageError) setErrors([pageError.message || 'Public booking page could not be loaded.']);
      if (rangeError) console.warn('[PropFlow] Public unavailable date ranges could not be loaded', rangeError);

      setPage(normalizePage(Array.isArray(pageRows) ? pageRows[0] : pageRows));
      setUnavailableRanges(Array.isArray(ranges) ? ranges : []);
      setLoading(false);
    }

    loadPublicPage();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const nights = dateDiffNights(form.check_in, form.check_out);
  const quotedRate = page?.baseRate && nights > 0 ? Number(page.baseRate) * nights : null;
  const quotedCleaning = page?.cleaningFee ? Number(page.cleaningFee) : null;
  const quotedTotal = quotedRate !== null ? quotedRate + (quotedCleaning || 0) : null;
  const paymentPlaceholder = page && page.paymentMode !== 'none';

  const set = (key) => (event) => {
    setForm((value) => ({ ...value, [key]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!page || saving) return;

    const nextErrors = validateForm(form, page, unavailableRanges);
    setErrors(nextErrors);
    if (nextErrors.length) return;

    setSaving(true);

    const payload = {
      workspace_id: page.workspace_id,
      property_id: page.property_id,
      direct_booking_page_id: page.id,
      inquiry_type: form.inquiry_type,
      status: 'new',
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email.trim().toLowerCase(),
      guest_phone: form.guest_phone.trim() || null,
      check_in: form.inquiry_type === 'booking_request' ? form.check_in : null,
      check_out: form.inquiry_type === 'booking_request' ? form.check_out : null,
      guest_count: Number(form.guest_count || 1),
      message: form.message.trim() || null,
      quoted_rate: quotedRate,
      quoted_cleaning_fee: quotedCleaning,
      quoted_total: quotedTotal,
      currency: page.currency || null,
      source: 'direct_booking_page',
      metadata: {},
    };

    const { error: insertError } = await supabase.from('direct_booking_requests').insert(payload);

    setSaving(false);

    if (insertError) {
      const message = String(insertError.message || '').toLowerCase();
      const friendlyMessage = message.includes('row-level security') || message.includes('violates')
        ? 'Request could not be sent because the dates, stay rules, or page availability no longer pass server validation. Refresh the page and choose different dates.'
        : insertError.message || 'Request could not be sent. Please try again.';
      setErrors([friendlyMessage]);
      return;
    }

    setSubmitted(true);
  }

  if (submitted && page) {
    return <SuccessView page={page} onReset={() => { setForm(initialForm); setErrors([]); setSubmitted(false); }} />;
  }

  if (loading) {
    return (
      <div className="public-page public-booking-page">
        <div className="public-booking-loading"><Loader2 className="spin" size={24} /> Loading public booking page…</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="public-page public-booking-page">
        <nav className="public-nav public-booking-nav"><strong>PropFlow</strong><button type="button" onClick={() => navigate('/')}>Home</button></nav>
        <section className="public-booking-success-wrap">
          <div className="auth-card wide">
            <EmptyState
              eyebrow="Direct booking"
              icon={AlertTriangle}
              title="This booking page is not available"
              description="The property manager may have unpublished, paused, archived, or not yet configured this direct booking page."
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="public-page public-booking-page">
      <nav className="public-nav public-booking-nav">
        <strong>PropFlow</strong>
        <div><button type="button" onClick={() => navigate('/')}>Home</button></div>
      </nav>

      <main className="public-booking-shell">
        <section className="public-booking-hero public-direct-booking-hero">
          <div>
            <p className="eyebrow">Direct booking request</p>
            <h1>{page.headline || page.page_title || page.propertyName}</h1>
            <p>{page.description || 'Send a request directly to the property manager. Availability and payment instructions are confirmed after review.'}</p>
            <div className="hero-actions">
              <StatusBadge tone="warning">Manual approval</StatusBadge>
              <StatusBadge tone="info">Availability subject to confirmation</StatusBadge>
            </div>
          </div>
          <div className="public-booking-visual" aria-label="Property image placeholder">
            <Home size={44} />
            <span>No public property photos are exposed from private operational storage.</span>
          </div>
        </section>

        <section className="public-booking-content-grid">
          <div className="public-booking-main-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Property</p>
                  <h2>{page.propertyName}</h2>
                  <p>{[page.city, page.country].filter(Boolean).join(', ') || 'Location shared by manager'}</p>
                </div>
              </div>
              <div className="public-booking-metadata-grid">
                <InfoPill icon={MapPin} label="Type" value={String(page.propertyType || '').replaceAll('_', ' ')} />
                <InfoPill icon={Users} label="Layout" value={[page.bedrooms && `${page.bedrooms} bed`, page.bathrooms && `${page.bathrooms} bath`].filter(Boolean).join(' · ')} />
                <InfoPill icon={CalendarDays} label="Stay rules" value={`${page.minNights || 1}+ night minimum${page.maxNights ? ` · ${page.maxNights} max` : ''}`} />
                <InfoPill icon={CreditCard} label="Rate" value={page.baseRate ? `${formatCurrency(page.baseRate, page.currency)} / night` : 'Quote after review'} />
              </div>
            </section>

            <section className="card public-booking-safety-notice">
              <div className="card-header">
                <div>
                  <p className="eyebrow">Safe direct booking</p>
                  <h3>Request first, confirmation after review</h3>
                  <p>Public pages expose only safe property and page fields. Existing bookings are used only as unavailable date ranges without guest names or private details.</p>
                </div>
                <LockKeyhole size={20} className="muted" />
              </div>
              <div className="public-booking-safety-grid">
                <span><ShieldCheck size={16} /><strong>Manager review</strong><small>Requests do not become internal bookings until converted.</small></span>
                <span><CalendarDays size={16} /><strong>Availability</strong><small>Unavailable ranges are blocked when detected; confirmation is still manual.</small></span>
                <span><CreditCard size={16} /><strong>Payment</strong><small>{paymentPlaceholder ? 'Online payment is not active yet. The property manager will confirm payment instructions after review.' : 'No online payment is collected on this page.'}</small></span>
              </div>
            </section>

            {(page.house_rules || page.checkInInstructions || page.cancellationPolicy) && (
              <section className="card public-booking-copy-card">
                <p className="eyebrow">Before you request</p>
                {page.house_rules && <><h3>House rules</h3><p>{page.house_rules}</p></>}
                {page.checkInInstructions && <><h3>Check-in</h3><p>{page.checkInInstructions}</p></>}
                {page.cancellationPolicy && <><h3>Cancellation</h3><p>{page.cancellationPolicy}</p></>}
              </section>
            )}
          </div>

          <aside className="card public-booking-form-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Request availability</p>
                <h2>Send booking request</h2>
                <p>Online payment is not active yet. The property manager will confirm payment instructions after review.</p>
              </div>
              <Mail size={20} className="muted" />
            </div>

            {errors.length > 0 && (
              <div className="modal-error"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>
            )}

            <form className="modal-form" onSubmit={handleSubmit}>
              <label>Inquiry type
                <select value={form.inquiry_type} onChange={set('inquiry_type')}>
                  {page.allowBookingRequests && <option value="booking_request">Booking request</option>}
                  {page.allowInquiries && <option value="general_inquiry">General inquiry</option>}
                </select>
              </label>
              <label>Full name<input value={form.guest_name} onChange={set('guest_name')} placeholder="Jane Guest" /></label>
              <label>Email<input type="email" value={form.guest_email} onChange={set('guest_email')} placeholder="jane@example.com" /></label>
              <label>Phone{page.requireGuestPhone ? ' *' : ''}<input value={form.guest_phone} onChange={set('guest_phone')} placeholder="+1 555 000 0000" /></label>

              {form.inquiry_type === 'booking_request' && (
                <div className="form-grid two">
                  <label>Check-in<input type="date" value={form.check_in} onChange={set('check_in')} /></label>
                  <label>Check-out<input type="date" value={form.check_out} onChange={set('check_out')} /></label>
                </div>
              )}

              <label>Guests<input type="number" min="1" value={form.guest_count} onChange={set('guest_count')} /></label>
              <label>Message{page.requireGuestMessage ? ' *' : ''}<textarea value={form.message} onChange={set('message')} rows="4" placeholder="Tell the manager anything helpful about your stay." /></label>

              {quotedTotal !== null && (
                <div className="helper">
                  Estimated total preview: <strong>{formatCurrency(quotedTotal, page.currency)}</strong>. Final pricing and payment instructions are confirmed by the manager.
                </div>
              )}

              <button type="submit" className="primary" disabled={saving}>{saving ? 'Sending…' : 'Send request for review'}</button>
              <small className="helper">Availability is subject to manager confirmation. No card details are collected.</small>
            </form>
          </aside>
        </section>
      </main>
    </div>
  );
}
