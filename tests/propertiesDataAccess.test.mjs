import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildPropertyPayload,
  createProperty,
  listProperties,
  normalizeProperty,
} from '../src/lib/properties.js';

const propertiesHelperSource = readFileSync(new URL('../src/lib/properties.js', import.meta.url), 'utf8');
const appRouterSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605170001_properties_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspaceList = await listProperties({});
assert.equal(missingWorkspaceList.code, 'missing_workspace_id', 'property list queries must require workspace_id before touching Supabase');
assert.deepEqual(missingWorkspaceList.data, [], 'missing-workspace list should stay array-safe');

const missingWorkspaceCreate = await createProperty({ values: { name: 'Villa', address: 'Beach Road' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id', 'createProperty must refuse missing workspace_id');
assert.equal(missingWorkspaceCreate.data, null, 'missing-workspace create should not fake a saved property');

const notConfiguredList = await listProperties({ workspaceId: 'workspace-1' });
assert.equal(notConfiguredList.notConfigured, true, 'missing Supabase config should return a clear not-configured state');
assert.deepEqual(notConfiguredList.data, [], 'missing Supabase config should not crash or create fake properties');

const normalized = normalizeProperty({
  id: 'property-1',
  name: null,
  property_type: null,
  rental_type: null,
  currency: null,
  status: null,
  nightly_rate: 125,
  square_feet: 900,
  assigned_owner_id: 'owner-1',
});
assert.equal(normalized.name, '', 'normalizeProperty should keep a safe empty string for missing names');
assert.equal(normalized.property_type, 'short_term_rental');
assert.equal(normalized.propertyType, 'short_term_rental');
assert.equal(normalized.rental_type, 'short_term');
assert.equal(normalized.currency, 'USD');
assert.equal(normalized.status, 'active');
assert.equal(normalized.nightlyRate, 125);
assert.equal(normalized.squareFeet, 900);
assert.equal(normalized.assignedOwnerId, 'owner-1');

const payload = buildPropertyPayload({
  name: '  Ocean Villa  ',
  address: '  Montego Bay  ',
  city: '  ',
  nightly_rate: '1,250.50',
  bedrooms: '',
  notes: '  Ready for launch  ',
}, { requireRequiredFields: true });
assert.deepEqual(payload, {
  name: 'Ocean Villa',
  address: 'Montego Bay',
  city: null,
  nightly_rate: 1250.5,
  bedrooms: null,
  notes: 'Ready for launch',
});

assert.match(propertiesHelperSource, /\.eq\('workspace_id',\s*workspace\.workspaceId\)/, 'property helper queries must scope reads/writes by workspace_id');
assert.match(propertiesHelperSource, /from\('properties'\)/, 'property helper should use the existing Supabase client against public.properties');
assert.doesNotMatch(propertiesHelperSource, /createClient|SERVICE[_-]?ROLE/i, 'property helper must not create duplicate clients or reference service-role credentials');
assert.match(appRouterSource, /getPropertyIdFromPath/, 'properties detail route should remain registered');
assert.match(createActionSource, /membership\.workspace_id === app\.currentWorkspace\?\.id && membership\.status === 'active'/, 'create actions should require active selected-workspace membership');
assert.match(appContextSource, /propertyCreate: \[roles\.OWNER_ADMIN, roles\.PROPERTY_MANAGER, roles\.HOST\]/, 'property creates should allow owner/admin, property manager, and host roles');
assert.match(appContextSource, /property: \[roles\.OWNER_ADMIN, roles\.PROPERTY_MANAGER\]/, 'property updates should remain owner/admin and property-manager only');
assert.match(migrationSource, /has_workspace_role\(workspace_id, array\['workspace_owner','property_manager','host'\]\)/, 'properties insert RLS should allow only approved creator roles in the active workspace');
assert.match(migrationSource, /for update[\s\S]*array\['workspace_owner','property_manager'\]/, 'properties update RLS should not grant host or lower-role updates');

console.log('Properties data-access tests passed');
