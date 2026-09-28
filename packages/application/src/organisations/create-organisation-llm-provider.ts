import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId } from '@devos/contracts';
import { canUpdateOrganisation, type OrganisationLlmProvider } from '@devos/domain';
import { isLlmProviderKey, LLM_PROVIDER_KEYS } from '@devos/agents';
import { resolveOrganisationAdminMembership } from './membership-access.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationLlmProviderUseCaseDeps } from './deps.js';

export interface CreateOrganisationLlmProviderInput {
  provider: string;
  credentialReference: string;
}

/**
 * DEVOS-321 (Sprint 54). Gated via `resolveOrganisationAdminMembership`/
 * `canUpdateOrganisation` — the same organisation-admin-only bar
 * `updateOrganisation` already uses (DEVOS-320's own disclosed reuse
 * decision, `specs/sprints/sprint-54/DEVOS-320.md`). The new row's
 * `priority` is computed here (max existing + 1, or 1 if none exist) — the
 * client never supplies it, keeping the unique-per-organisation invariant
 * (migration `0059`) trivially satisfiable on create.
 */
export async function createOrganisationLlmProvider(
  deps: OrganisationLlmProviderUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  input: CreateOrganisationLlmProviderInput,
): Promise<OrganisationLlmProvider> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationAdminMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');
  if (!canUpdateOrganisation(membership.role)) throw new ForbiddenError();

  if (!isLlmProviderKey(input.provider)) {
    throw new ValidationError(
      `provider "${input.provider}" is not a registered provider (expected one of: ${LLM_PROVIDER_KEYS.join(', ')}).`,
    );
  }
  if (input.credentialReference.trim().length === 0) {
    throw new ValidationError('credentialReference is required.');
  }

  const existing = await deps.organisationLlmProviders.listForOrganisation(organisationId);
  const nextPriority = existing.reduce((max, row) => Math.max(max, row.priority), 0) + 1;

  const now = new Date().toISOString();
  const provider: OrganisationLlmProvider = {
    id: randomUUID() as OrganisationLlmProvider['id'],
    organisationId,
    provider: input.provider,
    credentialReference: input.credentialReference,
    priority: nextPriority,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.organisationLlmProviders.create(provider);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: principalId,
    action: 'organisation_llm_provider.created',
    targetType: 'OrganisationLlmProvider',
    targetId: provider.id,
    outcome: 'SUCCESS',
    // credentialReference is a reference *name*, never the secret value it
    // points to (per this sprint's own README grounding) — safe to record.
    metadata: { provider: provider.provider, priority: provider.priority },
    createdAt: now,
  });

  return provider;
}
