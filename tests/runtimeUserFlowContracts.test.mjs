import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getWorkspacePostLoginPath,
  hasAnyRole,
  isSuspendedAccount,
} from '../src/lib/auth.js';
import { roleRedirects, roles } from '../src/data/constants.js';
import { safeEmptyWorkspaceData } from '../src/lib/safeAppState.js';

const appRouterSource = readFileSync(new URL('../src/routes/AppRouter.jsx', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const createActionSource = readFileSync(new URL('../src/components/CreateActionProvider.jsx', import.meta.url), 'utf8');

const expectedPublicRoutes = ['/', '/pricing', '/login', '/signup', '/join', '/suspended'];
const expectedCoreRoutes = [
  '/dashboard',
  '/admin',
  '/owner-dashboard',
  '/cleaner-dashboard',
  '/maintenance-dashboard',
  '/properties',
  '/bookings',
  '/cleaning',
  '/maintenance',
  '/owners',
  '/guests',
  '/calendar',
  '/reports',
  '/notifications',
  '/settings',
  '/account',
];

[...expectedPublicRoutes, ...expectedCoreRoutes].forEach((route) => {
  assert.match(appRouterSource, new RegExp(`['\\"]${route.replace('/', '\\/')}['\\"]`), `${route} should remain registered in AppRouter`);
});

assert.equal(roleRedirects[roles.ADMIN], '/admin');
assert.equal(roleRedirects[roles.OWNER_ADMIN], '/dashboard');
assert.equal(roleRedirects[roles.PROPERTY_MANAGER], '/dashboard');
assert.equal(roleRedirects[roles.HOST], '/dashboard');
assert.equal(roleRedirects[roles.OWNER], '/owner-dashboard');
assert.equal(roleRedirects[roles.CLEANER], '/cleaner-dashboard');
assert.equal(roleRedirects[roles.MAINTENANCE], '/maintenance-dashboard');

assert.equal(isSuspendedAccount({ account_status: 'suspended' }), true, 'account_status=suspended should be treated as suspended');
assert.equal(isSuspendedAccount({ status: 'suspended' }), true, 'status=suspended should be treated as suspended');
assert.equal(getWorkspacePostLoginPath({ account_status: 'suspended', roles: [roles.OWNER_ADMIN] }), '/suspended');

const multiWorkspaceUser = {
  roles: [roles.OWNER_ADMIN, roles.CLEANER],
  membership: { roles: [roles.CLEANER], status: 'active', workspace_id: 'workspace-cleaning' },
};

assert.equal(hasAnyRole(multiWorkspaceUser, [roles.CLEANER]), true, 'current workspace membership roles should be honored');
assert.equal(
  hasAnyRole(multiWorkspaceUser, [roles.OWNER_ADMIN]),
  false,
  'roles from a different active workspace must not unlock manager-only UI in the selected workspace',
);

['properties', 'bookings', 'cleaningTasks', 'maintenanceWorkOrders', 'reports', 'notifications'].forEach((key) => {
  assert.equal(Array.isArray(safeEmptyWorkspaceData[key]), true, `${key} should keep an array-safe empty-state fallback`);
});

assert.match(
  createActionSource,
  /membership\.workspace_id === app\.currentWorkspace\?\.id && membership\.status === 'active'/,
  'create actions should only use active selected-workspace roles',
);
assert.doesNotMatch(supabaseSource, /SERVICE[_-]?ROLE/i, 'frontend Supabase code must not reference service-role keys');
assert.match(supabaseSource, /supabase\s*=\s*isSupabaseConfigured[\s\S]*:\s*null/, 'missing Supabase env should produce a null client instead of crashing');

console.log('Runtime user-flow contract tests passed');
