import { randomUUID } from 'node:crypto';
import type { AuditId, WorkItemId } from '@devos/contracts';
import type { UpdateWorkItemInput, WorkItem } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';
import { assertParentBelongsToProject } from './validate-parent-work-item.js';

/**
 * DEVOS-305 (Sprint 50, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.5):
 * narrows this previously-unrestricted update endpoint — "today, any
 * project member can edit any work item" (§2.5) — to the source document's
 * own rule: editing non-status fields requires holding `ASSIGNEE` on this
 * specific work item; changing `status` (a transition) requires
 * `ASSIGNEE`, `REVIEWER`, or `APPROVER`. A single request may do both at
 * once (e.g. `{ status, title }` together) — each half is checked against
 * its own rule, not the looser of the two, so a `REVIEWER` who is not the
 * `ASSIGNEE` can transition status but not also sneak in a title change in
 * the same call.
 */
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

  const assignments = await deps.workItemAssignments.listForWorkItem(workItemId);
  const requesterRoles = new Set(
    assignments.filter((a) => a.principalId === principalId).map((a) => a.role),
  );

  const isEdit =
    changes.title !== undefined ||
    changes.description !== undefined ||
    changes.priority !== undefined ||
    changes.metadata !== undefined ||
    changes.parentId !== undefined;
  const isTransition = changes.status !== undefined;

  if (isEdit && !requesterRoles.has('ASSIGNEE')) throw new ForbiddenError();
  if (
    isTransition &&
    !requesterRoles.has('ASSIGNEE') &&
    !requesterRoles.has('REVIEWER') &&
    !requesterRoles.has('APPROVER')
  ) {
    throw new ForbiddenError();
  }

  // DEVOS-303 follow-up: `null` explicitly clears the parent (always valid,
  // no cycle possible by removing an edge) — only a real `WorkItemId` needs
  // the same-project + cycle check.
  if (changes.parentId !== undefined && changes.parentId !== null) {
    await assertParentBelongsToProject(deps, workItem.projectId, changes.parentId, workItemId);
  }

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

  // `exactOptionalPropertyTypes` forbids assigning `parentId: undefined`
  // explicitly, so a cleared parent (`changes.parentId === null`) is
  // removed via `delete` rather than set to `undefined`.
  const { parentId: parentIdChange, ...otherChanges } = changes;
  const updated: WorkItem = { ...workItem, ...otherChanges, updatedAt };
  if (parentIdChange === null) {
    delete updated.parentId;
  } else if (parentIdChange !== undefined) {
    updated.parentId = parentIdChange;
  }

  return updated;
}
