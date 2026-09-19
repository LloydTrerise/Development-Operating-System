import type { PolicyId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { PolicyUseCaseDeps } from './deps.js';
import { resolveMembershipForPolicy } from './resolve-policy-membership.js';

export async function getPolicyForPrincipal(
  deps: PolicyUseCaseDeps,
  principalId: string,
  policyId: PolicyId,
): Promise<Policy> {
  const policy = await deps.policies.getById(policyId);
  if (!policy) throw new NotFoundError('Policy');

  const resolved = await resolveMembershipForPolicy(deps, principalId, policy);
  if (!resolved) throw new NotFoundError('Policy');

  return policy;
}
