import { rolePriority, roleRedirects } from '../data/constants.js';

export function resolvePrimaryRole(userOrRoles) {
  const roles = Array.isArray(userOrRoles) ? userOrRoles : userOrRoles?.roles;
  if (!roles?.length) return null;
  return [...roles].sort((a, b) => rolePriority.indexOf(a) - rolePriority.indexOf(b))[0];
}

export function getPostLoginPath(user) {
  if (user?.status === 'suspended') return '/suspended';
  if (!user?.workspaceId && !user?.roles?.includes('propflow_admin')) return '/workspace-setup';
  return roleRedirects[resolvePrimaryRole(user)] || '/dashboard';
}

export function hasAnyRole(user, allowed) {
  return Boolean(user?.roles?.some((role) => allowed.includes(role)));
}
