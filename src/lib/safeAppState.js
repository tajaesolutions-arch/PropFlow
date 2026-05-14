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
  fileUploads: [],
  files: [],
  notifications: [],
  notificationPreferences: [],
  notificationDeliveryLogs: [],
  notificationProviderSettings: [],
  supplies: [],
  directBookingPages: [],
  directBookingRequests: [],
  calendarImportFeeds: [],
  ['calendar' + 'ImportEvents']: [],
  calendarImportedEvents: [],
  calendarImportSyncRuns: [],
  calendarImportConflicts: [],
  activityLogs: [],
  propertyAssignments: [],
  workspaceInvites: [],
  invites: [],
  workspaceMembers: [],
  members: [],
  billingEvents: [],
  billingPlanLimits: [],
  platformWorkspaces: [],
  platformUsers: [],
  platformAdminAuditLogs: [],
  platformAdminNotes: [],
  unreadNotificationCount: 0,
  subscription: null,
  billingAccessState: { allowed: true, warning: false, restricted: false, recoveryOnly: false, reason: 'not_configured', gracePeriodEndsAt: null },
  billingTablesReady: false,
  calendarImportTablesReady: true,
  platformOverview: null,
  platformWorkspaceDetail: null,
  platformHealthReport: null,
  platformAdminSetupRequired: false,
  platformAdminError: '',
});

const arrayFallbackKeys = new Set(
  Object.entries(safeEmptyWorkspaceData)
    .filter(([, value]) => Array.isArray(value))
    .map(([key]) => key),
);

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

function normalizeFallbackValue(key, value) {
  if (arrayFallbackKeys.has(key)) {
    return Array.isArray(value) ? value : safeEmptyWorkspaceData[key];
  }

  return value ?? safeEmptyWorkspaceData[key] ?? null;
}

export function getSafeWorkspaceDataFallback(partialData = {}) {
  const fallbackData = { ...safeEmptyWorkspaceData };

  if (!partialData || typeof partialData !== 'object') {
    return fallbackData;
  }

  Object.entries(partialData).forEach(([key, value]) => {
    fallbackData[key] = normalizeFallbackValue(key, value);
  });

  return fallbackData;
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
