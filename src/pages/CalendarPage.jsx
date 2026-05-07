import React from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  X,
} from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { currencies } from '../data/constants.js';
import { navigate } from '../routes/AppRouter.jsx';

const bookingStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'];
const cleaningStatuses = ['scheduled', 'in_progress', 'completed', 'missed', 'needs_inspection', 'guest_ready', 'cancelled'];
const priorities = ['low', 'medium', 'high', 'urgent'];
const sources = ['manual', 'direct', 'airbnb', 'booking_com', 'vrbo', 'ical', 'csv', 'other'];
const views = ['month', 'week', 'day', 'agenda'];

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function dateOnly(value) {
  if (!value || !isValidDate(value)) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

function startOfMonthGrid(date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

function sameDay(a, b) {
  return dateOnly(a) === dateOnly(b);
}

function overlapsDay(event, day) {
  const dayValue = dateOnly(day);

  if (!dayValue || !event.start || !event.end) return false;

  return event.start <= dayValue && event.end >= dayValue;
}

function buildDays(anchor, view) {
  if (view === 'day') return [new Date(anchor)];

  if (view === 'week') {
    return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));
  }

  return Array.from({ length: 42 }, (_, index) => addDays(startOfMonthGrid(anchor), index));
}

function eventTone(type) {
  return {
    booking: 'event-booking',
    checkin: 'event-info',
    checkout: 'event-warning',
    cleaning: 'event-cleaning',
    maintenance: 'event-error',
    lease: 'event-lease',
  }[type] || 'event-info';
}

function eventStatusTone(event) {
  if (event.type === 'maintenance' && event.priority === 'urgent') return 'error';

  const status = String(event.status || '').toLowerCase();

  if (status.includes('cancel') || status.includes('terminated') || status.includes('missed')) return 'error';
  if (status.includes('pending') || status.includes('scheduled') || status.includes('waiting')) return 'warning';
  if (status.includes('confirmed') || status.includes('active') || status.includes('completed') || status.includes('ready')) {
    return 'success';
  }

  return 'info';
}

function formatLabel(value) {
  return String(value || 'unknown').replaceAll('_', ' ');
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyFromRecord(record, properties = []) {
  const propertyId = getPropertyId(record);
  return properties.find((property) => property.id === propertyId);
}

function getPropertyName(record, properties = []) {
  return (
    record?.property ||
    record?.property_name ||
    getPropertyFromRecord(record, properties)?.name ||
    'Unassigned property'
  );
}

function getPropertyOwnerId(property) {
  return property?.assignedOwnerId || property?.assigned_owner_id || property?.ownerId || property?.owner_id;
}

function getBookingGuestName(booking) {
  return booking.guestName || booking.guest_name || 'Guest booking';
}

function getBookingCheckIn(booking) {
  return dateOnly(booking.checkIn || booking.check_in);
}

function getBookingCheckOut(booking) {
  return dateOnly(booking.checkOut || booking.check_out);
}

function getLeaseStart(lease) {
  return dateOnly(lease.leaseStart || lease.lease_start);
}

function getLeaseEnd(lease) {
  return dateOnly(lease.leaseEnd || lease.lease_end);
}

function getCleaningDate(task) {
  return dateOnly(task.scheduledFor || task.scheduled_for);
}

function getMaintenanceDate(workOrder) {
  return dateOnly(workOrder.due || workOrder.due_date);
}

function buildBookingEvents(bookings = [], properties = []) {
  return bookings.flatMap((booking) => {
    const checkIn = getBookingCheckIn(booking);
    const checkOut = getBookingCheckOut(booking);

    if (!checkIn && !checkOut) return [];

    const guestName = getBookingGuestName(booking);
    const propertyId = getPropertyId(booking);
    const property = getPropertyName(booking, properties);

    const events = [];

    if (checkIn && checkOut) {
      events.push({
        id: `booking-${booking.id}`,
        sourceId: booking.id,
        type: 'booking',
        title: guestName,
        propertyId,
        property,
        start: checkIn,
        end: checkOut,
        status: booking.status || 'confirmed',
        source: booking.source || 'manual',
        currency: booking.currency || getPropertyFromRecord(booking, properties)?.currency || null,
        priority: null,
        assignedId: null,
        row: booking,
      });
    }

    if (checkIn) {
      events.push({
        id: `checkin-${booking.id}`,
        sourceId: booking.id,
        type: 'checkin',
        title: `Check-in: ${guestName}`,
        propertyId,
        property,
        start: checkIn,
        end: checkIn,
        status: booking.status || 'confirmed',
        source: booking.source || 'manual',
        currency: booking.currency || getPropertyFromRecord(booking, properties)?.currency || null,
        row: booking,
      });
    }

    if (checkOut) {
      events.push({
        id: `checkout-${booking.id}`,
        sourceId: booking.id,
        type: 'checkout',
        title: `Check-out: ${guestName}`,
        propertyId,
        property,
        start: checkOut,
        end: checkOut,
        status: booking.status || 'confirmed',
        source: booking.source || 'manual',
        currency: booking.currency || getPropertyFromRecord(booking, properties)?.currency || null,
        row: booking,
      });
    }

    return events;
  });
}

function buildLeaseEvents(leases = [], properties = []) {
  return leases.flatMap((lease) => {
    const leaseStart = getLeaseStart(lease);
    const leaseEnd = getLeaseEnd(lease);
    const fallbackLeaseEnd = dateOnly(addDays(new Date(), 365));

    if (!leaseStart) return [];

    const tenantName = lease.tenantName || lease.tenant_name || 'Tenant';
    const propertyId = getPropertyId(lease);
    const property = getPropertyName(lease, properties);
    const end = leaseEnd || fallbackLeaseEnd;
    const status = lease.leaseStatus || lease.lease_status || 'active';

    const events = [
      {
        id: `lease-${lease.id}`,
        sourceId: lease.id,
        type: 'lease',
        title: `Lease: ${tenantName}`,
        propertyId,
        property,
        start: leaseStart,
        end,
        status,
        currency: lease.currency || getPropertyFromRecord(lease, properties)?.currency || null,
        row: lease,
      },
      {
        id: `lease-start-${lease.id}`,
        sourceId: lease.id,
        type: 'lease',
        title: `Lease starts: ${tenantName}`,
        propertyId,
        property,
        start: leaseStart,
        end: leaseStart,
        status,
        currency: lease.currency || getPropertyFromRecord(lease, properties)?.currency || null,
        row: lease,
      },
    ];

    if (leaseEnd) {
      events.push({
        id: `lease-end-${lease.id}`,
        sourceId: lease.id,
        type: 'lease',
        title: `Lease ends: ${tenantName}`,
        propertyId,
        property,
        start: leaseEnd,
        end: leaseEnd,
        status,
        currency: lease.currency || getPropertyFromRecord(lease, properties)?.currency || null,
        row: lease,
      });
    }

    return events;
  });
}

function buildCleaningEvents(cleaningTasks = [], properties = []) {
  return cleaningTasks
    .map((task) => {
      const scheduledDate = getCleaningDate(task);

      if (!scheduledDate) return null;

      return {
        id: `cleaning-${task.id}`,
        sourceId: task.id,
        type: 'cleaning',
        title: `Cleaning: ${getPropertyName(task, properties)}`,
        propertyId: getPropertyId(task),
        property: getPropertyName(task, properties),
        start: scheduledDate,
        end: scheduledDate,
        status: task.status || 'scheduled',
        assignedId: task.assignedCleanerId || task.assigned_cleaner_id || null,
        row: task,
      };
    })
    .filter(Boolean);
}

function buildMaintenanceEvents(maintenanceWorkOrders = [], properties = []) {
  return maintenanceWorkOrders
    .map((workOrder) => {
      const dueDate = getMaintenanceDate(workOrder);

      if (!dueDate) return null;

      return {
        id: `maintenance-${workOrder.id}`,
        sourceId: workOrder.id,
        type: 'maintenance',
        title: `Maintenance: ${workOrder.title || 'Work order'}`,
        propertyId: getPropertyId(workOrder),
        property: getPropertyName(workOrder, properties),
        start: dueDate,
        end: dueDate,
        status: workOrder.status || 'reported',
        priority: workOrder.priority || 'medium',
        assignedId: workOrder.assignedMaintenanceId || workOrder.assigned_maintenance_id || null,
        row: workOrder,
      };
    })
    .filter(Boolean);
}

function makeEvents(data, properties) {
  return [
    ...buildBookingEvents(data.bookings || [], properties),
    ...buildLeaseEvents(data.leases || [], properties),
    ...buildCleaningEvents(data.cleaningTasks || [], properties),
    ...buildMaintenanceEvents(data.maintenanceWorkOrders || [], properties),
  ];
}

function getMemberId(member) {
  return member.user_id || member.userId || member.id;
}

function getMemberLabel(member) {
  return (
    member.profile?.full_name ||
    member.profile?.email ||
    member.profiles?.full_name ||
    member.profiles?.email ||
    member.email ||
    member.user_id ||
    member.id ||
    'Workspace member'
  );
}

function formatTitleDate(anchor, view) {
  if (view === 'day') {
    return anchor.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (view === 'week') {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);

    return `${start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} – ${end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  return anchor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function moveAnchor(anchor, view, direction) {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, direction * 7);

  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function EventButton({ event, compact = false, onSelect }) {
  return (
    <button
      type="button"
      className={`calendar-event ${eventTone(event.type)} ${compact ? 'compact-calendar-event' : ''}`}
      onClick={() => onSelect(event)}
      title={`${event.title} · ${event.property}`}
      data-skip-create-action="true"
    >
      <span>{formatLabel(event.type)}</span>
      <strong>{event.title}</strong>
      {!compact && <small>{event.property}</small>}
    </button>
  );
}

function EventDetails({ event, onClose }) {
  if (!event) {
    return (
      <div className="card calendar-detail-card">
        <div className="card-header">
          <div>
            <h3>Event details</h3>
            <p>Select a calendar event to inspect its property, status, and source record.</p>
          </div>
          <CalendarDays size={20} className="muted" />
        </div>

        <EmptyState
          compact
          icon={CalendarDays}
          title="No event selected"
          description="Click a booking, check-in, cleaning task, maintenance job, or lease event."
        />
      </div>
    );
  }

  const goToSource = () => {
    if (['booking', 'checkin', 'checkout', 'lease'].includes(event.type)) {
      navigate('/bookings');
      return;
    }

    if (event.type === 'cleaning') {
      navigate('/cleaning');
      return;
    }

    if (event.type === 'maintenance') {
      navigate('/maintenance');
    }
  };

  return (
    <div className="card calendar-detail-card">
      <div className="card-header">
        <div>
          <p className="eyebrow">{formatLabel(event.type)}</p>
          <h3>{event.title}</h3>
          <p>{event.property}</p>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close event details"
          data-skip-create-action="true"
        >
          <X size={16} />
        </button>
      </div>

      <div className="calendar-detail-list">
        <span>
          <strong>Start</strong>
          <small>{formatDate(event.start)}</small>
        </span>

        <span>
          <strong>End</strong>
          <small>{formatDate(event.end)}</small>
        </span>

        <span>
          <strong>Status</strong>
          <StatusBadge tone={eventStatusTone(event)}>{event.status || 'active'}</StatusBadge>
        </span>

        {event.source && (
          <span>
            <strong>Source</strong>
            <small>{formatLabel(event.source)}</small>
          </span>
        )}

        {event.priority && (
          <span>
            <strong>Priority</strong>
            <StatusBadge tone={event.priority === 'urgent' ? 'error' : 'warning'}>
              {event.priority}
            </StatusBadge>
          </span>
        )}
      </div>

      <div className="action-row">
        <button type="button" className="primary" onClick={goToSource} data-skip-create-action="true">
          <Eye size={16} />
          Open source page
        </button>

        {event.propertyId && (
          <button
            type="button"
            onClick={() => navigate(`/properties/${event.propertyId}`)}
            data-skip-create-action="true"
          >
            View property
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarLegend() {
  const legendItems = [
    ['Booking stay', 'event-booking'],
    ['Check-in', 'event-info'],
    ['Check-out', 'event-warning'],
    ['Cleaning', 'event-cleaning'],
    ['Maintenance', 'event-error'],
    ['Lease', 'event-lease'],
  ];

  return (
    <div className="calendar-legend">
      {legendItems.map(([label, className]) => (
        <span key={label}>
          <i className={className} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function CalendarPage() {
  const { data } = useApp();

  const [view, setView] = React.useState('month');
  const [anchor, setAnchor] = React.useState(new Date());
  const [selected, setSelected] = React.useState(null);

  const [filters, setFilters] = React.useState({
    query: '',
    property: 'all',
    start: '',
    end: '',
    bookingStatus: 'all',
    cleaningStatus: 'all',
    priority: 'all',
    assigned: 'all',
    owner: 'all',
    source: 'all',
    currency: 'all',
    showCancelled: false,
  });

  const properties = data.properties || [];
  const ownerContacts = (data.contacts || []).filter(
    (contact) => (contact.contact_type || contact.contactType) === 'owner',
  );

  const members = (data.members || [])
    .map((member) => ({
      id: getMemberId(member),
      label: getMemberLabel(member),
    }))
    .filter((member) => member.id);

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));
  };

  const allEvents = React.useMemo(() => makeEvents(data, properties), [data, properties]);

  const events = React.useMemo(() => {
    return allEvents
      .filter((event) => filters.showCancelled || !['cancelled', 'terminated'].includes(event.status))
      .filter((event) => filters.property === 'all' || event.propertyId === filters.property)
      .filter((event) => !filters.start || event.end >= filters.start)
      .filter((event) => !filters.end || event.start <= filters.end)
      .filter(
        (event) =>
          filters.bookingStatus === 'all' ||
          !['booking', 'checkin', 'checkout'].includes(event.type) ||
          event.status === filters.bookingStatus,
      )
      .filter(
        (event) =>
          filters.cleaningStatus === 'all' ||
          event.type !== 'cleaning' ||
          event.status === filters.cleaningStatus,
      )
      .filter(
        (event) =>
          filters.priority === 'all' ||
          event.type !== 'maintenance' ||
          event.priority === filters.priority,
      )
      .filter((event) => filters.assigned === 'all' || event.assignedId === filters.assigned)
      .filter((event) => {
        if (filters.owner === 'all') return true;

        const property = properties.find((item) => item.id === event.propertyId);
        return getPropertyOwnerId(property) === filters.owner;
      })
      .filter(
        (event) =>
          filters.source === 'all' ||
          !['booking', 'checkin', 'checkout'].includes(event.type) ||
          event.source === filters.source,
      )
      .filter((event) => filters.currency === 'all' || event.currency === filters.currency)
      .filter((event) => {
        const query = filters.query.trim().toLowerCase();
        if (!query) return true;

        return [event.title, event.property, event.type, event.status, event.source, event.priority]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }, [allEvents, filters, properties]);

  const visibleDays = React.useMemo(() => buildDays(anchor, view), [anchor, view]);

  const agendaEvents = React.useMemo(
    () =>
      events
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
        .slice(0, 80),
    [events],
  );

  const todayEvents = events.filter((event) => overlapsDay(event, new Date()));
  const bookingEvents = events.filter((event) => ['booking', 'checkin', 'checkout'].includes(event.type));
  const cleaningEvents = events.filter((event) => event.type === 'cleaning');
  const maintenanceEvents = events.filter((event) => event.type === 'maintenance');
  const leaseEvents = events.filter((event) => event.type === 'lease');

  const clearFilters = () => {
    setFilters({
      query: '',
      property: 'all',
      start: '',
      end: '',
      bookingStatus: 'all',
      cleaningStatus: 'all',
      priority: 'all',
      assigned: 'all',
      owner: 'all',
      source: 'all',
      currency: 'all',
      showCancelled: false,
    });
  };

  return (
    <AppLayout
      title="Calendar"
      subtitle="Bookings, check-ins, check-outs, cleaning tasks, maintenance work orders, and leases in one operations calendar."
    >
      <section className="stat-grid dense">
        <div className="stat-card">
          <div>
            <p>Total events</p>
            <strong>{events.length}</strong>
            <small>{todayEvents.length} scheduled today</small>
          </div>
          <div className="stat-icon">
            <CalendarDays size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Booking events</p>
            <strong>{bookingEvents.length}</strong>
            <small>Reservations, check-ins, and check-outs</small>
          </div>
          <div className="stat-icon">
            <CalendarDays size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Cleaning tasks</p>
            <strong>{cleaningEvents.length}</strong>
            <small>Turnovers and guest-ready checks</small>
          </div>
          <div className="stat-icon">
            <CalendarDays size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <p>Maintenance / leases</p>
            <strong>{maintenanceEvents.length + leaseEvents.length}</strong>
            <small>{maintenanceEvents.length} repairs · {leaseEvents.length} lease events</small>
          </div>
          <div className="stat-icon">
            <CalendarDays size={20} />
          </div>
        </div>
      </section>

      <section className="card calendar-toolbar">
        <div>
          <h3>Operations calendar</h3>
          <p>{formatTitleDate(anchor, view)}</p>
        </div>

        <div className="calendar-toolbar-actions">
          <button
            type="button"
            onClick={() => setAnchor(moveAnchor(anchor, view, -1))}
            aria-label="Previous period"
            data-skip-create-action="true"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            data-skip-create-action="true"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => setAnchor(moveAnchor(anchor, view, 1))}
            aria-label="Next period"
            data-skip-create-action="true"
          >
            Next
            <ChevronRight size={16} />
          </button>

          <button type="button" className="primary" data-create-action="booking">
            <Plus size={16} />
            Add Booking
          </button>
        </div>
      </section>

      <section className="card">
        <div className="tabs calendar-view-tabs">
          {views.map((viewOption) => (
            <button
              type="button"
              key={viewOption}
              className={view === viewOption ? 'active' : ''}
              onClick={() => setView(viewOption)}
              data-skip-create-action="true"
            >
              {formatLabel(viewOption)}
            </button>
          ))}
        </div>

        <div className="calendar-filters">
          <label className="calendar-search">
            <Search size={16} />
            <input
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search event, property, status, source, or priority..."
              aria-label="Search calendar events"
            />

            {filters.query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setFilters((current) => ({ ...current, query: '' }))}
                aria-label="Clear calendar search"
                data-skip-create-action="true"
              >
                <X size={14} />
              </button>
            )}
          </label>

          <label>
            Property
            <select value={filters.property} onChange={setFilter('property')}>
              <option value="all">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
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

          <label>
            Booking status
            <select value={filters.bookingStatus} onChange={setFilter('bookingStatus')}>
              <option value="all">All booking statuses</option>
              {bookingStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cleaning status
            <select value={filters.cleaningStatus} onChange={setFilter('cleaningStatus')}>
              <option value="all">All cleaning statuses</option>
              {cleaningStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priority
            <select value={filters.priority} onChange={setFilter('priority')}>
              <option value="all">All priorities</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assigned
            <select value={filters.assigned} onChange={setFilter('assigned')}>
              <option value="all">All assigned users</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Owner
            <select value={filters.owner} onChange={setFilter('owner')}>
              <option value="all">All owners</option>
              {ownerContacts.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name || owner.fullName || owner.email || 'Owner'}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source
            <select value={filters.source} onChange={setFilter('source')}>
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {formatLabel(source)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Currency
            <select value={filters.currency} onChange={setFilter('currency')}>
              <option value="all">All currencies</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-check calendar-cancelled-toggle">
            <input
              type="checkbox"
              checked={filters.showCancelled}
              onChange={setFilter('showCancelled')}
            />
            Show cancelled
          </label>
        </div>

        <div className="calendar-filter-actions">
          <CalendarLegend />

          <button type="button" onClick={clearFilters} data-skip-create-action="true">
            Clear filters
          </button>
        </div>
      </section>

      {!allEvents.length ? (
        <EmptyState
          eyebrow="Calendar"
          icon={CalendarDays}
          title="No calendar events yet"
          description="Add bookings, leases, cleaning tasks, or maintenance work orders to populate the operations calendar."
          action={
            <button type="button" className="primary" data-create-action="booking">
              <Plus size={16} />
              Add Booking
            </button>
          }
          secondaryAction={
            <button type="button" data-create-action="cleaning">
              Add Cleaning Task
            </button>
          }
        />
      ) : (
        <section className="calendar-layout-grid">
          <div className="card calendar-grid-card">
            {view === 'agenda' ? (
              <div className="calendar-agenda-list">
                {agendaEvents.length ? (
                  agendaEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className={`calendar-agenda-row ${eventTone(event.type)}`}
                      onClick={() => setSelected(event)}
                      data-skip-create-action="true"
                    >
                      <span>
                        <strong>{formatDate(event.start)}</strong>
                        <small>{formatLabel(event.type)}</small>
                      </span>

                      <span>
                        <strong>{event.title}</strong>
                        <small>{event.property}</small>
                      </span>

                      <StatusBadge tone={eventStatusTone(event)}>{event.status || event.priority || 'active'}</StatusBadge>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    compact
                    icon={CalendarDays}
                    title="No agenda events"
                    description="Adjust the filters to show more events."
                  />
                )}
              </div>
            ) : (
              <div className={`calendar-days calendar-${view}`}>
                {visibleDays.map((day) => {
                  const dayEvents = events.filter((event) => overlapsDay(event, day));
                  const isCurrentMonth = day.getMonth() === anchor.getMonth();

                  return (
                    <div
                      key={dateOnly(day)}
                      className={`calendar-day ${sameDay(day, new Date()) ? 'today' : ''} ${
                        !isCurrentMonth && view === 'month' ? 'muted-calendar-day' : ''
                      }`}
                    >
                      <strong>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>

                      {dayEvents.slice(0, view === 'month' ? 4 : 12).map((event) => (
                        <EventButton
                          key={`${dateOnly(day)}-${event.id}`}
                          event={event}
                          compact={view === 'month'}
                          onSelect={setSelected}
                        />
                      ))}

                      {dayEvents.length > (view === 'month' ? 4 : 12) && (
                        <button
                          type="button"
                          className="calendar-more"
                          onClick={() => {
                            setView('agenda');
                            setFilters((current) => ({
                              ...current,
                              start: dateOnly(day),
                              end: dateOnly(day),
                            }));
                          }}
                          data-skip-create-action="true"
                        >
                          +{dayEvents.length - (view === 'month' ? 4 : 12)} more
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <EventDetails event={selected} onClose={() => setSelected(null)} />
        </section>
      )}
    </AppLayout>
  );
}
