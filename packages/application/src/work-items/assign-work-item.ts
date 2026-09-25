import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemId } from '@devos/contracts';
import { canManageMembers, workItemAssignmentRoles, type WorkItemAssignment } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

/**
 * DEVOS-304/305 (Sprint 50): grants a principal `ASSIGNEE`/`REVIEWER`/
 * `APPROVER` on a work item — gated by `canManageMembers` (i.e. project
 * `OWNER`/organisation `ORGANISATION_ADMIN`/owner), mirroring
 * `assignProjectMemberJobRole`'s own identical precedent for "who can grant
 * another principal a project-scoped attribute" (Sprint 49,
 * `packages/application/src/job-roles/assign-project-member-job-role.ts`).
 * A disclosed design choice: the source document's own §6.5 acceptance
 * summary names no gate for this action, so this sprint reuses the
 * codebase's own most recent, established precedent rather than inventing
 * a new one.
 *
 * **Hand-off exception** (added after this sprint's own initial completion,
 * per explicit user request): a principal who is not `canManageMembers`
 * but *is* currently the work item's own `ASSIGNEE` may hand `ASSIGNEE`
 * off to another real project member — a real-world "reassign my ticket"
 * action. This is a genuine transfer, not an additive grant: the
 * requester's own `ASSIGNEE` row is removed as part of the same call, so
 * the work item never ends up with two self-granted assignees through
 * this path. The exception applies only to the `ASSIGNEE` role and only
 * for a non-`canManageMembers` requester — an admin granting `ASSIGNEE`
 * through the ordinary gate keeps the original purely-additive behavior
 * (they may still call `removeWorkItemAssignment` separately for an
 * exclusive transfer, or grant a second assignee deliberately).
 */
export async function assignWorkItem(
  deps: WorkItemUseCaseDeps,
  requesterPrincipalId: string,
  workItemId: WorkItemId,
  targetPrincipalId: string,
  role: string,
): Promise<WorkItemAssignment> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Work item');

  if (!workItemAssignmentRoles.includes(role as (typeof workItemAssignmentRoles)[number])) {
    throw new ValidationError(`role must be one of: ${workItemAssignmentRoles.join(', ')}.`);
  }
  const assignmentRole = role as WorkItemAssignment['role'];

  const existingAssignments = await deps.workItemAssignments.listForWorkItem(workItemId);
  const requesterIsCurrentAssignee = existingAssignments.some(
    (a) => a.principalId === requesterPrincipalId && a.role === 'ASSIGNEE',
  );
  const isHandoff = assignmentRole === 'ASSIGNEE' && requesterIsCurrentAssignee;

  if (!canManageMembers(requester.role) && !isHandoff) throw new ForbiddenError();

  const target = await resolveMembership(deps, targetPrincipalId, project);
  if (!target) {
    throw new ValidationError('targetPrincipalId must be a member of this project.');
  }

  const now = new Date().toISOString();
  const assignment: WorkItemAssignment = {
    workItemId,
    principalId: targetPrincipalId,
    role: assignmentRole,
    createdAt: now,
  };

  if (isHandoff && !canManageMembers(requester.role)) {
    await deps.workItemAssignments.remove(workItemId, requesterPrincipalId, 'ASSIGNEE');
  }
  await deps.workItemAssignments.create(assignment);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: workItem.projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: isHandoff ? 'work_item_assignment.handed_off' : 'work_item_assignment.assigned',
    targetType: 'WorkItem',
    targetId: workItemId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, role: assignmentRole },
    createdAt: now,
  });

  return assignment;
}
