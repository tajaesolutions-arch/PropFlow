import { demoUsers } from '../data/sampleData.js';
import { roleRedirects } from '../data/constants.js';

export function resolvePrimaryRole(user) {
  return user?.roles?.[0] || 'host';
}

export function getPostLoginPath(user) {
  if (user?.status === 'suspended') return '/suspended';
  return roleRedirects[resolvePrimaryRole(user)] || '/dashboard';
}

export function findDemoUser(idOrEmail) {
  return demoUsers.find((user) => user.id === idOrEmail || user.email === idOrEmail) || demoUsers[1];
}
