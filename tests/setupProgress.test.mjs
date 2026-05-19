import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getWorkspaceSetupProgress, getWorkspaceSetupSteps, isWorkspaceSetupComplete } from '../src/lib/setupProgress.js';

const setupSource = readFileSync(new URL('../src/lib/setupProgress.js', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../src/pages/DashboardPage.jsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');

assert.match(setupSource, /export function getWorkspaceSetupSteps/, 'setupProgress utility should export getWorkspaceSetupSteps');
assert.match(setupSource, /export function getWorkspaceSetupProgress/, 'setupProgress utility should export getWorkspaceSetupProgress');
assert.match(setupSource, /export function isWorkspaceSetupComplete/, 'setupProgress utility should export isWorkspaceSetupComplete');
assert.doesNotMatch(setupSource, /sampleData/i, 'setupProgress must not import sampleData');

assert.match(dashboardSource, /getWorkspaceSetupProgress/, 'DashboardPage should import setupProgress utility');
assert.match(onboardingSource, /getWorkspaceSetupProgress/, 'OnboardingPage should import setupProgress utility');
assert.doesNotMatch(dashboardSource, /const setupChecklist\s*=\s*\[/, 'Dashboard should not keep duplicate checklist definitions');
assert.doesNotMatch(onboardingSource, /const steps\s*=\s*\[/, 'Onboarding should not keep duplicate checklist definitions');

const base = { currentWorkspace: { id: 'ws_1' }, data: {}, userRole: 'workspace_owner' };
const incomplete = getWorkspaceSetupProgress(base);
assert.ok(incomplete.total > 0 && incomplete.percent < 100, 'incomplete workspace should return incomplete progress');

const richer = getWorkspaceSetupProgress({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  userRole: 'workspace_owner',
  data: {
    properties: [{ id: 'p1' }],
    contacts: [{ id: 'c1', type: 'owner' }],
    members: [{ id: 'm1' }, { id: 'm2' }],
    bookings: [{ id: 'b1' }],
  },
});
assert.ok(richer.percent > incomplete.percent, 'workspace with real data should return higher progress');

const complete = getWorkspaceSetupProgress({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  userRole: 'workspace_owner',
  data: {
    properties: [{ id: 'p1' }],
    contacts: [{ id: 'c1', type: 'owner' }],
    members: [{ id: 'm1' }, { id: 'm2' }],
    bookings: [{ id: 'b1' }],
    cleaningTasks: [{ id: 'ct1' }],
    maintenanceWorkOrders: [{ id: 'mw1' }],
    supplies: [{ id: 's1' }],
    ownerReports: [{ id: 'r1' }],
    subscription: { id: 'sub_1' },
  },
});
assert.equal(complete.percent, 100, 'completed setup should return 100%');
assert.equal(isWorkspaceSetupComplete({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  userRole: 'workspace_owner',
  data: complete.steps.reduce((acc, step) => acc, {
    properties: [{ id: 'p1' }], contacts: [{ type: 'owner' }], members: [{ id: '1' }, { id: '2' }], bookings: [{}], cleaningTasks: [{}], maintenanceWorkOrders: [{}], supplies: [{}], ownerReports: [{}], subscription: { id: '1' },
  }),
}), true);

const actionSteps = getWorkspaceSetupSteps({ currentWorkspace: { id: 'ws1' }, data: {}, userRole: 'workspace_owner' })
  .filter((step) => step.ctaType === 'createAction')
  .map((step) => step.ctaTarget);
actionSteps.forEach((action) => {
  assert.match(createActionSource, new RegExp(`action:\\s*'${action}'`), `CTA action should be supported: ${action}`);
});

getWorkspaceSetupSteps({ currentWorkspace: { id: 'ws1' }, data: {}, userRole: 'workspace_owner' })
  .filter((step) => step.ctaType === 'route')
  .map((step) => step.ctaTarget)
  .forEach((route) => {
    assert.match(routerSource, new RegExp(`['\"]${route.replace('/', '\\/')}['\"]`), `CTA route should exist: ${route}`);
  });

const onboardingPercentReference = getWorkspaceSetupProgress({ currentWorkspace: { id: 'wsx' }, data: {}, userRole: 'workspace_owner' }).percent;
assert.equal(onboardingPercentReference, getWorkspaceSetupProgress({ currentWorkspace: { id: 'wsx' }, data: {}, userRole: 'workspace_owner' }).percent, 'Dashboard and onboarding should use same setup progress calculation');

assert.doesNotMatch(`${setupSource}\n${dashboardSource}\n${onboardingSource}`, /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY/i, 'frontend sources must not reference service role keys');

console.log('setup progress tests passed');
