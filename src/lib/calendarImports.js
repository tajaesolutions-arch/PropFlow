const PROVIDER_ALIASES = {
  airbnb: 'airbnb_ical',
  airbnb_ical: 'airbnb_ical',
  booking: 'booking_ical',
  booking_com: 'booking_ical',
  booking_com_ical: 'booking_ical',
  booking_ical: 'booking_ical',
  vrbo: 'vrbo_ical',
  vrbo_ical: 'vrbo_ical',
  google: 'google_ical',
  google_calendar: 'google_ical',
  google_calendar_ical: 'google_ical',
  google_ical: 'google_ical',
  other: 'other_ical',
  manual_ical: 'other_ical',
  outlook_ical: 'other_ical',
  ical: 'other_ical',
  other_ical: 'other_ical',
};

const EVENT_TYPE_ALIASES = {
  booking_block: 'blocked',
  booked: 'booked',
  blocked: 'blocked',
  unavailable_block: 'unavailable',
  unavailable: 'unavailable',
  owner_block: 'owner_stay',
  owner_stay: 'owner_stay',
  maintenance_block: 'maintenance_hold',
  maintenance_hold: 'maintenance_hold',
  unknown: 'other',
  other: 'other',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function toDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function getPropertyId(record) {
  return record?.propertyId || record?.property_id || '';
}

function getPropertyName(record, properties = []) {
  const propertyId = getPropertyId(record);
  return record?.property_name || record?.property || properties.find((property) => property.id === propertyId)?.name || 'Unassigned property';
}

export function normalizeIcalProvider(value) {
  return PROVIDER_ALIASES[normalizeKey(value)] || 'other_ical';
}

export function validateIcalUrl(url) {
  const value = normalizeText(url);
  if (!value) return { ok: false, message: 'Feed URL is required.' };

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return { ok: false, message: 'iCal feed URL must use HTTPS.' };
    if (parsed.username || parsed.password) return { ok: false, message: 'iCal feed URL must not include embedded credentials.' };
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, message: 'Enter a valid HTTPS iCal feed URL.' };
  }
}

export function parseIcsDate(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (/^\d{8}$/.test(raw)) {
    const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (match) {
    const [, year, month, day, hour, minute, second, zulu] = match;
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${zulu || 'Z'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function unfoldIcsLines(icsText) {
  return normalizeText(icsText)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
      else lines.push(line);
      return lines;
    }, []);
}

function parseIcsLine(line) {
  const separator = line.indexOf(':');
  if (separator === -1) return null;
  const left = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const [name, ...parameterPairs] = left.split(';');
  const parameters = Object.fromEntries(parameterPairs.map((pair) => {
    const [key, ...rest] = pair.split('=');
    return [normalizeText(key).toUpperCase(), rest.join('=').replace(/^"|"$/g, '')];
  }));
  return { name: normalizeText(name).toUpperCase(), parameters, value };
}

function unescapeIcsText(value) {
  return normalizeText(value)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/[<>]/g, '');
}

export function parseIcsEvents(icsText) {
  const events = [];
  let current = null;

  for (const line of unfoldIcsLines(icsText)) {
    if (line.trim() === 'BEGIN:VEVENT') {
      current = { raw: {} };
      continue;
    }
    if (line.trim() === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parseIcsLine(line.trimEnd());
    if (!parsed) continue;
    current.raw[parsed.name] = parsed.value;
    if (parsed.name === 'UID') current.external_uid = unescapeIcsText(parsed.value);
    if (parsed.name === 'SUMMARY') current.title = unescapeIcsText(parsed.value).slice(0, 255);
    if (parsed.name === 'DESCRIPTION') current.description = unescapeIcsText(parsed.value).slice(0, 1000);
    if (parsed.name === 'DTSTART') current.start_at = parseIcsDate(parsed.value)?.toISOString();
    if (parsed.name === 'DTEND') current.end_at = parseIcsDate(parsed.value)?.toISOString();
    if (parsed.name === 'STATUS') current.booking_status = unescapeIcsText(parsed.value).toLowerCase();
  }

  return events.filter((event) => event.start_at && event.end_at);
}

export function mapIcsEventToCalendarEvent(event, context = {}) {
  const provider = normalizeIcalProvider(context.provider || event.provider);
  const externalUid = event.external_uid || event.externalUid || `${provider}-${event.start_at || event.startsAt}-${event.title || 'event'}`;
  return {
    workspace_id: context.workspace_id || context.workspaceId,
    property_id: context.property_id || context.propertyId,
    feed_id: context.feed_id || context.feedId || null,
    external_uid: externalUid,
    provider,
    title: event.title || 'Imported calendar block',
    description: event.description || null,
    start_at: event.start_at || event.startsAt,
    end_at: event.end_at || event.endsAt,
    event_type: EVENT_TYPE_ALIASES[normalizeKey(event.event_type || context.event_type)] || 'blocked',
    booking_status: event.booking_status || event.status || null,
    raw_payload: event.raw_payload || event.raw || {},
  };
}

export function dedupeImportedEvents(events = []) {
  const seen = new Set();
  return events.filter((event) => {
    const key = [event.workspace_id || event.workspaceId, event.property_id || event.propertyId, normalizeIcalProvider(event.provider), event.external_uid || event.externalUid].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildUnifiedCalendarEvents(payload = {}) {
  const properties = payload.properties || [];
  const members = payload.members || [];
  const findMember = (userId) => members.find((member) => [member.id, member.user_id, member.userId].includes(userId));
  const memberLabel = (userId) => {
    const member = findMember(userId);
    return member?.profile?.full_name || member?.profiles?.full_name || member?.email || userId || null;
  };

  const bookingEvents = (payload.bookings || []).flatMap((booking) => {
    const propertyId = getPropertyId(booking);
    const propertyName = getPropertyName(booking, properties);
    const checkIn = toDateOnly(booking.checkIn || booking.check_in);
    const checkOut = toDateOnly(booking.checkOut || booking.check_out);
    const status = normalizeKey(booking.status || 'confirmed');
    const source = normalizeKey(booking.source || booking.platform || 'manual');
    const guestName = booking.guestName || booking.guest_name || 'Guest booking';
    return [
      checkIn && checkOut && {
        id: `booking-${booking.id}`,
        source,
        workspace_id: booking.workspace_id || booking.workspaceId,
        property_id: propertyId,
        property_name: propertyName,
        title: `Stay: ${guestName}`,
        start: checkIn,
        end: checkOut,
        type: 'booking',
        status,
        action_url: '/bookings',
        raw: booking,
      },
      checkIn && {
        id: `check-in-${booking.id}`,
        source,
        workspace_id: booking.workspace_id || booking.workspaceId,
        property_id: propertyId,
        property_name: propertyName,
        title: `Check-in: ${guestName}`,
        start: checkIn,
        end: checkIn,
        type: 'check_in',
        status,
        action_url: '/bookings',
        raw: booking,
      },
      checkOut && {
        id: `check-out-${booking.id}`,
        source,
        workspace_id: booking.workspace_id || booking.workspaceId,
        property_id: propertyId,
        property_name: propertyName,
        title: `Check-out: ${guestName}`,
        start: checkOut,
        end: checkOut,
        type: 'check_out',
        status,
        action_url: '/bookings',
        raw: booking,
      },
    ].filter(Boolean);
  });

  const cleaningEvents = (payload.cleaningTasks || []).map((task) => {
    const assignedTo = task.assignedCleanerId || task.assigned_cleaner_id || task.cleaner_id || null;
    const start = toDateOnly(task.scheduledFor || task.scheduled_for || task.cleaning_date);
    return start && {
      id: `cleaning-${task.id}`,
      source: 'cleaning_tasks',
      workspace_id: task.workspace_id || task.workspaceId,
      property_id: getPropertyId(task),
      property_name: getPropertyName(task, properties),
      title: `Cleaning: ${getPropertyName(task, properties)}`,
      start,
      end: start,
      type: 'cleaning',
      status: normalizeKey(task.status || 'scheduled'),
      assigned_to: assignedTo,
      assigned_label: memberLabel(assignedTo),
      action_url: '/cleaning',
      raw: task,
    };
  }).filter(Boolean);

  const maintenanceEvents = (payload.maintenanceWorkOrders || []).map((workOrder) => {
    const assignedTo = workOrder.assignedMaintenanceId || workOrder.assigned_maintenance_id || workOrder.maintenance_id || null;
    const start = toDateOnly(workOrder.due || workOrder.due_date || workOrder.date);
    return start && {
      id: `maintenance-${workOrder.id}`,
      source: 'maintenance_work_orders',
      workspace_id: workOrder.workspace_id || workOrder.workspaceId,
      property_id: getPropertyId(workOrder),
      property_name: getPropertyName(workOrder, properties),
      title: `Maintenance: ${workOrder.title || 'Work order'}`,
      start,
      end: start,
      type: 'maintenance',
      status: normalizeKey(workOrder.status || 'reported'),
      assigned_to: assignedTo,
      assigned_label: memberLabel(assignedTo),
      priority: normalizeKey(workOrder.priority || 'medium'),
      action_url: '/maintenance',
      raw: workOrder,
    };
  }).filter(Boolean);

  const importedEvents = (payload.importedCalendarEvents || payload.calendarImportEvents || []).map((event) => {
    const provider = normalizeIcalProvider(event.provider || event.sourcePlatform || event.source_platform);
    const importedType = EVENT_TYPE_ALIASES[normalizeKey(event.eventType || event.event_type)] || 'blocked';
    return {
      id: `imported-${event.id || event.external_uid || event.externalUid}`,
      source: provider,
      workspace_id: event.workspace_id || event.workspaceId,
      property_id: getPropertyId(event),
      property_name: getPropertyName(event, properties),
      title: event.title || 'Imported calendar block',
      start: toDateOnly(event.start_at || event.startsAt || event.starts_at),
      end: toDateOnly(event.end_at || event.endsAt || event.ends_at),
      type: importedType === 'booked' ? 'imported_booking' : importedType,
      status: normalizeKey(event.status || event.booking_status || 'imported'),
      action_url: '/calendar-imports',
      raw: event,
    };
  }).filter((event) => event.start && event.end);

  return [...bookingEvents, ...cleaningEvents, ...maintenanceEvents, ...importedEvents];
}

export function getCalendarEventTone(eventType) {
  return {
    booking: 'event-booking',
    check_in: 'event-info',
    check_out: 'event-warning',
    cleaning: 'event-cleaning',
    maintenance: 'event-error',
    imported_booking: 'event-imported',
    booked: 'event-imported',
    blocked: 'event-imported',
    unavailable: 'event-imported',
    owner_stay: 'event-imported',
    maintenance_hold: 'event-error',
    other: 'event-imported',
  }[eventType] || 'event-info';
}
