const BOOKING_BLOCKING_STATUSES = new Set(['confirmed', 'approved', 'pending', 'active', 'booked', 'reserved', 'completed']);
const IMPORT_BLOCKING_STATUSES = new Set(['imported', 'changed', 'conflict', 'booked', 'blocked', 'unavailable', 'reserved']);
const IMPORT_BLOCKING_TYPES = new Set(['booking_block', 'booking', 'blocked', 'unavailable', 'maintenance_hold']);
const REQUEST_BLOCKING_STATUSES = new Set(['approved', 'paid', 'converted_to_booking']);

function toDateOnly(value, label = 'Date') {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} must be a valid date.`);
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} must be a valid date.`);
  return raw;
}

export function normalizeDateRange(checkIn, checkOut, { maxNights = 90, minNights = 1 } = {}) {
  const start = toDateOnly(checkIn, 'Check-in date');
  const end = toDateOnly(checkOut, 'Check-out date');
  const nights = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
  if (nights < minNights) throw new Error(`Minimum stay is ${minNights} night${minNights === 1 ? '' : 's'}.`);
  if (nights > maxNights) throw new Error(`Maximum stay is ${maxNights} nights.`);
  return { checkIn: start, checkOut: end, nights };
}

export function dateRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && aEnd > bStart);
}

function sameProperty(record, propertyId) {
  return (record?.propertyId || record?.property_id) === propertyId;
}

export function getPropertyAvailabilityBlocks({ propertyId, bookings = [], calendarImportEvents = [], directBookingRequests = [], excludeRequestId = null } = {}) {
  const bookingBlocks = bookings
    .filter((booking) => sameProperty(booking, propertyId))
    .filter((booking) => booking.archived_at == null && booking.archivedAt == null)
    .filter((booking) => {
      const status = String(booking.status || booking.booking_status || '').toLowerCase();
      return status !== 'cancelled' && status !== 'canceled' && (BOOKING_BLOCKING_STATUSES.has(status) || status !== '');
    })
    .map((booking) => ({ type: 'booking', id: booking.id, checkIn: booking.checkIn || booking.check_in, checkOut: booking.checkOut || booking.check_out, record: booking }));

  const importedBlocks = calendarImportEvents
    .filter((event) => sameProperty(event, propertyId))
    .filter((event) => event.archived_at == null && event.archivedAt == null)
    .filter((event) => {
      const status = String(event.status || event.booking_status || '').toLowerCase();
      const type = String(event.eventType || event.event_type || '').toLowerCase();
      return IMPORT_BLOCKING_STATUSES.has(status) || IMPORT_BLOCKING_TYPES.has(type);
    })
    .map((event) => ({ type: 'calendar_import', id: event.id, checkIn: String(event.startsAt || event.starts_at || event.check_in || '').slice(0, 10), checkOut: String(event.endsAt || event.ends_at || event.check_out || '').slice(0, 10), record: event }));

  const requestBlocks = directBookingRequests
    .filter((request) => request.id !== excludeRequestId)
    .filter((request) => sameProperty(request, propertyId))
    .filter((request) => request.archived_at == null && request.archivedAt == null)
    .filter((request) => REQUEST_BLOCKING_STATUSES.has(String(request.status || '').toLowerCase()) || String(request.payment_status || request.paymentStatus || '').toLowerCase() === 'paid')
    .map((request) => ({ type: 'direct_booking_request', id: request.id, checkIn: request.checkIn || request.check_in, checkOut: request.checkOut || request.check_out, record: request }));

  return [...bookingBlocks, ...importedBlocks, ...requestBlocks].filter((block) => block.checkIn && block.checkOut);
}

export function hasBookingConflict(payload = {}) {
  const { propertyId, checkIn, checkOut } = payload;
  const blocks = getPropertyAvailabilityBlocks(payload);
  return blocks.find((block) => dateRangesOverlap(checkIn, checkOut, block.checkIn, block.checkOut)) || null;
}

export function getAvailabilityConflictMessage(conflict) {
  if (!conflict) return '';
  if (conflict.type === 'calendar_import') return 'Those dates are blocked by an imported calendar event.';
  if (conflict.type === 'direct_booking_request') return 'Those dates are already held by an approved or paid direct booking request.';
  return 'Those dates are not available for this property.';
}
