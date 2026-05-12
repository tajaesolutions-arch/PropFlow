import { rolePriority, roleRedirects, roles as appRoles } from '../data/constants.js';

export function resolvePrimaryRole(userOrRoles) {
  const userRoles = Array.isArray(userOrRoles) ? userOrRoles : userOrRoles?.roles;

  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return null;
  }

  const knownRoles = userRoles.filter((role) => rolePriority.includes(role));

  if (knownRoles.length === 0) {
    return userRoles[0] || null;
  }

  return [...knownRoles].sort((a, b) => {
    const priorityA = rolePriority.indexOf(a);
    const priorityB = rolePriority.indexOf(b);

    return priorityA - priorityB;
  })[0];
}

export function isPropFlowAdmin(user) {
  return Boolean(user?.is_propflow_admin || user?.isPropFlowAdmin || user?.roles?.includes(appRoles.ADMIN));
}

export function canAccessPlatformAdmin(user) {
  return isPropFlowAdmin(user) && user?.status !== 'suspended' && user?.account_status !== 'suspended';
}

export function getPostLoginPath(user) {
  if (!user) {
    return '/login';
  }

  if (user.status === 'suspended') {
    return '/suspended';
  }

  const userIsPropFlowAdmin = isPropFlowAdmin(user);

  if (!user.workspaceId && !userIsPropFlowAdmin) {
    return '/workspace-setup';
  }

  const primaryRole = resolvePrimaryRole(user.membership?.roles || user.roles);

  return roleRedirects[primaryRole] || '/dashboard';
}

export function getActiveWorkspaceRoles(memberships = [], currentWorkspace = null, user = null) {
  if (!currentWorkspace?.id) {
    return Array.isArray(user?.roles) ? user.roles : [];
  }

  const activeMembership = Array.isArray(memberships)
    ? memberships.find(
        (membership) =>
          membership.workspace_id === currentWorkspace.id && membership.status === 'active',
      )
    : null;

  const fallbackMembership = user?.membership?.workspace_id === currentWorkspace.id ? user.membership : null;
  const roles = activeMembership?.roles || fallbackMembership?.roles || [];
  return Array.isArray(roles) ? roles : [];
}

export function resolveWorkspacePrimaryRole(user, memberships = [], currentWorkspace = null) {
  if (canAccessPlatformAdmin(user)) return appRoles.ADMIN;

  return resolvePrimaryRole(getActiveWorkspaceRoles(memberships, currentWorkspace, user));
}

export function hasAnyActiveWorkspaceRole(user, memberships = [], currentWorkspace = null, allowed = []) {
  if (!Array.isArray(allowed)) return false;
  if (canAccessPlatformAdmin(user) && allowed.includes(appRoles.ADMIN)) return true;

  return getActiveWorkspaceRoles(memberships, currentWorkspace, user).some((role) =>
    allowed.includes(role),
  );
}

export function getWorkspacePostLoginPath(user, memberships = [], currentWorkspace = null) {
  if (!user) return '/login';
  if (user.status === 'suspended') return '/suspended';
  if (canAccessPlatformAdmin(user)) return '/admin';
  if (!currentWorkspace?.id) return getPostLoginPath(user);

  const primaryRole = resolveWorkspacePrimaryRole(user, memberships, currentWorkspace);
  return roleRedirects[primaryRole] || '/dashboard';
}

export function hasAnyRole(user, allowed = []) {
  if (!user || !Array.isArray(user.roles) || !Array.isArray(allowed)) {
    return false;
  }

  return user.roles.some((role) => allowed.includes(role));
}
