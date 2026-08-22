import type { PolicyId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export async function getPolicyForPrincipal(
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

  return policy;
}
