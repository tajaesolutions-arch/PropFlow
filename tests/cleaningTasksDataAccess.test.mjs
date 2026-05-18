import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCleaningTaskPayload, createCleaningTask, listCleaningTasks, normalizeCleaningTask } from '../src/lib/cleaningTasks.js';

const helperSource = readFileSync(new URL('../src/lib/cleaningTasks.js', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../supabase/migrations/202605180002_cleaning_tasks_workspace_crud_alignment.sql', import.meta.url), 'utf8');

const missingWorkspace = await listCleaningTasks({});
assert.equal(missingWorkspace.code, 'missing_workspace_id');
assert.deepEqual(missingWorkspace.data, []);

const missingWorkspaceCreate = await createCleaningTask({ values: { status: 'scheduled' } });
assert.equal(missingWorkspaceCreate.code, 'missing_workspace_id');

const notConfigured = await listCleaningTasks({ workspaceId: 'workspace-1' });
assert.equal(notConfigured.notConfigured, true);
assert.deepEqual(notConfigured.data, []);

const payload = buildCleaningTaskPayload({
  property_id: '  property-1  ',
  booking_id: ' booking-1 ',
  status: ' IN_PROGRESS ',
  cleaner_notes: '  Needs linen refill  ',
  supplies_used: '  bleach + paper towels  ',
  checklist_items: ['  Bathroom  ', '', 'Kitchen'],
  before_photos: ['  before-1.jpg ', ''],
  after_photos: ['after-1.jpg'],
});
assert.equal(payload.property_id, 'property-1');
assert.equal(payload.related_booking_id, 'booking-1');
assert.equal(payload.status, 'in_progress');
assert.equal(payload.cleaner_notes, 'Needs linen refill');
assert.equal(payload.supplies_used, 'bleach + paper towels');
assert.deepEqual(payload.checklist_items, ['Bathroom', 'Kitchen']);
assert.deepEqual(payload.before_photos, ['before-1.jpg']);

const normalized = normalizeCleaningTask({ id: 'task-1', checklist_items: ['Entry'], guest_ready: null, issue_reported: 1 });
assert.deepEqual(normalized.checklist, ['Entry']);
assert.equal(normalized.issueReported, true);

assert.match(helperSource, /\.eq\('workspace_id',\s*w\.workspaceId\)/, 'cleaning queries must scope by workspace_id');
assert.doesNotMatch(helperSource, /createClient|SERVICE[_-]?ROLE/i, 'cleaning helper must not create duplicate clients or use service-role credentials');
assert.match(appContextSource, /listCleaningTasks\(/, 'AppContext should use cleaning helper for loading');
assert.match(appContextSource, /insertWorkspaceCleaningTask\(/, 'AppContext should use cleaning helper for create');
assert.match(appContextSource, /updateWorkspaceCleaningTask\(/, 'AppContext should use cleaning helper for update');
assert.match(migrationSource, /cleaning_tasks_select_workspace_scoped/, 'migration should align workspace-scoped read policy');
assert.match(migrationSource, /array\['workspace_owner','property_manager','host'\]/, 'migration should allow approved manager roles for writes');

console.log('Cleaning tasks data-access tests passed');
