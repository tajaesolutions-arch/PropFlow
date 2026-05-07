import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Home,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { EmptyState } from '../components/EmptyState.jsx';
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

export function PublicBookingPage() {
  const propertySlug = getPropertySlugFromPath();
  const propertyName = formatPropertyName(propertySlug);

  const [form, setForm] = React.useState(initialForm);
  const [submitted, setSubmitted] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const set = (key) => (event) => {
    setForm((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (hasInvalidDateRange(form.checkIn, form.checkOut)) {
      setMessage('Check-out must be after check-in.');
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="public-page">
        <nav className="public-nav">
          <strong>PropFlow</strong>
          <div>
            <button type="button" onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </nav>

        <section className="auth-page">
          <div className="auth-card wide">
            <EmptyState
              title="Booking request submitted"
              description="The property manager will review your request and contact you with the next steps. Instant payment is not enabled on this direct booking page yet."
              action={
                <button type="button" className="primary" onClick={() => setSubmitted(false)}>
                  Submit another request
                </button>
              }
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="public-page">
      <nav className="public-nav">
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

      <section className="hero">
        <div>
          <p className="eyebrow">Direct booking request</p>
          <h1>{propertyName}</h1>
          <p>
            Submit a booking request directly to the property manager. Availability, pricing,
            approval, and payment will be confirmed manually before the booking is finalized.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary" onClick={() => document.getElementById('booking-request-form')?.scrollIntoView({ behavior: 'smooth' })}>
              Request booking
            </button>
            <button type="button" onClick={() => navigate('/')}>
              Learn about PropFlow
            </button>
          </div>
        </div>

        <aside className="hero-panel">
          <div className="feature-row">
            <MapPin size={18} />
            <span>
              <strong>Location</strong>
              <small>Managed by host</small>
            </span>
          </div>

          <div className="feature-row">
            <Users size={18} />
            <span>
              <strong>Guest details</strong>
              <small>Collected before approval</small>
            </span>
          </div>

          <div className="feature-row">
            <CalendarDays size={18} />
            <span>
              <strong>Availability</strong>
              <small>Reviewed manually</small>
            </span>
          </div>

          <div className="feature-row">
            <CreditCard size={18} />
            <span>
              <strong>Payment</strong>
              <small>Stripe checkout prepared for future phase</small>
            </span>
          </div>
        </aside>
      </section>

      <section className="page-content">
        <div className="panel-grid two">
          <section className="card" id="booking-request-form">
            <div className="card-header">
              <div>
                <h3>Booking request</h3>
                <p>
                  This creates a request only. Full instant booking, deposit payments, and Stripe
                  checkout should be connected in a later backend phase.
                </p>
              </div>
              <ShieldCheck size={20} />
            </div>

            {message && <div className="helper error-helper">{message}</div>}

            <form onSubmit={handleSubmit}>
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
                  />
                </label>
              </div>

              <div className="action-row">
                <button className="primary" type="submit">
                  Submit booking request
                </button>
              </div>
            </form>
          </section>

          <section className="card">
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
              This public page is a safe frontend foundation. It does not yet write to Supabase or
              charge the guest.
            </div>
          </section>
        </div>

        <div className="panel-grid two">
          <section className="card">
            <div className="card-header">
              <div>
                <h3>Guest communication</h3>
                <p>Recommended next backend step for direct booking requests.</p>
              </div>
              <Mail size={20} />
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
              <Home size={20} />
            </div>

            <div className="metadata-grid">
              <span>
                <MapPin size={16} />
                Location: host managed
              </span>
              <span>
                <Users size={16} />
                Guests: reviewed by host
              </span>
              <span>
                <CalendarDays size={16} />
                Availability: manual approval
              </span>
              <span>
                <CreditCard size={16} />
                Payment: pending backend setup
              </span>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
