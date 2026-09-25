import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemId } from '@devos/contracts';
import { canManageMembers, type WorkItem } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

export const ARCHIVED_WORK_ITEM_STATUS = 'ARCHIVED';

/**
 * DEVOS-309 (Sprint 51 reconciliation): the source document's
 * `workitem.delete` — granted to "division admin/owner" and "project
 * admin" only, with a blank cell (no grant at all) for "project member,"
 * the one row among the eight `workitem.*` permissions where even the
 * `ASSIGNEE` gets nothing. Implemented as a soft archive (`status` set to
 * `ARCHIVED`), not a hard delete, per this codebase's own established
 * "nothing is hard-deleted" convention (`AGENTS.md` §3/§23,
 * `Project.status`'s own identical pattern) — `WorkItemStatus` is already
 * an unconstrained `string` (`packages/contracts/src/status.ts`), so no
 * schema change is needed, only a real, distinct, more-privileged use case
 * than `updateWorkItem`'s own `ASSIGNEE`/`REVIEWER`/`APPROVER`-gated status
 * transition — deliberately not reachable through that broader path.
 */
export async function archiveWorkItem(
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
  if (!canManageMembers(membership.role)) throw new ForbiddenError();

  if (workItem.status === ARCHIVED_WORK_ITEM_STATUS) {
    throw new ValidationError('This work item is already archived.');
  }

  const updatedAt = new Date().toISOString();
  await deps.workItems.update(workItemId, { status: ARCHIVED_WORK_ITEM_STATUS }, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: workItem.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'work-item.archived',
    targetType: 'WorkItem',
    targetId: workItemId,
    outcome: 'SUCCESS',
    metadata: { previousStatus: workItem.status },
    createdAt: updatedAt,
  });

  return { ...workItem, status: ARCHIVED_WORK_ITEM_STATUS, updatedAt };
}
