import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import { canUpdateOrganisation } from '@devos/domain';
import { resolveOrganisationAdminMembership } from './membership-access.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { OrganisationLlmProviderUseCaseDeps } from './deps.js';

/** DEVOS-321 (Sprint 54). Leaves the remaining rows' own `priority` values
 * as-is — a gap in the sequence is harmless, since DEVOS-319's resolution
 * only ever reads ascending order, never assumes a contiguous 1..N range. */
export async function deleteOrganisationLlmProvider(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  providerId: OrganisationLlmProviderId,
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationAdminMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');
  if (!canUpdateOrganisation(membership.role)) throw new ForbiddenError();

  const provider = await deps.organisationLlmProviders.getById(providerId);
  if (!provider || provider.organisationId !== organisationId) {
    throw new NotFoundError('OrganisationLlmProvider');
  }

  await deps.organisationLlmProviders.delete(providerId);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: principalId,
    action: 'organisation_llm_provider.deleted',
    targetType: 'OrganisationLlmProvider',
    targetId: providerId,
    outcome: 'SUCCESS',
    metadata: { provider: provider.provider },
    createdAt: new Date().toISOString(),
  });
}
