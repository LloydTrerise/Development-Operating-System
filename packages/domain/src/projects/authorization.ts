import { hasProjectPermission } from '../access-control/permission-catalogue.js';
import type { MembershipRole } from './membership.js';

/**
 * DEVOS-289 (Sprint 47, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.2):
 * every function below is now catalogue-driven — it consults the real
 * `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` rows migration `0047` seeds
 * (via `hasProjectPermission`'s in-memory cache, see
 * `../access-control/permission-catalogue.js`'s own doc comment for why a
 * cache rather than a widened async signature) instead of a bare
 * `role === 'OWNER'` literal. Every exported function keeps its exact
 * original name and signature, so every existing call site (18 files) and
 * this module's own pre-existing `packages/domain/tests/authorization.test.ts`
 * are unaffected — the default catalogue reproduces today's grants exactly.
 */
export function canManageMembers(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'project.manage_members');
}

export function canUpdateProject(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'project.update');
}

/** DEVOS: Organisations & Project Types — same bar as every other
 * consequential action in this file, applied one scope level up. */
export function canUpdateOrganisation(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'organisation.update');
}

/**
 * Approval decisions carry the same authority as a human release gate
 * (specs/api/poc-api-contracts.md §30: "reviewer role") — no dedicated
 * reviewer role exists in this codebase, so `OWNER` is used, consistent
 * with every other consequential project action below.
 */
export function canDecideApproval(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'approval.decide');
}

export function canPublishPolicy(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'policy.publish');
}

export function canRegisterIntegration(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'integration.register');
}

export function canPublishAgent(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'agent.publish');
}

export function canPublishWorkflow(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'workflow.publish');
}

/** DEVOS-256: enabling/disabling a tool capability is a consequential,
 * project-wide action (it changes what every agent/workflow in the project
 * may invoke) — same bar as every other action in this file. */
export function canManageToolCapabilities(role: MembershipRole): boolean {
  return hasProjectPermission(role, 'tool_capability.manage');
}
