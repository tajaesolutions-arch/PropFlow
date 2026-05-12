import { propertyAssignmentRoleOptions, roleLabels, roles } from '../data/constants.js';

export const assignmentManagerRoles = [roles.OWNER_ADMIN, roles.PROPERTY_MANAGER];
export const assignablePropertyRoles = propertyAssignmentRoleOptions;
export const blockedAssignmentRoles = [roles.ADMIN];
export const inactiveMemberStatuses = ['suspended', 'revoked', 'inactive', 'disabled'];

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getMemberId(member) {
  return member?.user_id || member?.userId || member?.id || '';
}

export function getMemberProfile(member) {
  return member?.profile || member?.profiles || {};
}

export function getMemberName(member) {
  const profile = getMemberProfile(member);
  return (
    profile.full_name ||
    profile.name ||
    member?.full_name ||
    member?.name ||
    profile.email ||
    member?.email ||
    member?.user_email ||
    getMemberId(member) ||
    'Workspace member'
  );
}

export function getMemberEmail(member) {
  const profile = getMemberProfile(member);
  return profile.email || member?.email || member?.user_email || '—';
}

export function getAssignmentPropertyId(assignment) {
  return assignment?.property_id || assignment?.propertyId || '';
}

export function getAssignmentUserId(assignment) {
  return assignment?.user_id || assignment?.userId || '';
}

export function getAssignmentRole(assignment) {
  return assignment?.assignment_role || assignment?.assignmentRole || '';
}

export function formatAssignmentRole(role) {
  return roleLabels[role] || String(role || 'unknown').replaceAll('_', ' ');
}

export function getActiveWorkspaceRoles(memberships = [], currentWorkspace = null) {
  const activeMembership = asArray(memberships).find(
    (membership) => membership.workspace_id === currentWorkspace?.id && membership.status === 'active',
  );

  return asArray(activeMembership?.roles);
}

export function canManagePropertyAssignments(memberships = [], currentWorkspace = null) {
  const activeRoles = getActiveWorkspaceRoles(memberships, currentWorkspace);
  return assignmentManagerRoles.some((role) => activeRoles.includes(role));
}

export function isActiveAssignableMember(member) {
  const memberRoles = asArray(member?.roles);
  const status = String(member?.status || 'active').toLowerCase();

  return (
    getMemberId(member) &&
    status === 'active' &&
    !inactiveMemberStatuses.includes(status) &&
    !memberRoles.includes(roles.ADMIN) &&
    !blockedAssignmentRoles.some((role) => memberRoles.includes(role))
  );
}

export function listEligibleMembersByRole(members = [], role) {
  if (!assignablePropertyRoles.includes(role)) return [];

  return asArray(members)
    .filter((member) => isActiveAssignableMember(member) && asArray(member.roles).includes(role))
    .sort((a, b) => getMemberName(a).localeCompare(getMemberName(b)));
}

export function listAssignmentsByProperty(assignments = [], propertyId) {
  return asArray(assignments).filter((assignment) => getAssignmentPropertyId(assignment) === propertyId);
}

export function listAssignmentsByUser(assignments = [], userId) {
  return asArray(assignments).filter((assignment) => getAssignmentUserId(assignment) === userId);
}

export function hasDuplicateAssignment(assignments = [], { propertyId, userId, assignmentRole }) {
  return asArray(assignments).some(
    (assignment) =>
      getAssignmentPropertyId(assignment) === propertyId &&
      getAssignmentUserId(assignment) === userId &&
      getAssignmentRole(assignment) === assignmentRole,
  );
}

export function getAssignmentCountsByRole(assignments = [], propertyId) {
  return assignablePropertyRoles.reduce((counts, role) => {
    counts[role] = listAssignmentsByProperty(assignments, propertyId).filter(
      (assignment) => getAssignmentRole(assignment) === role,
    ).length;
    return counts;
  }, {});
}

export function getAssignedPropertyIdsForUser(assignments = [], userId, role = '') {
  return Array.from(new Set(
    listAssignmentsByUser(assignments, userId)
      .filter((assignment) => !role || getAssignmentRole(assignment) === role)
      .map(getAssignmentPropertyId)
      .filter(Boolean),
  ));
}

export function isUserAssignedToProperty(assignments = [], propertyId, userId, role = '') {
  return asArray(assignments).some(
    (assignment) =>
      getAssignmentPropertyId(assignment) === propertyId &&
      getAssignmentUserId(assignment) === userId &&
      (!role || getAssignmentRole(assignment) === role),
  );
}
