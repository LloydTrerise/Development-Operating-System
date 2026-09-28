import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import { canUpdateOrganisation } from '@devos/domain';
import { resolveOrganisationAdminMembership } from './membership-access.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationLlmProviderUseCaseDeps } from './deps.js';

/**
 * DEVOS-321 (Sprint 54). `orderedIds` must be exactly the organisation's
 * current full set of provider ids (same length, same ids, no duplicates) —
 * validated here before the transactional primitive runs, per
 * `ReorderOrganisationLlmProviders`'s own doc comment.
 */
export async function reorderOrganisationLlmProviders(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  orderedIds: OrganisationLlmProviderId[],
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationAdminMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');
  if (!canUpdateOrganisation(membership.role)) throw new ForbiddenError();

  const existing = await deps.organisationLlmProviders.listForOrganisation(organisationId);
  const existingIds = new Set(existing.map((row) => row.id));
  const submittedIds = new Set(orderedIds);

  if (
    orderedIds.length !== existing.length ||
    submittedIds.size !== orderedIds.length ||
    existing.some((row) => !submittedIds.has(row.id)) ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new ValidationError(
      'orderedIds must contain exactly this organisation’s current set of provider ids, with no duplicates.',
    );
  }

  const updatedAt = new Date().toISOString();
  await deps.reorderOrganisationLlmProviders(organisationId, orderedIds, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: principalId,
    action: 'organisation_llm_provider.reordered',
    targetType: 'Organisation',
    targetId: organisationId,
    outcome: 'SUCCESS',
    metadata: { orderedIds },
    createdAt: updatedAt,
  });
}
