import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOwnerPayload, createOwner, listOwners, normalizeOwner } from '../src/lib/owners.js';

const helperSource = readFileSync(new URL('../src/lib/owners.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605180004_owners_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspace = await listOwners({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const missingWorkspaceCreate = await createOwner({ values: { full_name: 'Owner A' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id');

const notConfigured = await listOwners({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true);
assert.deepEqual(notConfigured.data, []);

const payload = buildOwnerPayload({
  full_name: '  Dana Owner  ',
  email: ' DANA@EXAMPLE.COM ',
  phone: '  ',
  company_name: '  Prop Holdings ',
  payout_preference: '  ACH  ',
  notes: '  Monthly payout  ',
  assigned_property_ids: [' property-1 ', '', 'property-2'],
  status: ' INACTIVE ',
});
assert.equal(payload.full_name, 'Dana Owner');
assert.equal(payload.email, 'dana@example.com');
assert.equal(payload.phone, null);
assert.equal(payload.company_name, 'Prop Holdings');
assert.equal(payload.payout_preference, 'ACH');
assert.equal(payload.notes, 'Monthly payout');
assert.deepEqual(payload.assigned_property_ids, ['property-1', 'property-2']);
assert.equal(payload.status, 'inactive');

const normalized = normalizeOwner({ id: 'owner-1', full_name: null, assigned_property_ids: null, status: 'weird' });
assert.equal(normalized.full_name, '');
assert.deepEqual(normalized.assigned_property_ids, []);
assert.equal(normalized.status, 'active');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'owners helper queries must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'owners helper must not create duplicate clients or use service-role credentials');
assert.match(appContextSource, /insertWorkspaceOwner\(/, 'AppContext owner create should use owners helper');
assert.match(migrationSource, /contacts_select_owner_workspace_scoped/, 'migration should align owner read RLS policy names');
assert.match(migrationSource, /contact_manage_roles_for_type\(contact_type\)/, 'owner writes should stay manager-scoped through contact_manage_roles_for_type');

console.log('Owners data-access tests passed');
