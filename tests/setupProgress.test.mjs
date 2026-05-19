import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getWorkspaceSetupProgress,
  getWorkspaceSetupSteps,
  isWorkspaceSetupComplete,
} from '../src/lib/setupProgress.js';

const setupProgressSource = readFileSync(new URL('../src/lib/setupProgress.js', import.meta.url), 'utf8');

assert.equal(typeof getWorkspaceSetupSteps, 'function', 'getWorkspaceSetupSteps should exist');
assert.equal(typeof getWorkspaceSetupProgress, 'function', 'getWorkspaceSetupProgress should exist');
assert.equal(typeof isWorkspaceSetupComplete, 'function', 'isWorkspaceSetupComplete should exist');
assert.doesNotMatch(setupProgressSource, /sampleData/i, 'setupProgress helper must not import sampleData');

const empty = getWorkspaceSetupProgress({ currentWorkspace: {}, data: {}, userRole: 'owner_admin' });
assert.equal(empty.progress < 100, true, 'Incomplete workspace should return incomplete progress');

const partial = getWorkspaceSetupProgress({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  data: {
    properties: [{ id: 'p1' }],
    owners: [{ id: 'o1' }],
    members: [{ id: 'm1' }],
    invites: [],
    bookings: [{ id: 'b1' }],
    cleaningTasks: [{ id: 'c1' }],
    maintenanceWorkOrders: [{ id: 'w1' }],
    supplies: [{ id: 's1' }],
  },
  userRole: 'owner_admin',
});
assert.equal(partial.progress > empty.progress, true, 'Workspace with setup arrays should have higher progress');

const complete = getWorkspaceSetupProgress({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  data: {
    properties: [{ id: 'p1' }],
    contacts: [{ id: 'c_owner', type: 'owner' }],
    members: [{ id: 'm1' }],
    invites: [{ id: 'i1' }],
    bookings: [{ id: 'b1' }],
    cleaningTasks: [{ id: 'c1' }],
    maintenanceWorkOrders: [{ id: 'w1' }],
    supplies: [{ id: 's1' }],
  },
  userRole: 'owner_admin',
});
assert.equal(complete.progress, 100, 'Completed setup should return 100%');
assert.equal(isWorkspaceSetupComplete({
  currentWorkspace: { id: 'ws_1', defaultCurrency: 'USD' },
  data: {
    properties: [{ id: 'p1' }],
    contacts: [{ id: 'c_owner', type: 'owner' }],
    members: [{ id: 'm1' }],
    invites: [{ id: 'i1' }],
    bookings: [{ id: 'b1' }],
    cleaningTasks: [{ id: 'c1' }],
    maintenanceWorkOrders: [{ id: 'w1' }],
    supplies: [{ id: 's1' }],
  },
  userRole: 'owner_admin',
}), true, 'Completed setup should be marked complete');
assert.equal(isWorkspaceSetupComplete({ currentWorkspace: {}, data: {}, userRole: 'owner_admin' }), false, 'Incomplete setup should not be marked complete');


const completeWithoutSubscription = getWorkspaceSetupProgress({
  currentWorkspace: { id: 'ws_2', defaultCurrency: 'USD' },
  data: {
    properties: [{ id: 'p1' }],
    contacts: [{ id: 'c_owner', type: 'owner' }],
    members: [{ id: 'm1' }],
    invites: [{ id: 'i1' }],
    bookings: [{ id: 'b1' }],
    cleaningTasks: [{ id: 'c1' }],
    maintenanceWorkOrders: [{ id: 'w1' }],
  },
  userRole: 'owner_admin',
});
assert.equal(
  completeWithoutSubscription.progress,
  100,
  'Completed setup should remain 100% when no subscription record exists',
);

const safe = getWorkspaceSetupProgress({
  currentWorkspace: {},
  data: {
    properties: null,
    owners: undefined,
    contacts: null,
    members: null,
    invites: undefined,
    bookings: undefined,
    cleaningTasks: null,
    maintenanceWorkOrders: undefined,
    supplies: null,
  },
  userRole: 'owner_admin',
});
assert.equal(Number.isFinite(safe.progress), true, 'Missing arrays should be treated safely as empty arrays');

['data?.properties', 'data?.owners', 'data?.contacts', 'data?.members', 'data?.invites', 'data?.bookings', 'data?.cleaningTasks', 'data?.maintenanceWorkOrders', 'data?.supplies'].forEach((snippet) => {
  assert.match(setupProgressSource, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `setupProgress should use real data arrays: ${snippet}`);
});

console.log('Setup progress tests passed');
