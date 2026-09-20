import type { OrganisationId } from '@devos/contracts';
import type { SharedKnowledgeSource } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

/**
 * DEVOS-189: lists what a caller can install — every real `KnowledgeSource`
 * shared across their own organisation's projects (DEVOS-188's real
 * `sharedAcrossOrganisation` flag), via DEVOS-189's own real
 * `knowledge_sources` ⋈ `projects` join. Mirrors
 * `listSharedAgentVersionsForOrganisation`'s own membership-check shape.
 */
export async function listSharedKnowledgeSourcesForOrganisation(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<SharedKnowledgeSource[]> {
  const memberships = (await deps.memberships.listForPrincipal(principalId)).filter(
    (membership) => membership.organisationId === organisationId,
  );
  if (memberships.length === 0) throw new NotFoundError('Organisation');

  if (!deps.knowledgeSources.listSharedForOrganisation) return [];
  return deps.knowledgeSources.listSharedForOrganisation(organisationId);
}
