import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemId } from '@devos/contracts';
import {
  canManageMembers,
  workItemAssignmentRoles,
  type WorkItemAssignmentRole,
} from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

/** DEVOS-304/305 (Sprint 50): revokes a role grant — same gate as
 * `assignWorkItem`. */
export async function removeWorkItemAssignment(
  deps: WorkItemUseCaseDeps,
  requesterPrincipalId: string,
  workItemId: WorkItemId,
  targetPrincipalId: string,
  role: string,
): Promise<void> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Work item');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  if (!workItemAssignmentRoles.includes(role as WorkItemAssignmentRole)) {
    throw new ValidationError(`role must be one of: ${workItemAssignmentRoles.join(', ')}.`);
  }
  const assignmentRole = role as WorkItemAssignmentRole;

  await deps.workItemAssignments.remove(workItemId, targetPrincipalId, assignmentRole);

  const now = new Date().toISOString();
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: workItem.projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'work_item_assignment.removed',
    targetType: 'WorkItem',
    targetId: workItemId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, role: assignmentRole },
    createdAt: now,
  });
}
