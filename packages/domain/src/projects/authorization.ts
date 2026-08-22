import type { MembershipRole } from './membership.js';

export function canManageMembers(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canUpdateProject(role: MembershipRole): boolean {
  return role === 'OWNER';
}
