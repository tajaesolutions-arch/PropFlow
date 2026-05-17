import assert from 'node:assert/strict';

import {
  getSafeWorkspaceDataFallback,
  getSupabaseNotConfiguredState,
  getWorkspaceDataFallbackState,
  isActiveWorkspaceMembership,
  normalizeWorkspaceSelection,
  safeEmptyWorkspaceData,
  supabaseNotConfiguredWarning,
  workspaceDataFallbackWarning,
} from '../src/lib/safeAppState.js';

function assertArray(value, label) {
  assert.equal(Array.isArray(value), true, `${label} should be an array`);
}

Object.entries(safeEmptyWorkspaceData).forEach(([key, value]) => {
  if (Array.isArray(value)) {
    assertArray(getSafeWorkspaceDataFallback({ [key]: null })[key], `${key} null fallback`);
    assertArray(getSafeWorkspaceDataFallback({ [key]: undefined })[key], `${key} undefined fallback`);
    assertArray(getSafeWorkspaceDataFallback({ [key]: 'bad-value' })[key], `${key} string fallback`);
  }
});

const mergedData = getSafeWorkspaceDataFallback({
  properties: [{ id: 'property-1' }],
  subscription: { id: 'subscription-1' },
});

assert.deepEqual(mergedData.properties, [{ id: 'property-1' }]);
assert.deepEqual(mergedData.subscription, { id: 'subscription-1' });
assertArray(mergedData.bookings, 'bookings default fallback');
assertArray(mergedData.calendarImportEvents, 'calendarImportEvents fallback');
assertArray(mergedData.calendarImportedEvents, 'calendarImportedEvents fallback');

const supabaseState = getSupabaseNotConfiguredState();
assert.equal(supabaseState.currentUser, null);
assert.equal(supabaseState.currentWorkspace, null);
assert.equal(supabaseState.authLoading, false);
assert.equal(supabaseState.warning, supabaseNotConfiguredWarning);
assertArray(supabaseState.data.properties, 'Supabase-not-configured properties fallback');

const workspaceFallbackState = getWorkspaceDataFallbackState({ cleaningTasks: null });
assert.equal(workspaceFallbackState.warning, workspaceDataFallbackWarning);
assertArray(workspaceFallbackState.data.cleaningTasks, 'workspace fallback cleaning tasks');

const memberships = [
  { workspace_id: 'workspace-a', status: 'active' },
  { workspace_id: 'workspace-b', status: 'revoked' },
  { workspace_id: 'workspace-c', status: 'active' },
  { workspace_id: 'workspace-d', status: 'suspended' },
];

assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'workspace-a', memberships }),
  'workspace-a',
);
assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'workspace-b', memberships }),
  'workspace-a',
);
assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'missing-workspace', memberships, fallbackWorkspace: { id: 'workspace-c' } }),
  'workspace-c',
);
assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'workspace-d', memberships }),
  'workspace-a',
);
assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'workspace-d', memberships: [{ workspace_id: 'workspace-d', status: 'suspended' }] }),
  null,
);
assert.equal(
  normalizeWorkspaceSelection({ selectedWorkspaceId: 'missing-workspace', memberships: [] }),
  null,
);

assert.equal(isActiveWorkspaceMembership({ workspace_id: 'workspace-a', status: 'active' }), true);
assert.equal(isActiveWorkspaceMembership({ workspace_id: 'workspace-a', status: 'active' }, 'workspace-a'), true);
assert.equal(isActiveWorkspaceMembership({ workspace_id: 'workspace-a', status: 'active' }, 'workspace-b'), false);
assert.equal(isActiveWorkspaceMembership({ workspace_id: 'workspace-a', status: 'suspended' }), false);
assert.equal(isActiveWorkspaceMembership({ workspace_id: 'workspace-a', status: 'revoked' }), false);
assert.equal(isActiveWorkspaceMembership(null), false);

console.log('safeAppState tests passed');
