import { randomUUID } from 'node:crypto';
import type { OrganisationId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export interface CreateOrganisationPolicyInput {
  key: string;
  definition: Record<string, unknown>;
}

/**
 * DEVOS-139: the organisation-scoped mirror of `createPolicy` — the exact
 * same "revise by drafting a new version" rule, applied one scope level up.
 * A `Policy` created here has no `projectId` (schema/domain-representable
 * since Sprint 3, never exercised until this task).
 */
export async function createOrganisationPolicy(
  deps: PolicyUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
  input: CreateOrganisationPolicyInput,
): Promise<Policy> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const membership = await resolveOrganisationMembership(deps, principalId, organisationId);
  if (!membership) throw new NotFoundError('Organisation');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (Object.keys(input.definition).length === 0) {
    throw new ValidationError('definition must not be empty.');
  }

  const latest = await deps.policies.getLatestForOrganisationAndKey(organisationId, input.key);
  if (latest && latest.status === 'DRAFT') {
    throw new ValidationError(
      `Policy "${input.key}" already has an unpublished draft (version ${latest.version}); publish or revise it instead of creating another draft.`,
    );
  }

  const now = new Date().toISOString();
  const policy: Policy = {
    id: randomUUID() as Policy['id'],
    organisationId,
    key: input.key,
    version: (latest?.version ?? 0) + 1,
    status: 'DRAFT',
    definition: input.definition,
    createdBy: principalId,
    createdAt: now,
  };

  await deps.policies.create(policy);

  return policy;
}
