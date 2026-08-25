import { randomUUID } from 'node:crypto';
import type { AuditId, PolicyId } from '@devos/contracts';
import { canPublishPolicy, type Policy } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export async function publishPolicy(
  deps: PolicyUseCaseDeps,
  principalId: string,
  policyId: PolicyId,
): Promise<Policy> {
  const policy = await deps.policies.getById(policyId);
  if (!policy) throw new NotFoundError('Policy');

  const project =
    policy.projectId !== undefined ? await deps.projects.getById(policy.projectId) : null;
  if (!project) throw new NotFoundError('Policy');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Policy');
  if (!canPublishPolicy(membership.role)) {
    throw new ForbiddenError('Only a project owner may publish a policy.');
  }

  if (policy.status !== 'DRAFT') {
    throw new ValidationError(`Policy "${policy.key}" version ${policy.version} is not a draft.`);
  }

  const publishedAt = new Date().toISOString();
  await deps.policies.publish(policy.id, publishedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: membership.organisationId,
    projectId: project.id,
    actorType: 'USER',
    actorId: principalId,
    action: 'policy.published',
    targetType: 'Policy',
    targetId: policy.id,
    outcome: 'SUCCESS',
    metadata: { key: policy.key, version: policy.version },
    createdAt: publishedAt,
  });

  return { ...policy, status: 'PUBLISHED', publishedAt };
}
