export const safeAnonymousUserState = Object.freeze({
  currentUser: null,
  currentWorkspace: null,
  memberships: [],
  workspaces: [],
});

export const safeEmptyWorkspaceData = Object.freeze({
  properties: [],
  bookings: [],
  leases: [],
  contacts: [],
  cleaningTasks: [],
  maintenanceWorkOrders: [],
  expenses: [],
  reports: [],
  ownerReports: [],
  files: [],
  notifications: [],
  notificationPreferences: [],
  notificationDeliveryLogs: [],
  supplies: [],
  directBookingPages: [],
  directBookingRequests: [],
  calendarImportFeeds: [],
  calendarImportedEvents: [],
  activityLogs: [],
  propertyAssignments: [],
  workspaceInvites: [],
  workspaceMembers: [],
});

export const supabaseNotConfiguredWarning =
  'Supabase is not configured for this deployment yet. Public pages remain available, but login, workspace setup, and workspace data actions require the public Supabase connection settings.';

export const workspaceDataFallbackWarning =
  'Some workspace data could not load. PropFlow is showing a safe empty state for affected modules. Refresh the page or contact support if the issue continues.';

export function getSupabaseNotConfiguredState() {
  return {
    ...safeAnonymousUserState,
    data: safeEmptyWorkspaceData,
    authLoading: false,
    warning: supabaseNotConfiguredWarning,
  };
}

export function getSafeWorkspaceDataFallback(partialData = {}) {
  return {
    ...safeEmptyWorkspaceData,
    ...(partialData && typeof partialData === 'object' ? partialData : {}),
  };
}

export function getWorkspaceDataFallbackState(partialData = {}) {
  return {
    data: getSafeWorkspaceDataFallback(partialData),
    warning: workspaceDataFallbackWarning,
  };
}

export function normalizeWorkspaceSelection({ selectedWorkspaceId, memberships = [], fallbackWorkspace = null }) {
  const activeMemberships = Array.isArray(memberships)
    ? memberships.filter((membership) => membership?.status === 'active' && membership?.workspace_id)
    : [];

  const selectedMembership = activeMemberships.find(
    (membership) => membership.workspace_id === selectedWorkspaceId,
  );

  if (selectedMembership) {
    return selectedWorkspaceId;
  }

  if (fallbackWorkspace?.id) {
    const fallbackMembership = activeMemberships.find(
      (membership) => membership.workspace_id === fallbackWorkspace.id,
    );

    if (fallbackMembership) {
      return fallbackWorkspace.id;
    }
  }

  return activeMemberships[0]?.workspace_id || null;
}

export function isActiveWorkspaceMembership(membership, workspaceId = null) {
  if (!membership || membership.status !== 'active') return false;
  if (!membership.workspace_id) return false;
  return workspaceId ? membership.workspace_id === workspaceId : true;
}
