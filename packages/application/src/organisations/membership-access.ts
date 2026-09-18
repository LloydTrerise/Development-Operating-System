import type { OrganisationId } from '@devos/contracts';
import type { Membership } from '@devos/domain';
import type { OrganisationUseCaseDeps } from './deps.js';

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
  deps: OrganisationUseCaseDeps,
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
