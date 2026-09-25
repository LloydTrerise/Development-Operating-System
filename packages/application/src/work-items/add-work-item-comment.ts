import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemCommentId, WorkItemId } from '@devos/contracts';
import type { CreateWorkItemCommentInput, WorkItemComment } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';

/**
 * DEVOS-309 (Sprint 51 reconciliation): the source document's
 * `workitem.comment` grants ✓ to "project member" directly (unlike
 * `workitem.edit`/`workitem.transition`, which need a specific assignment)
 * — any resolved project membership suffices, mirroring `createWorkItem`'s
 * own "members can create work items" bar.
 */
export async function addWorkItemComment(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  workItemId: WorkItemId,
  input: CreateWorkItemCommentInput,
): Promise<WorkItemComment> {
  const workItem = await deps.workItems.getById(workItemId);
  if (!workItem) throw new NotFoundError('Work item');

  const project = await deps.projects.getById(workItem.projectId);
  if (!project) throw new NotFoundError('Work item');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Work item');

  if (input.body.trim().length === 0) throw new ValidationError('body is required.');

  const now = new Date().toISOString();
  const comment: WorkItemComment = {
    id: randomUUID() as WorkItemCommentId,
    workItemId,
    principalId,
    body: input.body,
    createdAt: now,
  };

  await deps.workItemComments.create(comment);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: workItem.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'work-item.commented',
    targetType: 'WorkItem',
    targetId: workItemId,
    outcome: 'SUCCESS',
    metadata: { commentId: comment.id },
    createdAt: now,
  });

  return comment;
}
