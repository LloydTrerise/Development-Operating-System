import type { OrganisationId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export async function listPoliciesForOrganisation(
  deps: PolicyUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<Policy[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return deps.policies.listForOrganisation(organisationId);
}
