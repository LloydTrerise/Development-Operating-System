import type { OrganisationId } from '@devos/contracts';
import type { Membership } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

/** DEVOS-254: mirrors `projects/list-members.ts` exactly, at organisation
 * scope. */
export async function listOrganisationMembers(
  deps: OrganisationUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<Membership[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return (await deps.memberships.listForOrganisation?.(organisationId)) ?? [];
}
