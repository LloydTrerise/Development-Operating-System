import { randomUUID } from 'node:crypto';
import type { ProjectId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export interface CreatePolicyInput {
  key: string;
  definition: Record<string, unknown>;
}

/**
 * Creates the next draft version of a policy: version 1 for a new key, or
 * the next integer after the highest existing version for that
 * project+key — a policy is revised by drafting a new version, never by
 * mutating a published one (specs/api/poc-api-contracts.md §31: "Published
 * policy versions are immutable").
 */
export async function createPolicy(
  deps: PolicyUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreatePolicyInput,
): Promise<Policy> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.key.trim().length === 0) throw new ValidationError('key is required.');
  if (Object.keys(input.definition).length === 0) {
    throw new ValidationError('definition must not be empty.');
  }

  const latest = await deps.policies.getLatestForProjectAndKey(projectId, input.key);
  if (latest && latest.status === 'DRAFT') {
    throw new ValidationError(
      `Policy "${input.key}" already has an unpublished draft (version ${latest.version}); publish or revise it instead of creating another draft.`,
    );
  }

  const now = new Date().toISOString();
  const policy: Policy = {
    id: randomUUID() as Policy['id'],
    organisationId: project.organisationId,
    projectId,
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
