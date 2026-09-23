import { randomUUID } from 'node:crypto';
import type { AuditId, MembershipId, OrganisationId } from '@devos/contracts';
import { canManageMembers } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import {
  assertNotLastOrganisationAdmin,
  assertNotRemovingCurrentOwner,
  resolveOrganisationMembership,
} from './membership-access.js';

/** DEVOS-254: mirrors `projects/remove-member.ts` exactly, at organisation
 * scope. */
export async function removeOrganisationMember(
  deps: OrganisationUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  targetMembershipId: MembershipId,
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationMembership(deps, requesterPrincipalId, organisationId);
  if (!requester) throw new NotFoundError('Organisation');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const target = ((await deps.memberships.listForOrganisation?.(organisationId)) ?? []).find(
    (membership) => membership.id === targetMembershipId,
  );
  if (!target) throw new NotFoundError('Membership');

  assertNotRemovingCurrentOwner(organisation, target);
  await assertNotLastOrganisationAdmin(deps, organisationId, target.id);

  await deps.memberships.remove(target.id);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'membership.removed',
    targetType: 'Membership',
    targetId: target.id,
    outcome: 'SUCCESS',
    metadata: { principalId: target.principalId, role: target.role },
    createdAt: new Date().toISOString(),
  });
}
