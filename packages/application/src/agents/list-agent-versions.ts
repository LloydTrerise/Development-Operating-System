import type { AgentId } from '@devos/contracts';
import type { AgentVersion } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

/**
 * DEVOS-173: the version-history read `AgentsPage.tsx` needs — no route
 * anywhere previously returned more than a bare `Agent` (`getAgentForPrincipal`
 * returns only the agent itself, not its versions). Mirrors
 * `getAgentForPrincipal`'s own membership-check shape exactly.
 */
export async function listAgentVersionsForAgent(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<AgentVersion[]> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  return deps.agentVersions.listForAgent(agentId);
}
