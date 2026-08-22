import type { AgentId } from '@devos/contracts';
import type { AgentVersion } from '@devos/domain';
import { requireDraftAgentVersion } from './draft-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export async function publishAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<AgentVersion> {
  const { draft } = await requireDraftAgentVersion(deps, principalId, agentId);

  const publishedAt = new Date().toISOString();
  await deps.agentVersions.publish(draft.id, publishedAt);

  return { ...draft, status: 'PUBLISHED', publishedAt };
}
