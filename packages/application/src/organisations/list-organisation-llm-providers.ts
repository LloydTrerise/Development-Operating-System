import type { OrganisationId } from '@devos/contracts';
import type { OrganisationLlmProvider } from '@devos/domain';
import { resolveOrganisationMembership } from './membership-access.js';
import { NotFoundError } from '../errors.js';
import type { OrganisationLlmProviderUseCaseDeps } from './deps.js';

/**
 * DEVOS-321 (Sprint 54): read access mirrors `listJobRolesForOrganisation`'s
 * own established gate — any principal with standing in the organisation
 * (direct or via a project within it) can view the list. Safe to expose
 * broadly: `credentialReference` is a reference *name*, never the secret it
 * points to (this sprint's own README grounding, mirroring `Integration.
 * credentialReference`'s identical, already-public precedent).
 */
export async function listOrganisationLlmProviders(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<OrganisationLlmProvider[]> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  return deps.organisationLlmProviders.listForOrganisation(organisationId);
}
