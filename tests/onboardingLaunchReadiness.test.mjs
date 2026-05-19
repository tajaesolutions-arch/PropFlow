import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboardingSource = readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const signupSource = readFileSync(new URL('../src/pages/SignupPage.jsx', import.meta.url), 'utf8');
const joinSource = readFileSync(new URL('../src/pages/JoinWorkspacePage.jsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const sampleDataSource = readFileSync(new URL('../src/data/sampleData.js', import.meta.url), 'utf8');

assert.match(onboardingSource, /Workspace setup progress/i, 'Onboarding checklist/progress should exist');
['data.properties || []', 'data.bookings || []', 'data.cleaningTasks || []', 'data.maintenanceWorkOrders || []', 'data.supplies || []', 'data.members || []', 'data.invites || []'].forEach((snippet) => {
  assert.match(onboardingSource, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Onboarding should use real workspace arrays: ${snippet}`);
});
assert.doesNotMatch(onboardingSource, /sampleData/i, 'Onboarding must not use sampleData');

['property', 'owner', 'booking', 'cleaning', 'maintenance'].forEach((action) => {
  assert.match(dashboardSource, new RegExp(`data-create-action=\\"${action}\\"`), `Dashboard should include create action: ${action}`);
});
assert.match(dashboardSource, /getWorkspaceSetupProgress/, 'Dashboard should use shared setup checklist logic');

const bannedTerms = [/\bmock\b/i, /lorem/i, /\bTODO\b/i];
for (const pattern of bannedTerms) {
  assert.doesNotMatch(signupSource, pattern, `Signup must not include internal placeholder terms: ${pattern}`);
  assert.doesNotMatch(joinSource, pattern, `Join workspace must not include internal placeholder terms: ${pattern}`);
  assert.doesNotMatch(onboardingSource, pattern, `Onboarding must not include internal placeholder terms: ${pattern}`);
}

['/signup', '/join', '/onboarding', '/dashboard', '/settings', '/account', '/suspended'].forEach((route) => {
  assert.match(routerSource, new RegExp(`['\\"]${route.replace('/', '\\/')}['\\"]`), `Route should exist: ${route}`);
});

if (/['\"]\/pending['\"]/.test(routerSource)) {
  assert.match(routerSource, /pending/i, 'Pending route references should remain valid if present');
}

assert.doesNotMatch(
  `${onboardingSource}\n${dashboardSource}\n${signupSource}\n${joinSource}\n${appContextSource}`,
  /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i,
  'Frontend onboarding-related sources must not reference service-role keys',
);

assert.ok(sampleDataSource.length > 0, 'sampleData file should remain present for isolated demo contexts only');

console.log('Onboarding launch-readiness tests passed');
