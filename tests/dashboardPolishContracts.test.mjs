import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');

const blockedTerms = [/\bdemo\b/i, /\bfake\b/i, /lorem/i, /mock/i, /not implemented/i, /export coming soon/i, /sync coming soon/i];
blockedTerms.forEach((pattern) => {
  assert.doesNotMatch(dashboardSource, pattern, `DashboardPage should not include customer-facing placeholder term: ${pattern}`);
});

['/properties', '/bookings', '/cleaning', '/maintenance', '/reports', '/inventory', '/notifications'].forEach((route) => {
  assert.match(routerSource, new RegExp(`['"]${route.replace('/', '\\/')}['"]`), `${route} must exist in AppRouter`);
});

['data.properties || []', 'data.bookings || []', 'data.cleaningTasks || []', 'data.maintenanceWorkOrders || []', 'data.supplies || []', 'data.notifications || []'].forEach((snippet) => {
  assert.match(dashboardSource, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Dashboard should safely guard empty arrays: ${snippet}`);
});

assert.match(dashboardSource, /getWorkspaceSetupProgress/, 'Dashboard should use shared setup progress utility');
assert.doesNotMatch(dashboardSource, /sampleData/i, 'DashboardPage must not import sampleData directly');

['property', 'booking', 'cleaning', 'maintenance', 'owner', 'guest'].forEach((action) => {
  assert.match(createActionSource, new RegExp(`action:\\s*'${action}'`), `CreateActionProvider should expose ${action} action`);
});

assert.doesNotMatch(supabaseSource, /SERVICE[_-]?ROLE/i, 'Frontend code must not reference service-role keys');

console.log('Dashboard polish contract tests passed');
