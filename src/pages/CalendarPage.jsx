import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

import { AppLayout } from '../components/layout/AppLayout.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApp } from '../lib/AppContext.jsx';
import { currencies } from '../data/constants.js';

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

  if (!dayValue || !event.start || !event.end) {
    return false;
  }

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

function getPropertyId(record) {
  return record?.propertyId || record?.property_id;
}

function getPropertyName(record) {
  return record?.property || record?.property_name || 'Unassigned property';
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

function buildBookingEvents(bookings = []) {
  return bookings.flatMap((booking) => {
    const checkIn = getBookingCheckIn(booking);
    const checkOut = getBookingCheckOut(booking);

    if (!checkIn && !checkOut) return [];

    const guestName = getBookingGuestName(booking);
    const propertyId = getPropertyId(booking);
    const property = getPropertyName(booking);

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
        row: booking,
      });
    }

    return events;
  });
}

function buildLeaseEvents(leases = []) {
  return leases.flatMap((lease) => {
    const leaseStart = getLeaseStart(lease);
    const leaseEnd = getLeaseEnd(lease);
    const fallbackLeaseEnd = dateOnly(addDays(new Date(), 365));

    if (!leaseStart) return [];

    const tenantName = lease.tenantName || lease.tenant_name || 'Tenant';
    const propertyId = getPropertyId(lease);
    const property = getPropertyName(lease);
    const end = leaseEnd || fallbackLeaseEnd;

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
        status: lease.leaseStatus || lease.lease_status || 'active',
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
        status: lease.leaseStatus || lease.lease_status || 'active',
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
        status: lease.leaseStatus || lease.lease_status || 'active',
        row: lease,
      });
    }

    return events;
  });
}

function buildCleaningEvents(cleaningTasks = []) {
  return cleaningTasks
    .map((task) => {
      const scheduledDate = getCleaningDate(task);

      if (!scheduledDate) return null;

      return {
        id: `cleaning-${task.id}`,
        sourceId: task.id,
        type: 'cleaning',
        title: `Cleaning: ${task.property || 'Property'}`,
        propertyId: getPropertyId(task),
        property: getPropertyName(task),
        start: scheduledDate,
        end: scheduledDate,
        status: task.status || 'scheduled',
        assignedId: task.assignedCleanerId || task.assigned_cleaner_id || null,
        row: task,
      };
    })
    .filter(Boolean);
}

function buildMaintenanceEvents(maintenanceWorkOrders = []) {
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
        property: getPropertyName(workOrder),
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

function makeEvents(data) {
  return [
    ...buildBookingEvents(data.bookings || []),
    ...buildLeaseEvents(data.leases || []),
    ...buildCleaningEvents(data.cleaningTasks || []),
    ...buildMaintenanceEvents(data.maintenanceWorkOrders || []),
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

function getPropertyOwnerId(property) {
  return property.assignedOwnerId || property.assigned_owner_id || property.ownerId || property.owner_id;
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

export function CalendarPage() {
  const { data } = useApp();

  const [view, setView] = React.useState('month');
  const [anchor, setAnchor] = React.useState(new Date());
  const [selected, setSelected] = React.useState(null);

  const [filters, setFilters] = React.useState({
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
  const members = (data.members || []).map((member) => ({
    id: getMemberId(member),
    label: getMemberLabel(member),
  })).filter((member) => member.id);

  const setFilter = (key) => (event) => {
    setFilters((value) => ({
      ...value,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));
  };

  const events = React.useMemo(() => {
    return makeEvents(data)
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
      .filter((event) => filters.currency === 'all' || !event.row?.currency || event.row.currency === filters.currency);
  }, [data, filters, properties]);

  const visibleDays = buildDays(anchor, view);

  const agenda = React.useMemo(() => {
    return events
      .filter((event) => event.start)
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events]);

  const move = (direction) => {
    const days = view === 'day' ? 1 : view === 'week' ? 7 : 30;
    setAnchor((date) => addDays(date, direction * days));
  };

  return (
    <AppLayout title="Calendar" subtitle="Bookings, leases, check-ins, check-outs, cleaning tasks, and maintenance due dates">
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Operations calendar</h3>
            <p>
              Stay blocks, check-in/check-out events, cleaning tasks, maintenance due dates, and
              lease periods from workspace data.
            </p>
          </div>

          <div className="action-row">
            <button type="button" onClick={() => move(-1)}>
              <ChevronLeft size={16} />
              Previous
            </button>

            <button type="button" onClick={() => setAnchor(new Date())}>
              Today
            </button>

            <button type="button" onClick={() => move(1)}>
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="tabs">
          {views.map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? 'active' : ''}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="filter-bar booking-filter">
          <select value={filters.property} onChange={setFilter('property')}>
            <option value="all">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>

          <input type="date" value={filters.start} onChange={setFilter('start')} />
          <input type="date" value={filters.end} onChange={setFilter('end')} />

          <select value={filters.bookingStatus} onChange={setFilter('bookingStatus')}>
            <option value="all">All booking statuses</option>
            {bookingStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <select value={filters.cleaningStatus} onChange={setFilter('cleaningStatus')}>
            <option value="all">All cleaning statuses</option>
            {cleaningStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <select value={filters.priority} onChange={setFilter('priority')}>
            <option value="all">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>

          <select value={filters.assigned} onChange={setFilter('assigned')}>
            <option value="all">All assigned users</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>

          <select value={filters.owner} onChange={setFilter('owner')}>
            <option value="all">All owners</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>

          <select value={filters.source} onChange={setFilter('source')}>
            <option value="all">All booking sources</option>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>

          <select value={filters.currency} onChange={setFilter('currency')}>
            <option value="all">All currencies</option>
            {currencies.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>

          <label className="inline-check">
            <input
              type="checkbox"
              checked={filters.showCancelled}
              onChange={setFilter('showCancelled')}
            />
            Show cancelled
          </label>
        </div>
      </section>

      {view === 'agenda' ? (
        <section className="card calendar-agenda">
          {agenda.length ? (
            agenda.map((event) => (
              <button
                className={`calendar-event ${eventTone(event.type)}`}
                key={event.id}
                type="button"
                onClick={() => setSelected(event)}
              >
                <span>{event.start}</span>
                <strong>{event.title}</strong>
                <small>
                  {event.property} · {event.type}
                </small>
                <StatusBadge>{event.status}</StatusBadge>
              </button>
            ))
          ) : (
            <EmptyState
              title="No calendar events."
              description="Add bookings, leases, cleaning tasks, or maintenance due dates to populate the agenda."
            />
          )}
        </section>
      ) : (
        <section className={`card calendar-grid calendar-${view}`}>
          <div className="calendar-header">
            <CalendarDays size={18} />
            <strong>{formatTitleDate(anchor, view)}</strong>
            <span className="property-timeline-note">
              Property timeline and drag/drop rescheduling can be added in a future phase.
            </span>
          </div>

          <div className="calendar-days">
            {visibleDays.map((day) => {
              const allDayEvents = events.filter((event) => overlapsDay(event, day));
              const dayEvents = allDayEvents.slice(0, view === 'month' ? 4 : 12);

              return (
                <div
                  className={`calendar-day ${sameDay(day, new Date()) ? 'today' : ''}`}
                  key={day.toISOString()}
                >
                  <strong>
                    {day.toLocaleDateString(undefined, {
                      weekday: view === 'month' ? 'short' : 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </strong>

                  {dayEvents.map((event) => (
                    <button
                      key={`${day.toISOString()}-${event.id}`}
                      className={`calendar-event ${eventTone(event.type)}`}
                      type="button"
                      onClick={() => setSelected(event)}
                    >
                      <span>{event.type}</span>
                      <strong>{event.title}</strong>
                    </button>
                  ))}

                  {allDayEvents.length > dayEvents.length && (
                    <small>+ {allDayEvents.length - dayEvents.length} more</small>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {selected && (
        <section className="card detail-panel">
          <div className="card-header">
            <div>
              <h3>{selected.title}</h3>
              <p>
                {selected.property} · {selected.start}
                {selected.end !== selected.start ? ` → ${selected.end}` : ''}
              </p>
            </div>

            <button type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>

          <div className="metadata-grid">
            <span>
              <Eye size={16} />
              Type: {selected.type}
            </span>
            <span>
              Status: <StatusBadge>{selected.status}</StatusBadge>
            </span>
            <span>Source: {selected.source || 'internal'}</span>
            <span>Future: drag/drop hooks pending</span>
          </div>

          <pre>{JSON.stringify(selected.row, null, 2)}</pre>
        </section>
      )}
    </AppLayout>
  );
}
