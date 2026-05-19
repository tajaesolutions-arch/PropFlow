import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
const setupProgressSource = readFileSync(new URL('../src/lib/setupProgress.js', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');

assert.match(dashboardSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/);
assert.match(dashboardSource, /WORKSPACE SETUP/);
assert.equal((dashboardSource.match(/WORKSPACE SETUP/g) || []).length, 1, 'Dashboard should render exactly one workspace setup section label');
assert.doesNotMatch(dashboardSource, /const\s+setupChecklist\s*=\s*\[/, 'Dashboard must not define duplicate setup steps array');
assert.match(dashboardSource, /placeholderWorkspaceNames\s*=\s*new Set\(\['a', 'test'/);
assert.match(dashboardSource, /workspaceDisplayName\.length\s*>=\s*3/);
assert.match(dashboardSource, /navigate\('\/onboarding'\)/);
assert.match(dashboardSource, /View full setup checklist/);

assert.match(onboardingSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/);
assert.doesNotMatch(setupProgressSource, /sampleData/i);

const providerActions = new Set(Array.from(createActionSource.matchAll(/action:\s*'([^']+)'/g), (m) => m[1]));
const dashboardActions = new Set(Array.from(dashboardSource.matchAll(/data-create-action=\{step\.cta\.value\}|data-create-action=\"([^\"]+)\"/g), (m) => m[1]).filter(Boolean));
for (const action of ['property', 'owner', 'booking', 'cleaning', 'maintenance']) {
  assert.ok(providerActions.has(action), `Create action missing in provider: ${action}`);
  assert.ok(dashboardSource.includes(`data-create-action=\"${action}\"`) || dashboardActions.size > 0, 'Dashboard should include setup action CTAs');
}

for (const route of ['/onboarding', '/settings', '/inventory']) {
  assert.match(routerSource, new RegExp(route.replace('/', '\\/')), `Route should exist: ${route}`);
}

assert.doesNotMatch(`${dashboardSource}\n${onboardingSource}\n${setupProgressSource}\n${createActionSource}`, /SERVICE_ROLE|SUPABASE_SERVICE_ROLE/i);
assert.doesNotMatch(supabaseSource, /SERVICE[_-]?ROLE/i);

console.log('Dashboard setup single-source tests passed');
