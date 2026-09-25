import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId } from '@devos/contracts';
import { canManageMembers, type JobRole } from '@devos/domain';
import { resolveOrganisationAdminMembership } from '../organisations/membership-access.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-299/301: grants a principal a job role at organisation scope —
 * gated the same way `addOrganisationMember` is (`canManageMembers`, i.e.
 * an `ORGANISATION_ADMIN`), since holding a job role is itself an access
 * grant a project can later activate (DEVOS-300). */
export async function assignPrincipalJobRole(
  deps: JobRoleUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  targetPrincipalId: string,
  jobRoleId: string,
): Promise<JobRole> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationAdminMembership(
    deps,
    requesterPrincipalId,
    organisationId,
  );
  if (!requester) throw new NotFoundError('Organisation');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const jobRole = await deps.jobRoles.getById(jobRoleId);
  if (!jobRole || jobRole.organisationId !== organisationId) {
    throw new ValidationError('jobRoleId does not belong to this organisation.');
  }

  const now = new Date().toISOString();
  await deps.principalJobRoles.create({
    principalId: targetPrincipalId,
    jobRoleId,
    createdAt: now,
  });

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'job_role.assigned',
    targetType: 'PrincipalJobRole',
    // `principal_job_roles` has no surrogate uuid id of its own (a real,
    // disclosed composite-key-only join table) and `audit_records.target_id`
    // is a native Postgres `uuid` column — `organisationId` is the real
    // entity anchor here, mirroring `transferOrganisationOwnership`'s own
    // identical precedent; the specific principal/job-role pair is fully
    // captured in `metadata` below.
    targetId: organisationId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, jobRoleId },
    createdAt: now,
  });

  return jobRole;
}
