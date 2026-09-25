import type { OrganisationId } from '@devos/contracts';
import type { Membership, MembershipRepository } from '@devos/domain';
import { ValidationError } from '../errors.js';

/**
 * DEVOS-254: narrowed to only what these two functions actually touch
 * (`memberships`), not the full `OrganisationUseCaseDeps` — mirrors
 * `projects/membership-access.ts`'s identical `MembershipAccessDeps`
 * narrowing. `getOrganisationCostReport`/`getOrganisationEngineeringReport`
 * (whose own deps interfaces have no `auditRecords`) both call
 * `resolveOrganisationMembership` and would otherwise be broken by
 * `OrganisationUseCaseDeps` gaining that field for DEVOS-254's own audit
 * writes.
 */
export interface OrganisationMembershipAccessDeps {
  memberships: MembershipRepository;
}

/**
 * Every `Membership` row carries its own `organisationId` regardless of
 * whether it's org-level (`projectId: null`) or project-level — so
 * resolving "does this principal have any standing in this organisation"
 * never needs to cross-reference the `projects` table. Prefers a direct
 * org-level membership; falls back to any project-level membership within
 * the organisation (today's single-org reality — no organisation has an
 * explicit org-level OWNER yet, but its projects' OWNERs should still be
 * able to manage it).
 */
export async function resolveOrganisationMembership(
  deps: OrganisationMembershipAccessDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<Membership | null> {
  const memberships = (await deps.memberships.listForPrincipal(principalId)).filter(
    (membership) => membership.organisationId === organisationId,
  );
  if (memberships.length === 0) return null;

  const orgLevel = memberships.find((membership) => membership.projectId === null);
  if (orgLevel) return orgLevel;

  return memberships.find((membership) => membership.role === 'OWNER') ?? memberships[0]!;
}

/**
 * DEVOS-309 (Sprint 51 reconciliation): strictly org-level (`projectId:
 * null`) membership only — used by organisation-admin-gated *write* actions
 * (`updateOrganisation`, add/remove/change-member-role, assign/remove a
 * principal's org-held job role). Unlike `resolveOrganisationMembership`'s
 * broader "any standing in this org" fallback (kept unchanged for read-only
 * org-wide visibility routes — `getOrganisationForPrincipal`, member
 * listing, cost/audit/engineering-report reads, policy/workflow/job-role
 * listing — a design Sprint 39/42 established deliberately and this task
 * does not revisit), this never falls back to a project-level role.
 *
 * `resolveOrganisationMembership`'s own project-level-`OWNER` fallback
 * (above) predates DEVOS-290 (Sprint 47) and was itself a deliberate,
 * tested Sprint 39 (DEVOS-254) design for a real gap at the time: most
 * organisations had no org-level membership row at all. That gap no longer
 * exists — every organisation is now guaranteed a real org-level
 * `ORGANISATION_ADMIN` row (`createOrganisation`; migration `0048`'s own
 * backfill) — so letting that same fallback continue to satisfy
 * `canManageMembers`/`canUpdateOrganisation` is a real, live privilege-
 * escalation path this epic's own model was built specifically to close
 * (§9.2/§9.3): the `OWNER` of even one project, never granted any
 * organisation-level standing, could rename the organisation or add
 * themselves as `ORGANISATION_ADMIN` — which then grants full authority
 * over *every* project in the organisation via `resolveMembership`'s own,
 * correctly narrower, org-level-only fallback
 * (`packages/application/src/projects/membership-access.ts`).
 */
export async function resolveOrganisationAdminMembership(
  deps: OrganisationMembershipAccessDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<Membership | null> {
  const memberships = await deps.memberships.listForPrincipal(principalId);
  return (
    memberships.find(
      (membership) => membership.organisationId === organisationId && membership.projectId === null,
    ) ?? null
  );
}

/**
 * DEVOS-254: mirrors `projects/membership-access.ts`'s `assertNotLastOwner`
 * exactly, at organisation scope — guards against removing the last
 * org-level (`projectId: null`) `ORGANISATION_ADMIN` membership (renamed
 * from `OWNER`/`assertNotLastOrganisationOwner` by DEVOS-290, since
 * `ORGANISATION_ADMIN` is the only org-level role that exists now, decision
 * §9.3).
 */
export async function assertNotLastOrganisationAdmin(
  deps: OrganisationMembershipAccessDeps,
  organisationId: OrganisationId,
  excludingMembershipId: Membership['id'],
): Promise<void> {
  const members = (await deps.memberships.listForOrganisation?.(organisationId)) ?? [];
  const otherAdmins = members.filter(
    (member) => member.role === 'ORGANISATION_ADMIN' && member.id !== excludingMembershipId,
  );

  if (otherAdmins.length === 0) {
    throw new ValidationError('Cannot remove the last admin of an organisation.');
  }
}

/**
 * DEVOS-290: the single transferable `owner_principal_id` must never be
 * removed from the co-admin pool it belongs to without first transferring
 * ownership to someone else — distinct from, and checked in addition to,
 * `assertNotLastOrganisationAdmin` (a co-admin pool of three could lose its
 * *current owner* member while two other admins remain, which
 * `assertNotLastOrganisationAdmin` alone would not catch).
 */
export function assertNotRemovingCurrentOwner(
  organisation: { ownerPrincipalId?: string },
  target: Membership,
): void {
  if (
    organisation.ownerPrincipalId !== undefined &&
    organisation.ownerPrincipalId === target.principalId
  ) {
    throw new ValidationError(
      'Cannot remove or demote the current owner — transfer ownership first.',
    );
  }
}
