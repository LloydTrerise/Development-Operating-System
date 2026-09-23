import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId } from '@devos/contracts';
import { canManageMembers, type Membership, type MembershipRole } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';
import { resolveOrganisationMembership } from './membership-access.js';

export interface AddOrganisationMemberInput {
  principalId: string;
  role: MembershipRole;
}

/** DEVOS-254: mirrors `projects/add-member.ts` exactly, at organisation
 * scope (`projectId: null`).
 *
 * DEVOS-290: `ORGANISATION_ADMIN` is the only valid org-level role now
 * (decision §9.3 drops the org-level `MEMBER` concept entirely) — rejects
 * anything else rather than silently accepting a role this scope no longer
 * has a meaning for. */
export async function addOrganisationMember(
  deps: OrganisationUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  input: AddOrganisationMemberInput,
): Promise<Membership> {
  if (input.role !== 'ORGANISATION_ADMIN') {
    throw new ValidationError('Organisation membership only supports the ORGANISATION_ADMIN role.');
  }

  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');

  const requester = await resolveOrganisationMembership(deps, requesterPrincipalId, organisationId);
  if (!requester) throw new NotFoundError('Organisation');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const existing = ((await deps.memberships.listForOrganisation?.(organisationId)) ?? []).find(
    (membership) => membership.principalId === input.principalId,
  );
  if (existing) throw new ValidationError('Principal is already a member of this organisation.');

  const now = new Date().toISOString();
  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId: null,
    principalId: input.principalId,
    role: input.role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.memberships.create(membership);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'membership.added',
    targetType: 'Membership',
    targetId: membership.id,
    outcome: 'SUCCESS',
    metadata: { principalId: input.principalId, role: input.role },
    createdAt: now,
  });

  return membership;
}
