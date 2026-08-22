import type { ProjectId } from '@devos/contracts';
import type { WorkItem } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

export async function listWorkItemsForProject(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<WorkItem[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.workItems.listForProject(projectId);
}
