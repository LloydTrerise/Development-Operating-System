import type { OrganisationId } from '@devos/contracts';
import type { JobRole } from '@devos/domain';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import { NotFoundError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-299: the job roles a specific principal holds at organisation
 * scope, resolved against the org's own catalogue (a held row whose job
 * role has since been removed from the catalogue — never happens today, no
 * route deletes a `JobRole` — would be silently dropped rather than
 * surfaced as a dangling id). */
export async function listPrincipalJobRoles(
  deps: JobRoleUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  targetPrincipalId: string,
): Promise<JobRole[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationMembership(deps, requesterPrincipalId, organisationId);
  if (!requester) throw new NotFoundError('Organisation');

  const catalogue = await deps.jobRoles.listForOrganisation(organisationId);
  const catalogueById = new Map(catalogue.map((jobRole) => [jobRole.id, jobRole]));

  const held = await deps.principalJobRoles.listForPrincipal(targetPrincipalId);

  return held
    .map((row) => catalogueById.get(row.jobRoleId))
    .filter((jobRole): jobRole is JobRole => jobRole !== undefined);
}
