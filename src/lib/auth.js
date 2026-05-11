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

  const primaryRole = resolvePrimaryRole(user);

  return roleRedirects[primaryRole] || '/dashboard';
}

export function hasAnyRole(user, allowed = []) {
  if (!user || !Array.isArray(user.roles) || !Array.isArray(allowed)) {
    return false;
  }

  return user.roles.some((role) => allowed.includes(role));
}
