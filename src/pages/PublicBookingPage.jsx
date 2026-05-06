import React from 'react';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { EmptyState } from '../components/EmptyState.jsx';

export function PublicBookingPage() {
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="public-booking-page">
        <div className="public-booking-card">
          <EmptyState
            title="Booking request submitted"
            description="The property manager will review your request and contact you with the next steps."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="public-booking-page">
      <div className="public-booking-hero">
        <div className="public-booking-overlay">
          <h1>Direct Booking</h1>
          <p>Public booking request foundation for PropFlow.</p>
        </div>
      </div>

      <div className="public-booking-container">
        <section className="public-booking-card">
          <div className="booking-property-meta">
            <div><MapPin size={18} /> Jamaica</div>
            <div><Users size={18} /> Up to 4 guests</div>
            <div><CalendarDays size={18} /> Availability managed by host</div>
          </div>

          <h2>Booking Request</h2>
          <p>Instant payment is not enabled yet. Requests will be reviewed manually by the property manager.</p>

          <form className="booking-request-form" onSubmit={handleSubmit}>
            <label>
              Guest name
              <input required type="text" placeholder="Full name" />
            </label>

            <label>
              Email address
              <input required type="email" placeholder="name@example.com" />
            </label>

            <label>
              Phone number
              <input type="tel" placeholder="Phone number" />
            </label>

            <div className="booking-date-grid">
              <label>
                Check-in
                <input required type="date" />
              </label>

              <label>
                Check-out
                <input required type="date" />
              </label>
            </div>

            <label>
              Guests
              <input min="1" defaultValue="1" type="number" />
            </label>

            <label>
              Message
              <textarea rows="4" placeholder="Questions or special requests" />
            </label>

            <button className="primary" type="submit">
              Submit booking request
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
