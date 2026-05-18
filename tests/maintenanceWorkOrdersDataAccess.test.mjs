import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMaintenanceWorkOrderPayload, createMaintenanceWorkOrder, listMaintenanceWorkOrders, normalizeMaintenanceWorkOrder } from '../src/lib/maintenanceWorkOrders.js';

const helperSource = readFileSync(new URL('../src/lib/maintenanceWorkOrders.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605180003_maintenance_work_orders_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspace = await listMaintenanceWorkOrders({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const missingWorkspaceCreate = await createMaintenanceWorkOrder({ values: { status: 'reported' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id');

const notConfigured = await listMaintenanceWorkOrders({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true);
assert.deepEqual(notConfigured.data, []);

const payload = buildMaintenanceWorkOrderPayload({
  property_id: '  property-1  ',
  assigned_maintenance_id: '  user-1 ',
  title: '  Leaking faucet  ',
  issue_description: '  Dripping under sink  ',
  priority: ' HIGH ',
  status: ' IN_PROGRESS ',
  estimated_cost: ' 150.50 ',
  actual_cost: '',
  parts_needed: '  Faucet cartridge ',
  issue_photos: [' before-1.jpg ', ''],
});
assert.equal(payload.property_id, 'property-1');
assert.equal(payload.assigned_maintenance_id, 'user-1');
assert.equal(payload.title, 'Leaking faucet');
assert.equal(payload.description, 'Dripping under sink');
assert.equal(payload.priority, 'high');
assert.equal(payload.status, 'in_progress');
assert.equal(payload.estimated_cost, 150.5);
assert.equal(payload.actual_cost, null);
assert.deepEqual(payload.issue_photos, ['before-1.jpg']);

const normalized = normalizeMaintenanceWorkOrder({ id: 'work-1', issue_photos: ['a.jpg'], completion_videos: null, description: 'test' });
assert.deepEqual(normalized.issuePhotos, ['a.jpg']);
assert.deepEqual(normalized.completionVideos, []);

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'maintenance queries must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'maintenance helper must not create duplicate clients or use service-role credentials');
assert.match(appContextSource, /listMaintenanceWorkOrders\(/, 'AppContext should use maintenance helper for loading');
assert.match(appContextSource, /insertWorkspaceMaintenanceWorkOrder\(/, 'AppContext should use maintenance helper for create');
assert.match(appContextSource, /updateWorkspaceMaintenanceWorkOrder\(/, 'AppContext should use maintenance helper for update');
assert.match(migrationSource, /maintenance_work_orders_select_workspace_scoped/, 'migration should align workspace-scoped read policy');

console.log('Maintenance work orders data-access tests passed');
