import type { OrganisationId } from '@devos/contracts';
import { canUpdateOrganisation } from '@devos/domain';
import type { Organisation, UpdateOrganisationInput } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

export async function updateOrganisation(
  deps: OrganisationUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  changes: UpdateOrganisationInput,
): Promise<Organisation> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');
  if (!canUpdateOrganisation(membership.role)) throw new ForbiddenError();

  const updatedAt = new Date().toISOString();
  await deps.organisations.update(organisationId, changes, updatedAt);

  return { ...organisation, ...changes, updatedAt };
}
