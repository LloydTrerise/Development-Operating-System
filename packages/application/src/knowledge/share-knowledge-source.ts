import { randomUUID } from 'node:crypto';
import type { AuditId, KnowledgeSourceId } from '@devos/contracts';
import { canPublishAgent, type KnowledgeSource } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

/**
 * DEVOS-188 (Sprint 25): the real, organisation-scoped "share" primitive —
 * an additive `sharedAcrossOrganisation` flag on an existing `ACTIVE`
 * `KnowledgeSource`, mirroring `shareAgentVersion`'s (DEVOS-177) identical
 * design exactly. Reuses `canPublishAgent` directly rather than introducing
 * a same-shaped `canShareKnowledgeSource` purely to rename an identical
 * `role === 'OWNER'` check (see `specs/sprints/sprint-25/DEVOS-188.md`).
 * Sharing an `ARCHIVED` source makes no sense (nothing worth installing) and
 * is rejected, mirroring `shareAgentVersion`'s own "sharing a draft makes no
 * sense" check.
 */
export async function shareKnowledgeSource(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  knowledgeSourceId: KnowledgeSourceId,
  shared: boolean,
): Promise<KnowledgeSource> {
  const source = await deps.knowledgeSources.getById(knowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');

  const project = await deps.projects.getById(source.projectId);
  if (!project) throw new NotFoundError('KnowledgeSource');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('KnowledgeSource');

  if (source.status !== 'ACTIVE') {
    throw new ValidationError('Only an active knowledge source may be shared.');
  }

  if (!canPublishAgent(membership.role)) {
    throw new ForbiddenError('Only a project owner may share a knowledge source.');
  }

  if (!deps.knowledgeSources.setSharedAcrossOrganisation) {
    throw new ValidationError('Sharing knowledge sources is not supported by this deployment.');
  }
  await deps.knowledgeSources.setSharedAcrossOrganisation(source.id, shared);

  const decidedAt = new Date().toISOString();
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId: source.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: shared ? 'knowledge-source.shared' : 'knowledge-source.unshared',
    targetType: 'KnowledgeSource',
    targetId: source.id,
    outcome: 'SUCCESS',
    metadata: { key: source.key },
    createdAt: decidedAt,
  });

  return { ...source, sharedAcrossOrganisation: shared };
}
