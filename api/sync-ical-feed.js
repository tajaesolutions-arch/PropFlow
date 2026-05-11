import dns from 'node:dns/promises';
import net from 'node:net';

import { createClient } from '@supabase/supabase-js';

import { getBearerToken } from './_utils/auth.js';
import { getServerEnv, requireServerEnv } from './_utils/env.js';
import { json, readJsonBody, requireJsonContentType, requireMethod, safeErrorMessage } from './_utils/http.js';

const MAX_ICAL_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 32 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const MAX_EVENTS_PER_SYNC = 500;

const syncStatuses = new Set(['success', 'partial_success', 'failed', 'skipped', 'provider_not_configured']);
const activeFeedStatuses = new Set(['active']);
const cancelledEventStatuses = new Set(['cancelled']);

function getSupabaseConfig() {
  return {
    url: getServerEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']),
    anonKey: getServerEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']),
  };
}

function unfoldIcalLines(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function unescapeIcalText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/[<>]/g, '')
    .trim();
}

function splitPropertyLine(line) {
  const separator = line.indexOf(':');
  if (separator === -1) return null;
  const left = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const [name, ...parameterPairs] = left.split(';');
  const parameters = Object.fromEntries(
    parameterPairs.map((pair) => {
      const [key, ...rest] = pair.split('=');
      return [String(key || '').toUpperCase(), rest.join('=').replace(/^"|"$/g, '')];
    }),
  );

  return { name: String(name || '').toUpperCase(), parameters, value };
}

function parseIcalDate(value, parameters = {}) {
  const raw = String(value || '').trim();
  const isDate = parameters.VALUE === 'DATE' || /^\d{8}$/.test(raw);

  if (isDate) {
    const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const date = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return { iso: date.toISOString(), allDay: true };
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : { iso: fallback.toISOString(), allDay: false };
  }

  const [, year, month, day, hour, minute, second, zulu] = match;
  const isoLike = `${year}-${month}-${day}T${hour}:${minute}:${second}${zulu ? 'Z' : ''}`;
  const date = zulu ? new Date(isoLike) : new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  if (Number.isNaN(date.getTime())) return null;

  return { iso: date.toISOString(), allDay: false };
}

function addUtcDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function parseIcalEvents(icalText) {
  const lines = unfoldIcalLines(icalText);
  const events = [];
  let current = null;

  for (const line of lines) {
    const cleanLine = String(line || '').trimEnd();
    if (cleanLine === 'BEGIN:VEVENT') {
      current = { raw: {} };
      continue;
    }
    if (cleanLine === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = splitPropertyLine(cleanLine);
    if (!parsed) continue;

    current.raw[parsed.name] = parsed.value;

    if (parsed.name === 'UID') current.externalUid = unescapeIcalText(parsed.value);
    if (parsed.name === 'SUMMARY') current.title = unescapeIcalText(parsed.value);
    if (parsed.name === 'DESCRIPTION') current.description = unescapeIcalText(parsed.value).slice(0, 1000);
    if (parsed.name === 'LOCATION') current.location = unescapeIcalText(parsed.value).slice(0, 255);
    if (parsed.name === 'STATUS') current.externalStatus = unescapeIcalText(parsed.value).toUpperCase();
    if (parsed.name === 'SEQUENCE') current.externalSequence = unescapeIcalText(parsed.value);
    if (parsed.name === 'DTSTART') current.start = parseIcalDate(parsed.value, parsed.parameters);
    if (parsed.name === 'DTEND') current.end = parseIcalDate(parsed.value, parsed.parameters);
  }

  return events
    .map((event, index) => {
      const startsAt = event.start?.iso;
      const endsAt = event.end?.iso || (startsAt ? addUtcDays(startsAt, event.start?.allDay ? 1 : 0) : null);
      return {
        ...event,
        externalUid: event.externalUid || `missing-uid-${index}-${startsAt || Date.now()}`,
        startsAt,
        endsAt,
        allDay: Boolean(event.start?.allDay && (event.end?.allDay ?? true)),
      };
    })
    .filter((event) => event.startsAt && event.endsAt)
    .slice(0, MAX_EVENTS_PER_SYNC);
}


function isPrivateIpv4(address) {
  const parts = String(address || '').split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const value = String(address || '').toLowerCase();
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

function hostnameLooksInternal(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa') ||
    host === 'metadata.google.internal'
  );
}

async function assertSafeIcalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('iCal feed URL is invalid.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('iCal feed URL must use HTTPS.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('iCal feed URL must not include embedded credentials.');
  }

  if (hostnameLooksInternal(parsed.hostname)) {
    throw new Error('iCal feed URL points to a private or internal host and was blocked.');
  }

  const literalFamily = net.isIP(parsed.hostname);
  if (literalFamily === 4 && isPrivateIpv4(parsed.hostname)) {
    throw new Error('iCal feed URL points to a private IPv4 address and was blocked.');
  }
  if (literalFamily === 6 && isPrivateIpv6(parsed.hostname)) {
    throw new Error('iCal feed URL points to a private IPv6 address and was blocked.');
  }

  const records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('iCal feed host could not be resolved.');

  const unsafeRecord = records.find((record) => (
    record.family === 4 ? isPrivateIpv4(record.address) : isPrivateIpv6(record.address)
  ));

  if (unsafeRecord) {
    throw new Error('iCal feed host resolves to a private or internal address and was blocked.');
  }

  return parsed.toString();
}

function looksLikeIcalendar(contentType, body) {
  const type = String(contentType || '').toLowerCase();
  const sample = String(body || '').slice(0, 5000).toUpperCase();
  return type.includes('text/calendar') || type.includes('application/octet-stream') || sample.includes('BEGIN:VCALENDAR') || sample.includes('BEGIN:VEVENT');
}

async function fetchIcal(rawUrl) {
  let nextUrl = await assertSafeIcalUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(nextUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'text/calendar, application/calendar, text/plain;q=0.9, */*;q=0.5',
          'User-Agent': 'PropFlow-iCal-Importer/1.0',
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Feed redirect did not include a destination.');
        nextUrl = await assertSafeIcalUrl(new URL(location, nextUrl).toString());
        continue;
      }

      if (!response.ok) throw new Error(`Feed fetch failed with HTTP ${response.status}.`);

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_ICAL_BYTES) throw new Error('iCal feed exceeds the 2 MB sync limit.');
        return { body: text, contentType: response.headers.get('content-type') || '' };
      }

      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ICAL_BYTES) throw new Error('iCal feed exceeds the 2 MB sync limit.');
        chunks.push(Buffer.from(value));
      }

      return { body: Buffer.concat(chunks).toString('utf8'), contentType: response.headers.get('content-type') || '' };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Feed redirected too many times.');
}

function dateRangesOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

async function detectConflicts(client, feed, importedEvent) {
  const conflicts = [];

  if (!(new Date(importedEvent.starts_at) < new Date(importedEvent.ends_at))) {
    conflicts.push({ conflict_type: 'invalid_dates', severity: 'error', message: 'Imported event has invalid start/end dates.' });
    return conflicts;
  }

  const [{ data: bookings }, { data: directRequests }, { data: leases }] = await Promise.all([
    client
      .from('bookings')
      .select('id, check_in, check_out, status')
      .eq('workspace_id', feed.workspace_id)
      .eq('property_id', feed.property_id)
      .not('status', 'eq', 'cancelled'),
    client
      .from('direct_booking_requests')
      .select('id, check_in, check_out, status')
      .eq('workspace_id', feed.workspace_id)
      .eq('property_id', feed.property_id)
      .in('status', ['new', 'under_review', 'approved']),
    client
      .from('leases')
      .select('id, lease_start, lease_end, lease_status')
      .eq('workspace_id', feed.workspace_id)
      .eq('property_id', feed.property_id)
      .not('lease_status', 'in', '(ended,terminated,archived)'),
  ]);

  for (const booking of bookings || []) {
    if (dateRangesOverlap(importedEvent.starts_at, importedEvent.ends_at, `${booking.check_in}T00:00:00Z`, `${booking.check_out}T00:00:00Z`)) {
      conflicts.push({
        conflict_type: 'overlaps_internal_booking',
        severity: 'warning',
        message: 'Imported iCal event overlaps an existing internal booking.',
        related_booking_id: booking.id,
      });
    }
  }

  for (const request of directRequests || []) {
    if (request.check_in && request.check_out && dateRangesOverlap(importedEvent.starts_at, importedEvent.ends_at, `${request.check_in}T00:00:00Z`, `${request.check_out}T00:00:00Z`)) {
      conflicts.push({
        conflict_type: 'overlaps_direct_booking',
        severity: 'warning',
        message: 'Imported iCal event overlaps an active direct booking request.',
      });
    }
  }

  for (const lease of leases || []) {
    const leaseEnd = lease.lease_end || '9999-12-31';
    if (dateRangesOverlap(importedEvent.starts_at, importedEvent.ends_at, `${lease.lease_start}T00:00:00Z`, `${leaseEnd}T00:00:00Z`)) {
      conflicts.push({
        conflict_type: 'overlaps_lease',
        severity: 'warning',
        message: 'Imported iCal event overlaps an active long-term lease.',
        related_lease_id: lease.id,
      });
    }
  }

  return conflicts;
}

async function createSyncRun(client, feed, userId, status = 'running') {
  const { data, error } = await client
    .from('calendar_import_sync_runs')
    .insert({
      workspace_id: feed.workspace_id,
      feed_id: feed.id,
      property_id: feed.property_id,
      status,
      started_at: new Date().toISOString(),
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, 'POST')) return;
  if (!requireJsonContentType(request, response)) return;
  if (!requireServerEnv(request, response, [{ name: 'SUPABASE_URL', fallbacks: ['VITE_SUPABASE_URL'] }, { name: 'SUPABASE_ANON_KEY', fallbacks: ['VITE_SUPABASE_ANON_KEY'] }])) return;

  const { url, anonKey } = getSupabaseConfig();

  const token = getBearerToken(request);
  if (!token) return json(request, response, 401, { code: 'missing_session', message: 'Authenticated session required to sync iCal feeds.' });

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body;
  try {
    body = await readJsonBody(request, { maxBytes: MAX_REQUEST_BYTES });
  } catch (bodyError) {
    if (bodyError?.message === 'request_body_too_large') {
      return json(request, response, 413, { code: 'request_body_too_large', message: 'Request body exceeds the 32 KB limit.' });
    }
    return json(request, response, 400, { code: 'invalid_json', message: 'Request body must be valid JSON.' });
  }

  const feedId = String(body.feedId || body.feed_id || '').trim();
  if (!feedId) return json(request, response, 400, { code: 'missing_feed_id', message: 'feedId is required.' });

  const { data: userResponse, error: userError } = await client.auth.getUser(token);
  const userId = userResponse?.user?.id;
  if (userError || !userId) return json(request, response, 401, { code: 'invalid_session', message: 'Session could not be validated.' });

  const { data: feed, error: feedError } = await client.from('calendar_import_feeds').select('*').eq('id', feedId).maybeSingle();
  if (feedError || !feed) return json(request, response, 404, { code: 'feed_not_found', message: 'Calendar import feed was not found or is not available for this role.' });

  if (!activeFeedStatuses.has(feed.status) || feed.archived_at) {
    const run = await createSyncRun(client, feed, userId, 'skipped');
    await client.from('calendar_import_sync_runs').update({ status: 'skipped', completed_at: new Date().toISOString(), error_message: 'Feed is paused or archived.' }).eq('id', run.id);
    await client.from('calendar_import_feeds').update({ last_sync_status: 'skipped', last_sync_at: new Date().toISOString(), last_error: 'Feed is paused or archived.' }).eq('id', feed.id);
    return json(request, response, 200, { code: 'skipped', status: 'skipped', message: 'Feed is paused or archived.' });
  }

  let run;
  const summary = { eventsFound: 0, eventsCreated: 0, eventsUpdated: 0, eventsIgnored: 0, conflictsFound: 0 };

  try {
    run = await createSyncRun(client, feed, userId, 'running');
    await client.from('calendar_import_feeds').update({ last_sync_status: 'running', last_sync_at: new Date().toISOString(), last_error: null }).eq('id', feed.id);

    const { body: icalBody, contentType } = await fetchIcal(feed.feed_url);
    if (!looksLikeIcalendar(contentType, icalBody)) throw new Error('Fetched content does not look like a valid iCalendar feed.');

    const parsedEvents = parseIcalEvents(icalBody);
    summary.eventsFound = parsedEvents.length;
    const uidCounts = parsedEvents.reduce((counts, item) => {
      counts[item.externalUid] = (counts[item.externalUid] || 0) + 1;
      return counts;
    }, {});

    for (const event of parsedEvents) {
      const importStatus = cancelledEventStatuses.has(String(event.externalStatus || '').toLowerCase()) ? 'cancelled' : 'imported';
      const payload = {
        workspace_id: feed.workspace_id,
        property_id: feed.property_id,
        feed_id: feed.id,
        external_uid: event.externalUid,
        external_sequence: event.externalSequence || null,
        event_type: feed.import_as || 'booking_block',
        status: importStatus,
        title: event.title || 'Imported calendar block',
        description: event.description || null,
        location: event.location || null,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        all_day: event.allDay,
        source_platform: feed.provider_type,
        raw_event: event.raw || {},
        archived_at: null,
      };

      const { data: existing } = await client
        .from('calendar_import_events')
        .select('id, starts_at, ends_at, title, status')
        .eq('workspace_id', feed.workspace_id)
        .eq('feed_id', feed.id)
        .eq('external_uid', event.externalUid)
        .maybeSingle();

      const { data: importedRow, error: upsertError } = await client
        .from('calendar_import_events')
        .upsert(payload, { onConflict: 'workspace_id,feed_id,external_uid' })
        .select('*')
        .single();

      if (upsertError) throw upsertError;
      if (existing) summary.eventsUpdated += 1;
      else {
        summary.eventsCreated += 1;
        await client.from('activity_logs').insert({
          workspace_id: feed.workspace_id,
          actor_user_id: userId,
          action: 'calendar_event_imported',
          metadata: { feedId: feed.id, propertyId: feed.property_id, importedEventId: importedRow.id, providerType: feed.provider_type },
        });
      }

      const conflicts = await detectConflicts(client, feed, importedRow);
      if (uidCounts[event.externalUid] > 1) {
        conflicts.push({
          conflict_type: 'duplicate_external_uid',
          severity: 'warning',
          message: 'The iCal feed contains more than one event with the same external UID.',
        });
      }
      if (conflicts.length) {
        summary.conflictsFound += conflicts.length;
        await client
          .from('calendar_import_events')
          .update({ status: importStatus === 'cancelled' ? 'cancelled' : 'conflict', conflict_summary: `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} found` })
          .eq('id', importedRow.id);
        await client.from('calendar_import_conflicts').insert(
          conflicts.map((conflict) => ({
            workspace_id: feed.workspace_id,
            property_id: feed.property_id,
            feed_id: feed.id,
            imported_event_id: importedRow.id,
            status: 'open',
            ...conflict,
          })),
        );
      }
    }

    const status = summary.conflictsFound ? 'partial_success' : 'success';
    if (!syncStatuses.has(status)) throw new Error('Internal sync status was invalid.');

    await client
      .from('calendar_import_sync_runs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        events_found: summary.eventsFound,
        events_created: summary.eventsCreated,
        events_updated: summary.eventsUpdated,
        events_ignored: summary.eventsIgnored,
        conflicts_found: summary.conflictsFound,
      })
      .eq('id', run.id);

    await client
      .from('calendar_import_feeds')
      .update({
        last_sync_status: status,
        last_sync_at: new Date().toISOString(),
        last_successful_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', feed.id);

    return json(request, response, 200, { code: status, status, feedId: feed.id, ...summary });
  } catch (error) {
    const message = error?.message || 'iCal sync failed.';

    if (run?.id) {
      await client
        .from('calendar_import_sync_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message })
        .eq('id', run.id);
    }

    await client
      .from('calendar_import_feeds')
      .update({ last_sync_status: 'failed', last_sync_at: new Date().toISOString(), last_error: message })
      .eq('id', feed.id);

    return json(request, response, 500, { code: 'failed', status: 'failed', message: safeErrorMessage(error, 'iCal sync failed.'), ...summary });
  }
}
