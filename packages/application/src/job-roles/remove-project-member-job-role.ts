import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import { canManageMembers } from '@devos/domain';
import { resolveMembership } from '../projects/membership-access.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-300/301: deactivates a job role for a principal on a specific
 * project — does not touch whether they still hold it at organisation
 * scope (DEVOS-299), only whether it's active here. */
export async function removeProjectMemberJobRole(
  deps: JobRoleUseCaseDeps,
  requesterPrincipalId: string,
  projectId: ProjectId,
  targetPrincipalId: string,
  jobRoleId: string,
): Promise<void> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Project');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  await deps.projectMemberJobRoles.remove(projectId, targetPrincipalId, jobRoleId);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'project_member_job_role.removed',
    targetType: 'ProjectMemberJobRole',
    // See assign-project-member-job-role.ts's identical comment: no
    // surrogate uuid id exists for this composite-key-only join table, so
    // `projectId` is the real entity anchor here.
    targetId: projectId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, jobRoleId },
    createdAt: new Date().toISOString(),
  });
}
