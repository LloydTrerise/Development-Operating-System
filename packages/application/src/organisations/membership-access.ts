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
