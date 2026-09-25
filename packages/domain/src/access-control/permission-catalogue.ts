import type { MembershipRole } from '../projects/membership.js';

/**
 * DEVOS-289: one key per pre-existing `canX()` function in
 * `packages/projects/authorization.ts` — the exact permission set migration
 * `0047` seeds into `PROJECT:OWNER`'s `role_permissions` rows, reproducing
 * every one of today's hardcoded grants exactly (`PROJECT:MEMBER` gets
 * none). Widened by migration `0048` (DEVOS-290) to also grant
 * `ORGANISATION_ADMIN` every one of these same nine permissions — an
 * organisation admin/owner needs project-OWNER-equivalent authority on
 * every project in their organisation, matching the `resolveMembership()`
 * org-level fallback (`packages/application/src/projects/membership-access.ts`)
 * these functions are ultimately called through.
 */
export const projectPermissionKeys = [
  'project.manage_members',
  'project.update',
  'organisation.update',
  'approval.decide',
  'policy.publish',
  'integration.register',
  'agent.publish',
  'workflow.publish',
  'tool_capability.manage',
  /** DEVOS-309 (Sprint 51 reconciliation, migration `0057`): "create,
   * configure" an agent — see `canManageAgent`'s own doc comment in
   * `../projects/authorization.ts` for why this is role-based only for
   * creation, with a separate, non-catalogue accountable-owner exception
   * layered on top for configuring an existing agent. */
  'agent.manage',
] as const;
export type ProjectPermissionKey = (typeof projectPermissionKeys)[number];

export type AccessRoleCatalogue = Partial<
  Record<MembershipRole, ReadonlySet<ProjectPermissionKey>>
>;

/**
 * A literal mirror of this sprint's own final, real seeded grants — `OWNER`
 * and `ORGANISATION_ADMIN` both get every permission (migrations `0047`/
 * `0048`), `MEMBER` gets none. Every synchronous `canX(role)` caller in this
 * codebase — including this module's own pre-existing, deliberately
 * unmodified `packages/domain/tests/authorization.test.ts` (which only ever
 * exercises `OWNER`/`MEMBER`, so is unaffected either way) — keeps working
 * with zero setup as long as nothing ever calls
 * `configureAccessRoleCatalogue`, which is exactly what happens in every
 * test that doesn't explicitly exercise the real catalogue-loading path
 * (`packages/application/src/access-control/load-access-control-catalogue.ts`).
 * `ORGANISATION_ADMIN` needs project-OWNER-equivalent authority by default
 * too — every in-memory `OrganisationUseCaseDeps`/`ProjectUseCaseDeps` test
 * fake across `packages/application/tests/` resolves an org-level
 * membership's role straight from this default, never from the real DB
 * catalogue, so an incomplete default here would make `canManageMembers`/
 * `canUpdateOrganisation` silently deny every organisation admin in every
 * such test — the real class of bug this sprint's own implementation
 * caught (`packages/application/tests/organisations.test.ts`) before
 * disclosure, not left latent.
 */
const DEFAULT_ACCESS_ROLE_CATALOGUE: AccessRoleCatalogue = {
  OWNER: new Set(projectPermissionKeys),
  MEMBER: new Set(),
  ORGANISATION_ADMIN: new Set(projectPermissionKeys),
};

let activeCatalogue: AccessRoleCatalogue = DEFAULT_ACCESS_ROLE_CATALOGUE;

/**
 * Swaps the in-memory permission catalogue `hasProjectPermission` consults
 * for the real `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` rows loaded from
 * Postgres — see `loadAccessRoleCatalogueFromRepository`, wired into
 * `apps/api/src/app.ts` at boot. A disclosed, deliberate design choice: the
 * many existing synchronous `canX(role): boolean` call sites across this
 * codebase (18 files) cannot be changed to an async, deps-carrying
 * signature without a much larger blast radius for zero behavioral
 * benefit, so the catalogue itself is hot-swappable module state instead —
 * safe specifically because the default above already matches the real
 * seeded values exactly, so behavior never depends on load timing.
 */
export function configureAccessRoleCatalogue(catalogue: AccessRoleCatalogue): void {
  activeCatalogue = catalogue;
}

/** Test-only: restores the literal pre-DEVOS-288 default. */
export function resetAccessRoleCatalogueForTesting(): void {
  activeCatalogue = DEFAULT_ACCESS_ROLE_CATALOGUE;
}

export function hasProjectPermission(
  role: MembershipRole,
  permission: ProjectPermissionKey,
): boolean {
  return activeCatalogue[role]?.has(permission) ?? false;
}
