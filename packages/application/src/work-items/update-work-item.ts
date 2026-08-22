import type { WorkItemId } from '@devos/contracts';
import type { UpdateWorkItemInput, WorkItem } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

export async function updateWorkItem(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  workItemId: WorkItemId,
  changes: UpdateWorkItemInput,
): Promise<WorkItem> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Work item');

  const updatedAt = new Date().toISOString();
  await deps.workItems.update(workItemId, changes, updatedAt);

  return { ...workItem, ...changes, updatedAt };
}
