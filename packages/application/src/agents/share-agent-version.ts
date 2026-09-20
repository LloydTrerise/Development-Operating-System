import { randomUUID } from 'node:crypto';
import type { AgentId, AuditId } from '@devos/contracts';
import { canPublishAgent, type AgentVersion } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-177 (Sprint 23): the real, organisation-scoped "share" primitive —
 * an additive `sharedAcrossOrganisation` flag on an existing `PUBLISHED`
 * `AgentVersion` (the user's own accepted default from
 * `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §10), gated by the same
 * `canPublishAgent` (`OWNER`) check `publishAgentVersion` already
 * establishes — sharing is a publish-adjacent authority, not a separate
 * role. Sharing a `DRAFT` makes no sense (nothing to install yet) and is
 * rejected, mirroring `requireDraftAgentVersion`'s own inverse check.
 */
export async function shareAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
  version: number,
  shared: boolean,
): Promise<AgentVersion> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  const target = await deps.agentVersions.getByAgentAndVersion(agentId, version);
  if (!target) throw new NotFoundError('Agent version');

  if (target.status !== 'PUBLISHED') {
    throw new ValidationError('Only a published agent version may be shared.');
  }

  if (!canPublishAgent(membership.role)) {
    throw new ForbiddenError('Only a project owner may share an agent version.');
  }

  if (!deps.agentVersions.setSharedAcrossOrganisation) {
    throw new ValidationError('Sharing agent versions is not supported by this deployment.');
  }
  await deps.agentVersions.setSharedAcrossOrganisation(target.id, shared);

  const decidedAt = new Date().toISOString();
  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: membership.organisationId,
    projectId: agent.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: shared ? 'agent_version.shared' : 'agent_version.unshared',
    targetType: 'AgentVersion',
    targetId: target.id,
    outcome: 'SUCCESS',
    metadata: { agentId: agent.id, version: target.version },
    createdAt: decidedAt,
  });

  return { ...target, sharedAcrossOrganisation: shared };
}
