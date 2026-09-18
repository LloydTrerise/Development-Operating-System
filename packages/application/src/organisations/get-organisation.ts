import type { OrganisationId } from '@devos/contracts';
import type { Organisation } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

export async function getOrganisationForPrincipal(
  deps: OrganisationUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<Organisation> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return organisation;
}
