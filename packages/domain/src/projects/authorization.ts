import type { MembershipRole } from './membership.js';

export function canManageMembers(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canUpdateProject(role: MembershipRole): boolean {
  return role === 'OWNER';
}

/** DEVOS: Organisations & Project Types — same OWNER-only bar as every
 * other consequential action in this file, applied one scope level up. */
export function canUpdateOrganisation(role: MembershipRole): boolean {
  return role === 'OWNER';
}

/**
 * Approval decisions carry the same authority as a human release gate
 * (specs/api/poc-api-contracts.md §30: "reviewer role") — no dedicated
 * reviewer role exists in this codebase, so `OWNER` is used, consistent
 * with every other consequential project action below.
 */
export function canDecideApproval(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canPublishPolicy(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canRegisterIntegration(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canPublishAgent(role: MembershipRole): boolean {
  return role === 'OWNER';
}

export function canPublishWorkflow(role: MembershipRole): boolean {
  return role === 'OWNER';
}
