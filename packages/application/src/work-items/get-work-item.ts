import type { WorkItemId } from '@devos/contracts';
import type { WorkItem } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

export async function getWorkItemForPrincipal(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  workItemId: WorkItemId,
): Promise<WorkItem> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Work item');

  return workItem;
}
