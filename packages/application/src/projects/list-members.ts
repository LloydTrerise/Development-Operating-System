import type { ProjectId } from '@devos/contracts';
import type { Membership } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';
import { resolveMembership } from './membership-access.js';

export async function listMembers(
  deps: ProjectUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Membership[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.memberships.listForProject(projectId);
}
