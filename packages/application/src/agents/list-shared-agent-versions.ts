import type { OrganisationId } from '@devos/contracts';
import type { SharedAgentVersion } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-178: lists what a caller can install — every real `AgentVersion`
 * shared across their own organisation's projects (DEVOS-177's real
 * `sharedAcrossOrganisation` flag), via DEVOS-178's own real
 * `agent_versions` ⋈ `agents` ⋈ `projects` join. Mirrors
 * `listAuditRecordsForOrganisation`'s own membership-check shape; the
 * check itself is inlined (reading only `deps.memberships`, already
 * present) rather than reusing `resolveOrganisationMembership`, whose own
 * declared parameter type requires an `organisations` repository this
 * module has no other use for.
 */
export async function listSharedAgentVersionsForOrganisation(
  deps: AgentUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<SharedAgentVersion[]> {
  const memberships = (await deps.memberships.listForPrincipal(principalId)).filter(
    (membership) => membership.organisationId === organisationId,
  );
  if (memberships.length === 0) throw new NotFoundError('Organisation');

  if (!deps.agentVersions.listSharedForOrganisation) return [];
  return deps.agentVersions.listSharedForOrganisation(organisationId);
}
