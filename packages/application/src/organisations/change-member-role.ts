import { randomUUID } from 'node:crypto';
import type { AuditId, MembershipId, OrganisationId } from '@devos/contracts';
import { canManageMembers, type Membership, type MembershipRole } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

/** DEVOS-254: mirrors `projects/change-member-role.ts` exactly, at
 * organisation scope.
 *
 * DEVOS-290: `ORGANISATION_ADMIN` is the only valid org-level role now
 * (decision §9.3) — there is no other role left to change to or from, so
 * this becomes an idempotent confirmation, kept for API/DTO continuity with
 * `projects/change-member-role.ts`'s identical shape rather than removed
 * outright. */
export async function changeOrganisationMemberRole(
  deps: OrganisationUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  targetMembershipId: MembershipId,
  role: MembershipRole,
): Promise<Membership> {
  if (role !== 'ORGANISATION_ADMIN') {
    throw new ValidationError('Organisation membership only supports the ORGANISATION_ADMIN role.');
  }

  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationMembership(deps, requesterPrincipalId, organisationId);
  if (!requester) throw new NotFoundError('Organisation');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const target = ((await deps.memberships.listForOrganisation?.(organisationId)) ?? []).find(
    (membership) => membership.id === targetMembershipId,
  );
  if (!target) throw new NotFoundError('Membership');

  const previousRole = target.role;
  const updatedAt = new Date().toISOString();
  await deps.memberships.updateRole(target.id, role, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'membership.role_changed',
    targetType: 'Membership',
    targetId: target.id,
    outcome: 'SUCCESS',
    metadata: { principalId: target.principalId, previousRole, role },
    createdAt: updatedAt,
  });

  return { ...target, role, updatedAt };
}
