import React from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Home,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { navigate } from '../routes/AppRouter.jsx';

const initialForm = {
  guestName: '',
  email: '',
  phone: '',
  checkIn: '',
  checkOut: '',
  guests: '1',
  message: '',
};

function getPropertySlugFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}

function formatPropertyName(slug) {
  if (!slug) return 'Direct Booking';

  return slug
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasInvalidDateRange(checkIn, checkOut) {
  return Boolean(checkIn && checkOut && checkOut <= checkIn);
}

function validateForm(form) {
  const errors = [];

  if (!form.guestName.trim()) errors.push('Guest name is required.');
  if (!form.email.trim()) errors.push('Email address is required.');
  if (!form.checkIn) errors.push('Check-in date is required.');
  if (!form.checkOut) errors.push('Check-out date is required.');

  if (hasInvalidDateRange(form.checkIn, form.checkOut)) {
    errors.push('Check-out must be after check-in.');
  }

  const guests = Number(form.guests);

  if (!Number.isFinite(guests) || guests < 1) {
    errors.push('Guests must be at least 1.');
  }

  return errors;
}

function PublicFeature({ icon: Icon, title, description }) {
  return (
    <article className="public-booking-feature">
      <Icon size={18} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </article>
  );
}

function PublicBookingSafetyNotice() {
  return (
    <section className="card public-booking-safety-notice">
      <div className="card-header">
        <div>
          <p className="eyebrow">Direct booking safety</p>
          <h3>Public booking is placeholder-safe</h3>
          <p>
            This page does not expose private workspace records, does not confirm availability, does not create a booking, and does not charge guests.
          </p>
        </div>
        <LockKeyhole size={20} className="muted" />
      </div>

      <div className="public-booking-safety-grid">
        <span>
          <ShieldCheck size={16} />
          <strong>Manual approval default</strong>
          <small>Managers review requests before confirmation.</small>
          <StatusBadge tone="warning">approval required</StatusBadge>
        </span>

        <span>
          <CreditCard size={16} />
          <strong>Stripe payment</strong>
          <small>Checkout and payment links are not connected.</small>
          <StatusBadge tone="warning">not connected</StatusBadge>
        </span>

        <span>
          <AlertTriangle size={16} />
          <strong>Deposit / full payment</strong>
          <small>Payment rules are placeholders until backend billing is added.</small>
          <StatusBadge tone="info">placeholder</StatusBadge>
        </span>
      </div>
    </section>
  );
}

function SubmittedView({ propertyName, onReset }) {
  return (
    <div className="public-page public-booking-page">
      <nav className="public-nav public-booking-nav">
        <strong>PropFlow</strong>

        <div>
          <button type="button" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </nav>

      <section className="public-booking-success-wrap">
        <div className="auth-card wide public-booking-success-card">
          <EmptyState
            eyebrow="Request submitted"
            icon={CheckCircle2}
            title="Booking request submitted"
            description={`Your request for ${propertyName} was captured in this frontend-only flow. The property manager would review the request and contact you with next steps after backend request storage and notifications are connected. Instant payment is not enabled yet.`}
            action={
              <button type="button" className="primary" onClick={onReset}>
                Submit another request
              </button>
            }
            secondaryAction={
              <button type="button" onClick={() => navigate('/')}>
                Back to PropFlow
              </button>
            }
          />
        </div>
      </section>
    </div>
  );
}

export function PublicBookingPage() {
  const propertySlug = getPropertySlugFromPath();
  const propertyName = formatPropertyName(propertySlug);

  const [form, setForm] = React.useState(initialForm);
  const [submitted, setSubmitted] = React.useState(false);
  const [errors, setErrors] = React.useState([]);

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (nextErrors.length) return;

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <SubmittedView
        propertyName={propertyName}
        onReset={() => {
          setForm(initialForm);
          setErrors([]);
          setSubmitted(false);
        }}
      />
    );
  }

  return (
    <div className="public-page public-booking-page">
      <nav className="public-nav public-booking-nav">
        <strong>PropFlow</strong>

        <div>
          <button type="button" onClick={() => navigate('/')}>
            Home
          </button>

          <button type="button" className="primary" onClick={() => navigate('/pricing')}>
            Pricing
          </button>
        </div>
      </nav>

      <section className="public-booking-hero">
        <div>
          <p className="eyebrow">Direct booking request</p>
          <h1>{propertyName}</h1>
          <p>
            Submit a booking request directly to the property manager. Availability, pricing,
            approval, and payment will be confirmed before the booking is finalized.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="primary"
              onClick={() =>
                document
                  .getElementById('booking-request-form')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Request booking
            </button>

            <button type="button" onClick={() => navigate('/')}>
              Learn about PropFlow
            </button>
          </div>
        </div>

        <aside className="public-booking-hero-panel">
          <PublicFeature
            icon={MapPin}
            title="Location"
            description="Public location details should come from approved property settings later."
          />

          <PublicFeature
            icon={Users}
            title="Guest details"
            description="Guest information is collected before manager approval."
          />

          <PublicFeature
            icon={CalendarDays}
            title="Availability"
            description="MVP default is manual approval unless instant booking is enabled."
          />

          <PublicFeature
            icon={CreditCard}
            title="Payment"
            description="Stripe checkout should be connected through secure backend endpoints."
          />
        </aside>
      </section>

      <main className="page-content public-booking-content">
        <PublicBookingSafetyNotice />

        <section className="panel-grid two">
          <section className="card public-booking-request-card" id="booking-request-form">
            <div className="card-header">
              <div>
                <h3>Booking request</h3>
                <p>
                  This creates a request only. Full instant booking, deposit payments, Stripe
                  checkout, and Supabase booking-request storage should be connected in a backend
                  phase.
                </p>
              </div>

              <ShieldCheck size={20} className="muted" />
            </div>

            {errors.length > 0 && (
              <div className="helper error-helper" role="alert">
                <strong>Please fix these fields:</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid">
                <label>
                  Guest name
                  <input
                    required
                    type="text"
                    value={form.guestName}
                    onChange={set('guestName')}
                    placeholder="Full name"
                  />
                </label>

                <label>
                  Email address
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="name@example.com"
                  />
                </label>

                <label>
                  Phone number
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="Phone number"
                  />
                </label>

                <label>
                  Guests
                  <input
                    min="1"
                    type="number"
                    value={form.guests}
                    onChange={set('guests')}
                  />
                </label>

                <label>
                  Check-in
                  <input
                    required
                    type="date"
                    value={form.checkIn}
                    onChange={set('checkIn')}
                  />
                </label>

                <label>
                  Check-out
                  <input
                    required
                    type="date"
                    value={form.checkOut}
                    onChange={set('checkOut')}
                  />
                </label>

                <label className="full">
                  Message
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    placeholder="Questions, special requests, arrival time, or booking details"
                    rows={4}
                  />
                </label>
              </div>

              <div className="public-booking-form-actions">
                <button className="primary" type="submit">
                  Submit request placeholder
                </button>

                <small>
                  This page does not charge the guest yet. Payment should only be enabled after
                  Stripe backend checkout is connected.
                </small>
              </div>
            </form>
          </section>

          <section className="card public-booking-info-card">
            <div className="card-header">
              <div>
                <h3>How direct booking works</h3>
                <p>PropFlow’s MVP should default to manual approval unless instant booking is enabled.</p>
              </div>
            </div>

            <ul className="checklist">
              <li>
                <CheckCircle2 size={16} />
                Guest submits a booking request.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Property manager reviews availability and pricing.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Manager approves or declines the request.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Approved bookings can later trigger Stripe payment.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Confirmed bookings should sync into PropFlow bookings and calendar.
              </li>
            </ul>

            <div className="helper">
              Safe current behavior: this public page collects form input in the browser only. It
              does not write to Supabase, create a booking, send email, or charge the guest.
            </div>
          </section>
        </section>

        <section className="panel-grid two">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Guest communication</h3>
                <p>Recommended backend step for direct booking requests.</p>
              </div>

              <Mail size={20} className="muted" />
            </div>

            <ul className="checklist">
              <li>
                <CheckCircle2 size={16} />
                Save request to a booking_requests table.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Send confirmation email to the guest.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Notify workspace owner or property manager.
              </li>
              <li>
                <CheckCircle2 size={16} />
                Convert approved requests into bookings.
              </li>
            </ul>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Property details</h3>
                <p>Public property profile data should come from approved public property settings.</p>
              </div>

              <Home size={20} className="muted" />
            </div>

            <div className="public-booking-metadata-grid">
              <span>
                <MapPin size={16} />
                <strong>Location</strong>
                <small>Host-managed public display</small>
              </span>

              <span>
                <Users size={16} />
                <strong>Guests</strong>
                <small>Reviewed by host</small>
              </span>

              <span>
                <CalendarDays size={16} />
                <strong>Availability</strong>
                <small>Manual approval</small>
              </span>

              <span>
                <CreditCard size={16} />
                <strong>Payment</strong>
                <small>Pending backend setup</small>
              </span>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
