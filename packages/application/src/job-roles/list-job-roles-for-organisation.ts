import type { OrganisationId } from '@devos/contracts';
import type { JobRole } from '@devos/domain';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import { NotFoundError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-299: the seeded per-organisation catalogue — any principal with
 * standing in the organisation (direct or via a project within it) can view
 * it, mirroring `listOrganisationMembers`'s own read-access gate. */
export async function listJobRolesForOrganisation(
  deps: JobRoleUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<JobRole[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return deps.jobRoles.listForOrganisation(organisationId);
}
