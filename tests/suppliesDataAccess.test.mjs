import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildSupplyPayload,
  createSupply,
  listSupplies,
  normalizeSupply,
} from '../src/lib/supplies.js';

const helperSource = readFileSync(new URL('../src/lib/supplies.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605100010_supplies_inventory_rls_alignment.sql', import.meta.url), 'utf8');
const srcSources = [
  helperSource,
  appContextSource,
  readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/pages/InventoryPage.jsx', import.meta.url), 'utf8'),
].join('\n');

const missingWorkspace = await listSupplies({});
assert.equal(missingWorkspace.code, 'missing_workspace_id', 'supplies list queries must require workspace_id');
assert.deepEqual(missingWorkspace.data, [], 'missing-workspace list should stay array-safe');

const missingWorkspaceCreate = await createSupply({ values: { item_name: 'Towels' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id', 'createSupply must refuse missing workspace_id');
assert.equal(missingWorkspaceCreate.data, null, 'missing-workspace create should not fake a saved supply');

const notConfigured = await listSupplies({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true, 'missing Supabase config should return a clear not-configured state');
assert.deepEqual(notConfigured.data, [], 'missing Supabase config should not crash or create fake supplies');

const payload = buildSupplyPayload({
  item_name: '  Bath towels  ',
  property_id: '  ',
  category: ' Linens ',
  current_quantity: '1,250.5',
  low_stock_threshold: ' 10 ',
  unit: ' case ',
  supplier_name: '  Island Supply Co.  ',
  supplier_contact: '',
  vendor_name: '  Vendor mirror  ',
  estimated_unit_cost: ' 3.25 ',
  currency: ' usd ',
  notes: '  Restock weekly  ',
});
assert.equal(payload.item_name, 'Bath towels');
assert.equal(payload.property_id, null);
assert.equal(payload.category, 'Linens');
assert.equal(payload.current_quantity, 1250.5);
assert.equal(payload.low_stock_threshold, 10);
assert.equal(payload.unit, 'case');
assert.equal(payload.supplier_name, 'Island Supply Co.');
assert.equal(payload.supplier_contact, null);
assert.equal(payload.vendor_name, 'Vendor mirror');
assert.equal(payload.estimated_unit_cost, 3.25);
assert.equal(payload.currency, 'USD');
assert.equal(payload.notes, 'Restock weekly');
assert.equal(payload.status, 'in_stock');

assert.equal(buildSupplyPayload({ item_name: 'Soap', current_quantity: '0', low_stock_threshold: '5' }).status, 'out_of_stock');
assert.equal(buildSupplyPayload({ item_name: 'Soap', current_quantity: '4', low_stock_threshold: '5' }).status, 'low_stock');
assert.throws(() => buildSupplyPayload({ item_name: 'Soap', current_quantity: '-1' }), /0 or more/);
assert.throws(() => buildSupplyPayload({ item_name: 'Soap', status: 'global' }), /valid supply status/);

const normalized = normalizeSupply({
  id: 'supply-1',
  workspace_id: 'workspace-1',
  property_id: null,
  item_name: null,
  current_quantity: 0,
  low_stock_threshold: 2,
  supplier_name: 'Supplier',
  updated_at: '2026-05-18T00:00:00Z',
});
assert.equal(normalized.workspaceId, 'workspace-1');
assert.equal(normalized.propertyId, null);
assert.equal(normalized.itemName, '');
assert.equal(normalized.status, 'out_of_stock');
assert.equal(normalized.supplierName, 'Supplier');
assert.equal(normalized.vendorName, 'Supplier');
assert.equal(normalized.lastUpdatedAt, '2026-05-18T00:00:00Z');

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'supply helper must scope reads and writes by workspace_id');
assert.match(helperSource, /from\('supplies'\)/, 'supply helper should use the existing supplies table');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'supply helper must not create duplicate clients or use service-role credentials');
assert.doesNotMatch(srcSources, /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SUPABASE_SECRET|VITE_.*(SECRET|SERVICE_ROLE)/i, 'frontend code must not reference service-role keys');
assert.match(appContextSource, /listSupplies\(/, 'AppContext should use supplies helper for loading');
assert.match(appContextSource, /insertWorkspaceSupply\(/, 'AppContext should use supplies helper for create');
assert.match(appContextSource, /updateWorkspaceSupply\(/, 'AppContext should use supplies helper for update');
assert.match(migrationSource, /public\.can_view_supplies\(workspace_id\)/, 'supplies read policy should stay workspace-scoped');
assert.match(migrationSource, /array\['workspace_owner','property_manager','host'\]/, 'manager-role write expectations should remain documented in RLS');
assert.match(migrationSource, /public\.supply_property_is_scoped\(workspace_id, property_id\)/, 'RLS should prevent cross-workspace property assignment');

console.log('Supplies data-access tests passed');
