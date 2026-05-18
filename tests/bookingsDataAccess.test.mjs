import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBookingPayload, createBooking, listBookings } from '../src/lib/bookings.js';

const helperSource = readFileSync(new URL('../src/lib/bookings.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605180001_bookings_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspace = await listBookings({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const missingWorkspaceCreate = await createBooking({ values: { guest_name: 'Guest' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id');

const notConfigured = await listBookings({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true);
assert.deepEqual(notConfigured.data, []);

const payload = buildBookingPayload({
  guest_name: '  Test Guest  ',
  guest_email: '  guest@example.com  ',
  property_id: '  property-1  ',
  check_in: '2026-05-18',
  check_out: '2026-05-19',
  notes: '  hello  ',
  total_amount: '1,250.50',
  cleaning_fee: '',
  taxes_fees: '  ',
  owner_payout: '1000',
  guest_count: '2',
});

assert.equal(payload.guest_name, 'Test Guest');
assert.equal(payload.guest_email, 'guest@example.com');
assert.equal(payload.property_id, 'property-1');
assert.equal(payload.notes, 'hello');
assert.equal(payload.total_amount, 1250.5);
assert.equal(payload.cleaning_fee, null);
assert.equal(payload.taxes_fees, null);
assert.equal(payload.owner_payout, 1000);
assert.equal(payload.guest_count, 2);

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'bookings queries must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'bookings helper must not create duplicate clients or use service-role credentials');
assert.match(appContextSource, /insertWorkspaceBooking\(/, 'AppContext booking create should use bookings helper');
assert.match(appContextSource, /updateWorkspaceBooking\(/, 'AppContext booking update should use bookings helper');
assert.match(migrationSource, /bookings_select_workspace_scoped/, 'migration should align workspace-scoped read policy');
assert.match(migrationSource, /has_workspace_role\(workspace_id, array\['workspace_owner','property_manager','host'\]\)/, 'migration should allow booking insert/update only for approved roles');

console.log('Bookings data-access tests passed');
