import type { WorkItemId } from '@devos/contracts';
import type { WorkItemAssignment } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

/** DEVOS-306: backs the work item detail view's assignment picker — any
 * project member may read who is currently assigned, mirroring
 * `getWorkItemForPrincipal`'s own membership-only gate. */
export async function listWorkItemAssignments(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  workItemId: WorkItemId,
): Promise<WorkItemAssignment[]> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Work item');

  return deps.workItemAssignments.listForWorkItem(workItemId);
}
