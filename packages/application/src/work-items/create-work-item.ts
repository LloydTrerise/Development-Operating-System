import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import type { CreateWorkItemInput, WorkItem } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { WorkItemUseCaseDeps } from './deps.js';
import { assertParentBelongsToProject } from './validate-parent-work-item.js';

const DEFAULT_TYPE = 'GENERAL';
const DEFAULT_PRIORITY = 'MEDIUM';
const DEFAULT_STATUS = 'OPEN';

export async function createWorkItem(
  deps: WorkItemUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateWorkItemInput,
): Promise<WorkItem> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.title.trim().length === 0) throw new ValidationError('title is required.');

  if (input.parentId !== undefined) {
    await assertParentBelongsToProject(deps, projectId, input.parentId);
  }

  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
    ...(input.externalRef !== undefined ? { externalRef: input.externalRef } : {}),
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    type: input.type ?? DEFAULT_TYPE,
    status: DEFAULT_STATUS,
    priority: input.priority ?? DEFAULT_PRIORITY,
    ...(input.source !== undefined ? { source: input.source } : {}),
    metadata: input.metadata ?? {},
    createdBy: principalId,
    createdAt: now,
    updatedAt: now,
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
  };

  await deps.workItems.create(workItem);

  // DEVOS-305: the creator is the work item's initial ASSIGNEE — the real,
  // ongoing counterpart to migration `0055`'s one-time backfill of every
  // work item that existed before this sprint. Without this, a work item
  // created after this sprint ships would have zero assignments and so be
  // uneditable by anyone at all under `updateWorkItem`'s new
  // assignment-gated check below — the same "don't ship a restriction with
  // nothing satisfying it yet" mistake decision §9.6 already flags for the
  // backfill migration, just at the creation path instead.
  await deps.workItemAssignments.create({
    workItemId: workItem.id,
    principalId,
    role: 'ASSIGNEE',
    createdAt: now,
  });

  // DEVOS-115: extends DEVOS-086's audit coverage to work-item creation.
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'work-item.created',
    targetType: 'WorkItem',
    targetId: workItem.id,
    outcome: 'SUCCESS',
    metadata: { title: workItem.title, type: workItem.type },
    createdAt: now,
  });

  return workItem;
}
