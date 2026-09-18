import type { OrganisationId } from '@devos/contracts';
import type { Organisation } from '@devos/domain';
import type { OrganisationUseCaseDeps } from './deps.js';

/** Every organisation the principal has any membership in, direct
 * (org-level) or via a project within it — mirrors
 * `listProjectsForPrincipal`'s own shape one scope level up. */
export async function listOrganisationsForPrincipal(
  deps: OrganisationUseCaseDeps,
  principalId: string,
): Promise<Organisation[]> {
  const memberships = await deps.memberships.listForPrincipal(principalId);
  const organisationIds = new Set<OrganisationId>(memberships.map((m) => m.organisationId));

  const organisations = await Promise.all(
    [...organisationIds].map((id) => deps.organisations.getById(id)),
  );

  return organisations.filter(
    (organisation): organisation is Organisation => organisation !== null,
  );
}
