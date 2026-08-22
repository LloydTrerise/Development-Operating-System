import type { AgentId } from '@devos/contracts';
import type { Agent } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export async function getAgentForPrincipal(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<Agent> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  return agent;
}
