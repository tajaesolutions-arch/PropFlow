import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboardingSource = readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const signupSource = readFileSync(new URL('../src/pages/SignupPage.jsx', import.meta.url), 'utf8');
const joinSource = readFileSync(new URL('../src/pages/JoinWorkspacePage.jsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const appContextSource = readFileSync(new URL('../src/lib/AppContext.jsx', import.meta.url), 'utf8');
const createActionProviderSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');

assert.match(onboardingSource, /Workspace setup progress/i, 'Onboarding checklist/progress should exist');
assert.match(onboardingSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/, 'Onboarding should import getWorkspaceSetupProgress helper');
assert.match(onboardingSource, /getWorkspaceSetupProgress\s*\(/, 'Onboarding should call getWorkspaceSetupProgress');
assert.match(onboardingSource, /currentWorkspace/, 'Onboarding should pass currentWorkspace to setup helper');
assert.match(onboardingSource, /\bdata\b/, 'Onboarding should pass data to setup helper');
assert.match(onboardingSource, /userRole:\s*currentUser\?\.role/, 'Onboarding should pass current user role into setup helper');
assert.doesNotMatch(onboardingSource, /const\s+steps\s*=\s*\[/, 'Onboarding must not define duplicate setup steps locally');
assert.doesNotMatch(onboardingSource, /sampleData/i, 'Onboarding must not use sampleData');

assert.match(dashboardSource, /import\s+\{\s*getWorkspaceSetupProgress\s*\}\s+from\s+['"]\.\.\/lib\/setupProgress\.js['"]/, 'Dashboard should import shared setup helper');
assert.match(dashboardSource, /getWorkspaceSetupProgress\s*\(/, 'Dashboard should use shared setup helper');
assert.doesNotMatch(dashboardSource, /const\s+setupChecklist\s*=\s*\[/, 'Dashboard must not duplicate full setup checklist');

['property', 'owner', 'booking', 'cleaning', 'maintenance'].forEach((action) => {
  assert.match(dashboardSource, new RegExp(`data-create-action=\\"${action}\\"`), `Dashboard should include create action: ${action}`);
});
const setupProgressSource = readFileSync(new URL('../src/lib/setupProgress.js', import.meta.url), 'utf8');
assert.match(setupProgressSource, /value:\s*'invite'/, 'Shared setup helper should include invite team create action');

const providerActions = new Set(Array.from(createActionProviderSource.matchAll(/action:\s*'([^']+)'/g), (match) => match[1]));
const ctaActions = new Set(Array.from(`${onboardingSource}\n${dashboardSource}`.matchAll(/data-create-action(?:=\{step\.cta\.value\}|=\"([^\"]+)\")/g), (match) => match[1]).filter(Boolean));
for (const action of ctaActions) {
  assert.ok(providerActions.has(action), `CTA action should be supported by CreateActionProvider: ${action}`);
}

['/signup', '/join', '/onboarding', '/dashboard', '/settings', '/account', '/suspended'].forEach((route) => {
  assert.match(routerSource, new RegExp(`['\\"]${route.replace('/', '\\/')}['\\"]`), `Route should exist: ${route}`);
});

assert.doesNotMatch(
  `${onboardingSource}\n${dashboardSource}\n${signupSource}\n${joinSource}\n${appContextSource}\n${createActionProviderSource}`,
  /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i,
  'Frontend onboarding-related sources must not reference service-role keys',
);

console.log('Onboarding launch-readiness tests passed');
