import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import { canManageMembers, type ProjectMemberJobRole } from '@devos/domain';
import { resolveMembership } from '../projects/membership-access.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-300/301: activates a job role for a principal on a specific
 * project — the per-project subset of what they already hold at
 * organisation scope (DEVOS-299). Migration `0052`'s composite FK enforces
 * "already holds it" at the database layer; this use case pre-checks the
 * same rule so a caller gets a clean `ValidationError` rather than a raw
 * foreign-key-violation error surfacing from Postgres. */
export async function assignProjectMemberJobRole(
  deps: JobRoleUseCaseDeps,
  requesterPrincipalId: string,
  projectId: ProjectId,
  targetPrincipalId: string,
  jobRoleId: string,
): Promise<ProjectMemberJobRole> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Project');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const jobRole = await deps.jobRoles.getById(jobRoleId);
  if (!jobRole || jobRole.organisationId !== project.organisationId) {
    throw new ValidationError('jobRoleId does not belong to the project organisation.');
  }

  const held = await deps.principalJobRoles.listForPrincipal(targetPrincipalId);
  if (!held.some((row) => row.jobRoleId === jobRoleId)) {
    throw new ValidationError(
      'Principal does not hold this job role at organisation scope — grant it there first.',
    );
  }

  const now = new Date().toISOString();
  const row: ProjectMemberJobRole = {
    projectId,
    principalId: targetPrincipalId,
    jobRoleId,
    createdAt: now,
  };
  await deps.projectMemberJobRoles.create(row);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'project_member_job_role.assigned',
    targetType: 'ProjectMemberJobRole',
    // `project_member_job_roles` has no surrogate uuid id of its own (a
    // real, disclosed composite-key-only join table) and
    // `audit_records.target_id` is a native Postgres `uuid` column —
    // `projectId` is the real entity anchor here, mirroring
    // `transferOrganisationOwnership`'s own identical precedent at
    // organisation scope; the specific principal/job-role pair is fully
    // captured in `metadata` below.
    targetId: projectId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, jobRoleId },
    createdAt: now,
  });

  return row;
}
