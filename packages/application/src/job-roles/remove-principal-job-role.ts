import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId } from '@devos/contracts';
import { canManageMembers } from '@devos/domain';
import { resolveOrganisationAdminMembership } from '../organisations/membership-access.js';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

/** DEVOS-299/301: revokes a job role at organisation scope. Migration
 * `0052`'s `ON DELETE CASCADE` also deactivates it from every project it
 * was activated on (DEVOS-300) — the correct real-world semantics, not
 * something this use case needs to do itself. */
export async function removePrincipalJobRole(
  deps: JobRoleUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  targetPrincipalId: string,
  jobRoleId: string,
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationAdminMembership(
    deps,
    requesterPrincipalId,
    organisationId,
  );
  if (!requester) throw new NotFoundError('Organisation');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  await deps.principalJobRoles.remove(targetPrincipalId, jobRoleId);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'job_role.removed',
    targetType: 'PrincipalJobRole',
    // See assign-principal-job-role.ts's identical comment: no surrogate
    // uuid id exists for this composite-key-only join table, so
    // `organisationId` is the real entity anchor here.
    targetId: organisationId,
    outcome: 'SUCCESS',
    metadata: { principalId: targetPrincipalId, jobRoleId },
    createdAt: new Date().toISOString(),
  });
}
