import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import { canUpdateOrganisation, type OrganisationLlmProvider } from '@devos/domain';
import { resolveOrganisationAdminMembership } from './membership-access.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationLlmProviderUseCaseDeps } from './deps.js';

export interface UpdateOrganisationLlmProviderInput {
  credentialReference?: string;
  status?: OrganisationLlmProvider['status'];
}

/**
 * DEVOS-321 (Sprint 54). Deliberately does not accept `priority` — see
 * `packages/domain/src/organisations/organisation-llm-provider.ts`'s own
 * doc comment on why a rank change only ever goes through
 * `reorderOrganisationLlmProviders`.
 */
export async function updateOrganisationLlmProvider(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  providerId: OrganisationLlmProviderId,
  changes: UpdateOrganisationLlmProviderInput,
): Promise<OrganisationLlmProvider> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationAdminMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');
  if (!canUpdateOrganisation(membership.role)) throw new ForbiddenError();

  const provider = await deps.organisationLlmProviders.getById(providerId);
  if (!provider || provider.organisationId !== organisationId) {
    throw new NotFoundError('OrganisationLlmProvider');
  }

  if (
    changes.credentialReference !== undefined &&
    changes.credentialReference.trim().length === 0
  ) {
    throw new ValidationError('credentialReference cannot be empty.');
  }

  const updatedAt = new Date().toISOString();
  await deps.organisationLlmProviders.update(providerId, changes, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: principalId,
    action: 'organisation_llm_provider.updated',
    targetType: 'OrganisationLlmProvider',
    targetId: providerId,
    outcome: 'SUCCESS',
    metadata: { ...(changes.status !== undefined ? { status: changes.status } : {}) },
    createdAt: updatedAt,
  });

  return { ...provider, ...changes, updatedAt };
}
