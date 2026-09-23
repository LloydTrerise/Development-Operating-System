import { randomUUID } from 'node:crypto';
import type { AuditId, OrganisationId } from '@devos/contracts';
import type { Organisation } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { OrganisationUseCaseDeps } from './deps.js';

/**
 * DEVOS-290/293: "transferable only by the current owner" — the target
 * must already be a real `ORGANISATION_ADMIN` co-admin (add them via
 * `addOrganisationMember` first if not); this deliberately rules out the
 * "owner with zero membership row" edge case `0048`'s own migration
 * comment names as merely defensive, not a real path this codebase's own
 * UI (DEVOS-293) or API ever produces.
 */
export async function transferOrganisationOwnership(
  deps: OrganisationUseCaseDeps,
  requesterPrincipalId: string,
  organisationId: OrganisationId,
  newOwnerPrincipalId: string,
): Promise<Organisation> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');
  if (organisation.ownerPrincipalId !== requesterPrincipalId) throw new ForbiddenError();

  const members = (await deps.memberships.listForOrganisation?.(organisationId)) ?? [];
  const target = members.find(
    (member) => member.principalId === newOwnerPrincipalId && member.role === 'ORGANISATION_ADMIN',
  );
  if (!target) {
    throw new ValidationError('The new owner must already be an organisation admin.');
  }

  const updatedAt = new Date().toISOString();
  await deps.organisations.setOwnerPrincipalId(organisationId, newOwnerPrincipalId, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'organisation.ownership_transferred',
    targetType: 'Organisation',
    targetId: organisationId,
    outcome: 'SUCCESS',
    metadata: {
      previousOwnerPrincipalId: organisation.ownerPrincipalId,
      newOwnerPrincipalId,
    },
    createdAt: updatedAt,
  });

  return { ...organisation, ownerPrincipalId: newOwnerPrincipalId, updatedAt };
}
