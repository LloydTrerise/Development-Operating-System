import type { ProjectId } from '@devos/contracts';
import type { Policy } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

export async function listPoliciesForProject(
  deps: PolicyUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Policy[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.policies.listForProject(projectId);
}
