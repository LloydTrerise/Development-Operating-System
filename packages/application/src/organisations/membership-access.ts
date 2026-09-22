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
 * exactly, at organisation scope — guards against removing or demoting the
 * last org-level (`projectId: null`) `OWNER` membership.
 */
export async function assertNotLastOrganisationOwner(
  deps: OrganisationMembershipAccessDeps,
  organisationId: OrganisationId,
  excludingMembershipId: Membership['id'],
): Promise<void> {
  const members = (await deps.memberships.listForOrganisation?.(organisationId)) ?? [];
  const otherOwners = members.filter(
    (member) => member.role === 'OWNER' && member.id !== excludingMembershipId,
  );

  if (otherOwners.length === 0) {
    throw new ValidationError('Cannot remove the last owner of an organisation.');
  }
}
