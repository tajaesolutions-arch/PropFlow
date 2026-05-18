import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGuestPayload, createGuest, listGuests, normalizeGuest } from '../src/lib/guests.js';

const helperSource = readFileSync(new URL('../src/lib/guests.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605180005_guest_crm_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspace = await listGuests({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const missingWorkspaceCreate = await createGuest({ values: { full_name: 'Guest A' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id');

const notConfigured = await listGuests({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true);
assert.deepEqual(notConfigured.data, []);

const payload = buildGuestPayload({
  full_name: '  Jess Guest ',
  email: '  JESS@EXAMPLE.COM ',
  phone: ' +1 (876) 555-0100 ext 9 ',
  country: '  Jamaica ',
  location: ' Montego Bay  ',
  notes: '  Prefers late check-in ',
  status: ' VIP ',
  tags: [' repeat ', '', ' direct-booking '],
  contact_type: 'customer',
});

assert.equal(payload.full_name, 'Jess Guest');
assert.equal(payload.email, 'jess@example.com');
assert.equal(payload.phone, '+1 (876) 555-0100 9');
assert.equal(payload.country, 'Jamaica');
assert.equal(payload.location, 'Montego Bay');
assert.equal(payload.notes, 'Prefers late check-in');
assert.equal(payload.status, 'vip');
assert.deepEqual(payload.tags, ['repeat', 'direct-booking']);
assert.equal(payload.contact_type, 'customer');

const normalized = normalizeGuest({ id: 'guest-1', full_name: null, tags: null, status: 'unsupported', contact_type: 'OTHER' });
assert.equal(normalized.full_name, '');
assert.deepEqual(normalized.tags, []);
assert.equal(normalized.status, 'active');
assert.equal(normalized.contact_type, 'guest');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'guests helper queries must scope by workspace_id');
assert.match(helperSource, /\.in\('contact_type',\s*GUEST_CONTACT_TYPES\)/, 'guests helper must preserve guest/customer contact type filtering');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'guests helper must not create duplicate clients or use service-role credentials');
assert.match(appContextSource, /insertWorkspaceGuest\(/, 'AppContext guest create should use guests helper');
assert.match(migrationSource, /contacts_select_workspace_scoped_guest_crm/, 'migration should align guest CRM read policy names');
assert.match(migrationSource, /optional_contact_belongs_to_workspace\(workspace_id, contact_id\)/, 'booking policies should keep workspace-scoped contact linkage');

console.log('Guests data-access tests passed');
