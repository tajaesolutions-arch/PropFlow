import React from 'react';
import {
  CalendarCheck,
  Mail,
  Phone,
  Search,
  UserRound,
  Users,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { formatCurrency } from '../lib/formatters.js';

function getGuestName(booking) {
  return booking.guestName || booking.guest_name || 'Guest';
}

function getGuestEmail(booking) {
  return booking.guestEmail || booking.guest_email || '';
}

function getGuestPhone(booking) {
  return booking.guestPhone || booking.guest_phone || '';
}

function getBookingAmount(booking) {
  return Number(booking.totalAmount || booking.total_amount || booking.amount || 0);
}

function getPropertyName(booking) {
  return booking.property || 'Unassigned property';
}

function getCheckIn(booking) {
  return booking.checkIn || booking.check_in || '—';
}

function getCheckOut(booking) {
  return booking.checkOut || booking.check_out || '—';
}

function buildGuestRows(bookings, contacts, currency) {
  const guestMap = new Map();

  bookings.forEach((booking) => {
    const email = getGuestEmail(booking);
    const phone = getGuestPhone(booking);
    const name = getGuestName(booking);
    const key = email || phone || `${name}-${booking.id}`;

    const existing = guestMap.get(key) || {
      id: key,
      name,
      email,
      phone,
      bookings: 0,
      totalSpend: 0,
      lastStay: '',
      property: getPropertyName(booking),
      source: booking.source || 'manual',
      paymentStatus: booking.paymentStatus || booking.payment_status || 'unknown',
      status: 'active',
      currency: booking.currency || currency,
    };

    existing.bookings += 1;
    existing.totalSpend += getBookingAmount(booking);
    existing.lastStay = getCheckOut(booking) || getCheckIn(booking);
    existing.property = getPropertyName(booking);
    existing.paymentStatus = booking.paymentStatus || booking.payment_status || existing.paymentStatus;
    existing.source = booking.source || existing.source;

    guestMap.set(key, existing);
  });

  contacts
    .filter((contact) => contact.contact_type === 'guest' || contact.contactType === 'guest')
    .forEach((contact) => {
      const key = contact.email || contact.phone || contact.id;

      if (guestMap.has(key)) return;

      guestMap.set(key, {
        id: contact.id || key,
        name: contact.full_name || contact.fullName || 'Guest contact',
        email: contact.email || '',
        phone: contact.phone || '',
        bookings: 0,
        totalSpend: 0,
        lastStay: '—',
        property: '—',
        source: 'contact',
        paymentStatus: '—',
        status: contact.status || 'active',
        currency,
      });
    });

  return Array.from(guestMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}

export function GuestsPage() {
  const { data, currentWorkspace } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    source: 'all',
    paymentStatus: 'all',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const bookings = data.bookings || [];
  const contacts = data.contacts || [];

  const guestRows = buildGuestRows(bookings, contacts, currency);

  const totalGuests = guestRows.length;
  const repeatGuests = guestRows.filter((guest) => guest.bookings > 1).length;
  const guestRevenue = guestRows.reduce((sum, guest) => sum + guest.totalSpend, 0);
  const contactsOnly = guestRows.filter((guest) => guest.bookings === 0).length;

  const sources = [...new Set(guestRows.map((guest) => guest.source).filter(Boolean))];
  const paymentStatuses = [...new Set(guestRows.map((guest) => guest.paymentStatus).filter(Boolean))];

  const filteredGuests = guestRows
    .filter((guest) => filters.source === 'all' || guest.source === filters.source)
    .filter(
      (guest) =>
        filters.paymentStatus === 'all' || guest.paymentStatus === filters.paymentStatus,
    )
    .filter((guest) => {
      const searchText = [
        guest.name,
        guest.email,
        guest.phone,
        guest.property,
        guest.source,
        guest.paymentStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(filters.query.toLowerCase());
    });

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  return (
    <AppLayout title="Guests / CRM" subtitle="Guest contacts, booking history, direct booking leads, and CRM foundation">
      <div className="stat-grid dense">
        <StatCard label="Guest contacts" value={totalGuests} icon={Users} />
        <StatCard label="Repeat guests" value={repeatGuests} icon={UserRound} />
        <StatCard label="Guest revenue" value={formatCurrency(guestRevenue, currency)} icon={CalendarCheck} />
        <StatCard label="Contacts only" value={contactsOnly} icon={Mail} />
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h3>Guest CRM</h3>
            <p>
              Guest records are built from real bookings and guest contacts. Direct booking leads,
              message history, saved preferences, and automation can be added in a later CRM phase.
            </p>
          </div>
        </div>

        <div className="filter-bar booking-filter">
          <label>
            <span className="sr-only">Search guests</span>
            <div className="search-box">
              <Search size={16} />
              <input
                value={filters.query}
                onChange={setFilter('query')}
                placeholder="Search guest, email, phone, property, source, or payment status"
              />
            </div>
          </label>

          <select value={filters.source} onChange={setFilter('source')}>
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <select value={filters.paymentStatus} onChange={setFilter('paymentStatus')}>
            <option value="all">All payment statuses</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredGuests.length ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Guest list</h3>
              <p>{filteredGuests.length} guest record{filteredGuests.length === 1 ? '' : 's'} shown.</p>
            </div>
          </div>

          <DataTable
            rows={filteredGuests}
            columns={[
              {
                key: 'name',
                label: 'Guest',
                render: (row) => (
                  <span>
                    {row.name}
                    <br />
                    <small>{row.email || 'No email'}</small>
                  </span>
                ),
              },
              {
                key: 'phone',
                label: 'Phone',
                render: (row) => row.phone || '—',
              },
              {
                key: 'bookings',
                label: 'Bookings',
              },
              {
                key: 'totalSpend',
                label: 'Total spend',
                render: (row) => formatCurrency(row.totalSpend, row.currency),
              },
              {
                key: 'lastStay',
                label: 'Last stay',
              },
              {
                key: 'property',
                label: 'Last property',
              },
              {
                key: 'source',
                label: 'Source',
                render: (row) => <StatusBadge>{row.source}</StatusBadge>,
              },
              {
                key: 'paymentStatus',
                label: 'Payment',
                render: (row) => <StatusBadge>{row.paymentStatus}</StatusBadge>,
              },
            ]}
          />
        </section>
      ) : (
        <EmptyState
          title={guestRows.length ? 'No guests match the current filters.' : 'No guest records yet.'}
          description={
            guestRows.length
              ? 'Adjust your search, source, or payment-status filters.'
              : 'Guest CRM records will appear after bookings or guest contacts are added. No fake guest data is shown.'
          }
        />
      )}

      <div className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Guest CRM next phase</h3>
              <p>Recommended CRM features after bookings and contacts are stable.</p>
            </div>
          </div>

          <ul className="checklist">
            <li>
              <Mail size={16} />
              Guest message history
            </li>
            <li>
              <Phone size={16} />
              Guest phone and WhatsApp tracking
            </li>
            <li>
              <CalendarCheck size={16} />
              Repeat-guest booking history
            </li>
            <li>
              <UserRound size={16} />
              Guest preferences and notes
            </li>
            <li>
              <Mail size={16} />
              Direct booking inquiry follow-ups
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h3>Direct booking lead capture</h3>
              <p>Prepared for future public booking pages and inquiry forms.</p>
            </div>
          </div>

          <div className="helper">
            Direct booking pages should create guest contacts, booking requests, payment records,
            confirmation emails, and CRM follow-up tasks in a later backend phase.
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
