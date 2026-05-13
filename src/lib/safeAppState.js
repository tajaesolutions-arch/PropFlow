export const safeAnonymousUserState = Object.freeze({
  currentUser: null,
  currentWorkspace: null,
  memberships: [],
  workspaces: [],
});

export const supabaseNotConfiguredWarning =
  'Supabase is not configured for this deployment yet. Public pages remain available, but login, workspace setup, and workspace data actions require the public Supabase connection settings.';

export function getSupabaseNotConfiguredState() {
  return {
    ...safeAnonymousUserState,
    authLoading: false,
    warning: supabaseNotConfiguredWarning,
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
