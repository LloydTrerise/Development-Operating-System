import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemId } from '@devos/contracts';
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

  // DEVOS-115: extends DEVOS-086's audit coverage to work-item update.
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: workItem.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'work-item.updated',
    targetType: 'WorkItem',
    targetId: workItemId,
    outcome: 'SUCCESS',
    metadata: { changes },
    createdAt: updatedAt,
  });

  return { ...workItem, ...changes, updatedAt };
}
