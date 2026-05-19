import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
const setupProgressSource = readFileSync(new URL('../src/lib/setupProgress.js', import.meta.url), 'utf8');
const inventorySource = readFileSync(new URL('../src/pages/InventoryPage.jsx', import.meta.url), 'utf8');
const calendarSource = readFileSync(new URL('../src/pages/CalendarPage.jsx', import.meta.url), 'utf8');
const appLayoutSource = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');
const frontendBundle = [dashboardSource, onboardingSource, inventorySource, calendarSource, appLayoutSource, createActionSource, routerSource].join('\n');

for (const phrase of [
  'Inventory and Supplies Safety',
  'Schedule readiness and visibility',
  'Upload UI is setup-gated',
  'File/photo upload safety status',
  'workspace_id scoping',
  'Supabase Storage is not connected',
  'Policy Required',
  'Setup Required',
  'Disabled',
  'Empty State',
]) {
  assert.equal(frontendBundle.includes(phrase), false, `Customer-facing phrase should be removed: ${phrase}`);
}

assert.match(dashboardSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/);
assert.match(onboardingSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/);
assert.doesNotMatch(dashboardSource, /const\s+setupChecklist\s*=\s*\[/, 'Dashboard must not duplicate full setup checklist');
assert.doesNotMatch(setupProgressSource, /sampleData/i, 'setupProgress should not import sampleData');

assert.match(inventorySource, /data-create-action="supply"|data-create-action="inventory"|Add Supply/i, 'Inventory should expose Add Supply CTA');
assert.match(calendarSource, /No calendar events yet/i, 'Calendar should keep real empty state messaging');
for (const cta of ['Add Booking', 'Add Cleaning Task', 'Add Maintenance Work Order']) {
  assert.match(calendarSource, new RegExp(cta), `Calendar CTA should exist: ${cta}`);
}

for (const route of ['/onboarding', '/inventory', '/bookings', '/cleaning', '/maintenance']) {
  assert.match(routerSource, new RegExp(route.replace('/', '\\/')), `Route should exist: ${route}`);
}
for (const action of ['property', 'booking', 'cleaning', 'maintenance', 'owner', 'guest', 'invite']) {
  assert.match(createActionSource, new RegExp(`action:\\s*'${action}'`), `Create action should exist: ${action}`);
}
assert.doesNotMatch(frontendBundle, /SERVICE_ROLE|SUPABASE_SERVICE_ROLE/i, 'Frontend must not reference service-role keys');

console.log('Working UI replacement contract tests passed');
