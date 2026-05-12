import React from 'react';
import {
  CalendarCheck,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { hasAnyRole } from '../lib/auth.js';
import { roles } from '../data/constants.js';
import { formatCurrency, formatDate } from '../lib/formatters.js';
import { navigate } from '../routes/AppRouter.jsx';

const guestManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER, roles.HOST];

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : '';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

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
  return toNumber(booking.totalAmount || booking.total_amount || booking.amount);
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyName(booking, properties = []) {
  const propertyId = getPropertyId(booking);
  const property = properties.find((item) => item.id === propertyId);

  return booking.property || property?.name || 'Unassigned property';
}

function getCheckIn(booking) {
  return booking.checkIn || booking.check_in || '';
}

function getCheckOut(booking) {
  return booking.checkOut || booking.check_out || '';
}

function getPaymentStatus(booking) {
  return booking.paymentStatus || booking.payment_status || 'unknown';
}

function getContactName(contact) {
  return contact.full_name || contact.fullName || contact.name || 'Guest contact';
}

function getContactEmail(contact) {
  return contact.email || '';
}

function getContactPhone(contact) {
  return contact.phone || contact.phone_number || '';
}

function isGuestContact(contact) {
  return contact.contact_type === 'guest' || contact.contactType === 'guest';
}

function getGuestKey({ email, phone, name, fallback }) {
  return normalizeKey(email) || normalizeKey(phone) || normalizeKey(name) || normalizeKey(fallback);
}

function isLaterDate(nextValue, currentValue) {
  const nextDate = new Date(nextValue);
  const currentDate = new Date(currentValue);

  if (Number.isNaN(nextDate.getTime())) return false;
  if (Number.isNaN(currentDate.getTime())) return true;

  return nextDate > currentDate;
}

function isUpcomingBooking(booking) {
  const checkIn = dateOnly(getCheckIn(booking));
  const status = String(booking.status || '').toLowerCase();

  return Boolean(checkIn && checkIn >= today() && !['cancelled', 'refunded', 'void'].includes(status));
}

function buildGuestRows(bookings, contacts, properties, currency) {
  const guestMap = new Map();
  const contactKeyById = new Map();

  contacts.filter(isGuestContact).forEach((contact) => {
    const name = getContactName(contact);
    const email = getContactEmail(contact);
    const phone = getContactPhone(contact);
    const key = getGuestKey({ email, phone, name, fallback: contact.id });

    if (!key) return;

    contactKeyById.set(contact.id, key);

    guestMap.set(key, {
      id: contact.id || key,
      key,
      name,
      email,
      phone,
      bookings: 0,
      upcomingBookings: 0,
      totalSpend: 0,
      lastStay: '',
      lastProperty: '—',
      source: 'contact',
      paymentStatus: '—',
      status: contact.status || 'active',
      notes: contact.notes || '',
      currency,
      bookingRecords: [],
      contactRecord: contact,
    });
  });

  bookings.forEach((booking) => {
    const email = getGuestEmail(booking);
    const phone = getGuestPhone(booking);
    const name = getGuestName(booking);
    const contactId = booking.contactId || booking.contact_id;
    const key = contactKeyById.get(contactId) || getGuestKey({ email, phone, name, fallback: `${name}-${booking.id}` });

    if (!key) return;

    const existing = guestMap.get(key) || {
      id: key,
      key,
      name,
      email,
      phone,
      bookings: 0,
      upcomingBookings: 0,
      totalSpend: 0,
      lastStay: '',
      lastProperty: getPropertyName(booking, properties),
      source: booking.source || 'manual',
      paymentStatus: getPaymentStatus(booking),
      status: 'active',
      notes: '',
      currency: booking.currency || currency,
      bookingRecords: [],
      contactRecord: null,
    };

    const stayDate = getCheckOut(booking) || getCheckIn(booking);

    existing.name = existing.name || name;
    existing.email = existing.email || email;
    existing.phone = existing.phone || phone;
    existing.bookings += 1;
    existing.upcomingBookings += isUpcomingBooking(booking) ? 1 : 0;
    existing.totalSpend += getBookingAmount(booking);
    existing.currency = booking.currency || existing.currency || currency;
    existing.paymentStatus = getPaymentStatus(booking) || existing.paymentStatus;
    existing.source = booking.source || existing.source;
    existing.bookingRecords.push(booking);
    existing.bookingContext = existing.bookingRecords
      .map((record) => [getGuestName(record), getPropertyName(record, properties), getCheckIn(record)]
        .filter(Boolean)
        .join(' · '))
      .join(' | ');

    if (!existing.lastStay || isLaterDate(stayDate, existing.lastStay)) {
      existing.lastStay = stayDate;
      existing.lastProperty = getPropertyName(booking, properties);
    }

    guestMap.set(key, existing);
  });

  return Array.from(guestMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}

function matchesGuestSearch(guest, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) return true;

  const searchText = [
    guest.name,
    guest.email,
    guest.phone,
    guest.lastProperty,
    guest.source,
    guest.paymentStatus,
    guest.status,
    guest.notes,
    guest.bookingContext,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchText.includes(normalizedQuery);
}

function GuestCard({ guest }) {
  const initials = String(guest.name || 'G')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <article className="card guest-card">
      <div className="guest-card-top">
        <div className="guest-avatar" aria-hidden="true">
          {initials || 'G'}
        </div>

        <StatusBadge>{guest.status || 'active'}</StatusBadge>
      </div>

      <div>
        <h3>{guest.name}</h3>
        <p>{guest.email || guest.phone || 'No contact details'}</p>
      </div>

      <div className="guest-card-meta">
        <span>
          <strong>{guest.bookings}</strong>
          <small>Bookings</small>
        </span>

        <span>
          <strong>{guest.upcomingBookings}</strong>
          <small>Upcoming</small>
        </span>

        <span>
          <strong>{formatCurrency(guest.totalSpend, guest.currency)}</strong>
          <small>Total spend</small>
        </span>

        <span>
          <strong>{guest.lastStay ? formatDate(guest.lastStay) : '—'}</strong>
          <small>Last stay</small>
        </span>
      </div>

      <div className="guest-card-contact">
        <span>
          <Mail size={15} />
          {guest.email || 'No email'}
        </span>

        <span>
          <Phone size={15} />
          {guest.phone || 'No phone'}
        </span>
      </div>

      <div className="guest-card-actions">
        <button type="button" onClick={() => navigate('/bookings')} data-skip-create-action="true">
          <CalendarCheck size={16} />
          Bookings
        </button>

        <button type="button" onClick={() => navigate('/calendar')} data-skip-create-action="true">
          Calendar
        </button>
      </div>
    </article>
  );
}

export function GuestsPage() {
  const { data, currentWorkspace, currentUser } = useApp();

  const [filters, setFilters] = React.useState({
    query: '',
    source: 'all',
    paymentStatus: 'all',
    status: 'all',
  });

  const currency = currentWorkspace?.defaultCurrency || currentWorkspace?.default_currency || 'USD';
  const canManageGuests = hasAnyRole(currentUser, guestManagerRoles);

  const bookings = data.bookings || [];
  const contacts = data.contacts || [];
  const properties = data.properties || [];

  const guestRows = buildGuestRows(bookings, contacts, properties, currency);

  const totalGuests = guestRows.length;
  const repeatGuests = guestRows.filter((guest) => guest.bookings > 1).length;
  const guestRevenue = guestRows.reduce((sum, guest) => sum + guest.totalSpend, 0);
  const contactsOnly = guestRows.filter((guest) => guest.bookings === 0).length;
  const upcomingGuestBookings = guestRows.reduce((sum, guest) => sum + guest.upcomingBookings, 0);

  const sources = [...new Set(guestRows.map((guest) => guest.source).filter(Boolean))];
  const paymentStatuses = [...new Set(guestRows.map((guest) => guest.paymentStatus).filter(Boolean))];
  const statuses = [...new Set(guestRows.map((guest) => guest.status).filter(Boolean))];

  const filteredGuests = guestRows
    .filter((guest) => filters.source === 'all' || guest.source === filters.source)
    .filter((guest) => filters.paymentStatus === 'all' || guest.paymentStatus === filters.paymentStatus)
    .filter((guest) => filters.status === 'all' || guest.status === filters.status)
    .filter((guest) => matchesGuestSearch(guest, filters.query));

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      source: 'all',
      paymentStatus: 'all',
      status: 'all',
    });
  };

  return (
    <AppLayout
      title="Guests / CRM"
      subtitle="Guest contacts, booking history, repeat guests, direct booking leads, and CRM foundation."
    >
      <section className="stat-grid dense">
        <StatCard label="Guest contacts" value={totalGuests} icon={Users} />
        <StatCard label="Repeat guests" value={repeatGuests} icon={UserRound} />
        <StatCard
          label="Guest revenue"
          value={formatCurrency(guestRevenue, currency)}
          icon={DollarSign}
        />
        <StatCard
          label="Upcoming stays"
          value={upcomingGuestBookings}
          subtitle={`${contactsOnly} contacts without bookings`}
          icon={CalendarCheck}
        />
      </section>

      <section className="card guests-toolbar">
        <div>
          <h3>Guest CRM</h3>
          <p>
            Guest records are built from bookings and guest contacts created in this workspace.
          </p>
        </div>

        <div className="guests-toolbar-actions">
          {canManageGuests && (
            <button type="button" className="primary" data-create-action="guest">
              <Plus size={16} />
              Add Guest
            </button>
          )}

          {canManageGuests && (
            <button type="button" data-create-action="booking">
              Add Booking
            </button>
          )}

          <button type="button" onClick={() => navigate('/bookings')} data-skip-create-action="true">
            View Bookings
          </button>
        </div>
      </section>

      <section className="card">
        <div className="guests-filters">
          <label className="guests-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search guest, email, phone, property, booking context, notes, payment, or status..."
              aria-label="Search guests"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear guest search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Source
            <select value={filters.source} onChange={setFilter('source')}>
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {normalizeLabel(source)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Payment
            <select value={filters.paymentStatus} onChange={setFilter('paymentStatus')}>
              <option value="all">All payment statuses</option>
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {normalizeLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status
            <select value={filters.status} onChange={setFilter('status')}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {normalizeLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {filteredGuests.length ? (
        <>
          <section className="guests-card-grid">
            {filteredGuests.slice(0, 6).map((guest) => (
              <GuestCard key={guest.id} guest={guest} />
            ))}
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h3>Guest list</h3>
                <p>
                  {filteredGuests.length} guest record{filteredGuests.length === 1 ? '' : 's'} shown.
                </p>
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
                      <strong>{row.name}</strong>
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
                  key: 'upcomingBookings',
                  label: 'Upcoming',
                },
                {
                  key: 'totalSpend',
                  label: 'Total spend',
                  render: (row) => formatCurrency(row.totalSpend, row.currency),
                },
                {
                  key: 'lastStay',
                  label: 'Last stay',
                  render: (row) => (row.lastStay ? formatDate(row.lastStay) : '—'),
                },
                {
                  key: 'lastProperty',
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
        </>
      ) : (
        <EmptyState
          eyebrow="Guest CRM"
          icon={Users}
          title={guestRows.length ? 'No guests match the current filters' : 'No guest records yet'}
          description={
            guestRows.length
              ? 'Adjust your search, source, payment-status, or status filters.'
              : 'Guest CRM records will appear after bookings or guest contacts are added. No seeded guest records are shown.'
          }
          action={
            canManageGuests ? (
              <button type="button" className="primary" data-create-action="guest">
                <Plus size={16} />
                Add Guest
              </button>
            ) : null
          }
        />
      )}

      <section className="panel-grid two">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Guest CRM next phase</h3>
              <p>Recommended CRM features after bookings and contacts are stable.</p>
            </div>
            <MessageSquare size={20} className="muted" />
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
      </section>
    </AppLayout>
  );
}
