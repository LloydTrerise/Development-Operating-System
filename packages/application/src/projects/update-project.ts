import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import { canUpdateProject, type Project, type UpdateProjectInput } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';
import { resolveMembership } from './membership-access.js';

export async function updateProject(
  deps: ProjectUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  changes: UpdateProjectInput,
): Promise<Project> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');
  if (!canUpdateProject(membership.role)) throw new ForbiddenError();

  const updatedAt = new Date().toISOString();
  await deps.projects.update(projectId, changes, updatedAt);

  // DEVOS-115: extends DEVOS-086's audit coverage to project update.
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'project.updated',
    targetType: 'Project',
    targetId: projectId,
    outcome: 'SUCCESS',
    metadata: { changes },
    createdAt: updatedAt,
  });

  return { ...project, ...changes, updatedAt };
}
