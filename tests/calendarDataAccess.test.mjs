import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCalendarImportFeedPayload,
  buildWorkspaceCalendarEvents,
  createCalendarImportFeed,
  listCalendarImportEvents,
  listCalendarImportFeeds,
  normalizeCalendarImportEvent,
} from '../src/lib/calendar.js';

const helperSource = readFileSync(new URL('../src/lib/calendar.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');

const missingWorkspace = await listCalendarImportFeeds({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');

const missingWorkspaceWrite = await createCalendarImportFeed({ values: { name: 'Feed' } });
assert.equal(missingWorkspaceWrite.code, 'missing_workspace_id');

const notConfiguredFeeds = await listCalendarImportFeeds({ workspaceId: 'workspace-1' });
assert.equal(notConfiguredFeeds.notConfigured, true);
assert.deepEqual(notConfiguredFeeds.data, []);

const notConfiguredEvents = await listCalendarImportEvents({ workspaceId: 'workspace-1' });
assert.equal(notConfiguredEvents.notConfigured, true);
assert.deepEqual(notConfiguredEvents.data, []);

assert.deepEqual(buildWorkspaceCalendarEvents({ workspaceId: 'workspace-1' }), []);

const events = buildWorkspaceCalendarEvents({
  workspaceId: 'workspace-1',
  properties: [{ id: 'p1', name: 'Ocean View' }],
  bookings: [{ id: 'b1', property_id: 'p1', guest_name: 'Sam', check_in: '2026-05-20', check_out: '2026-05-23', status: 'confirmed', source: 'manual' }],
  cleaningTasks: [{ id: 'c1', property_id: 'p1', scheduled_for: '2026-05-24', status: 'scheduled' }],
  maintenanceWorkOrders: [{ id: 'm1', property_id: 'p1', due_date: '2026-05-25', title: 'Fix lock', priority: 'high' }],
  importedEvents: [{ id: 'i1', property_id: 'p1', starts_at: '2026-05-26T00:00:00Z', ends_at: '2026-05-27T00:00:00Z', provider: 'booking.com' }],
});

assert.equal(events.filter((e) => e.type === 'checkin').length, 1);
assert.equal(events.filter((e) => e.type === 'checkout').length, 1);
assert.equal(events.filter((e) => e.type === 'cleaning').length, 1);
assert.equal(events.filter((e) => e.type === 'maintenance').length, 1);
assert.equal(events.filter((e) => e.type === 'imported').length, 1);

const payload = buildCalendarImportFeedPayload({ name: '  Main feed  ', feed_url: ' https://example.com/feed.ics ', provider: 'Booking.com', status: 'invalid', notes: '  test  ', property_id: '' });
assert.equal(payload.name, 'Main feed');
assert.equal(payload.feed_url, 'https://example.com/feed.ics');
assert.equal(payload.provider_type, 'booking_com');
assert.equal(payload.status, 'active');
assert.equal(payload.notes, 'test');
assert.equal(payload.property_id, null);

const normalizedEvent = normalizeCalendarImportEvent({ starts_at: '2026-05-01', ends_at: '2026-05-02', provider: 'Airbnb' });
assert.equal(normalizedEvent.source, 'airbnb');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'calendar helper queries must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'calendar helper must not create clients or reference service-role keys');
assert.match(appContextSource, /calendarImportFeeds/, 'AppContext should keep calendar import workspace state coverage');

console.log('Calendar data-access tests passed');
