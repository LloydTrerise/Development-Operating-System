import { randomUUID } from 'node:crypto';
import type { AgentId, AuditId } from '@devos/contracts';
import { canPublishAgent, type AgentVersion } from '@devos/domain';
import { ForbiddenError } from '../errors.js';
import { requireDraftAgentVersion } from './draft-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export async function publishAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<AgentVersion> {
  const { agent, draft, membership } = await requireDraftAgentVersion(deps, principalId, agentId);
  if (!canPublishAgent(membership.role)) {
    throw new ForbiddenError('Only a project owner may publish an agent version.');
  }

  const publishedAt = new Date().toISOString();
  await deps.agentVersions.publish(draft.id, publishedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: membership.organisationId,
    projectId: agent.projectId,
    actorType: 'USER',
    actorId: principalId,
    action: 'agent_version.published',
    targetType: 'AgentVersion',
    targetId: draft.id,
    outcome: 'SUCCESS',
    metadata: { agentId: agent.id, version: draft.version },
    createdAt: publishedAt,
  });

  return { ...draft, status: 'PUBLISHED', publishedAt };
}
