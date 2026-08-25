import type { AgentId } from '@devos/contracts';
import type { Agent, AgentVersion, Membership } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export async function requireDraftAgentVersion(
  deps: AgentUseCaseDeps,
  principalId: string,
  agentId: AgentId,
): Promise<{ agent: Agent; draft: AgentVersion; membership: Membership }> {
  const agent = await deps.agents.getById(agentId);
  if (!agent) throw new NotFoundError('Agent');

  const project = await deps.projects.getById(agent.projectId);
  if (!project) throw new NotFoundError('Agent');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Agent');

  const latest = await deps.agentVersions.getLatestForAgent(agentId);
  if (!latest) throw new NotFoundError('Agent version');

  if (latest.status !== 'DRAFT') {
    throw new ValidationError(
      'The current agent version is published and immutable; no draft is available.',
    );
  }

  return { agent, draft: latest, membership };
}
