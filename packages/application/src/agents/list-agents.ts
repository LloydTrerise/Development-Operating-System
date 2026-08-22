import type { ProjectId } from '@devos/contracts';
import type { Agent } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { AgentUseCaseDeps } from './deps.js';

export async function listAgentsForProject(
  deps: AgentUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Agent[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.agents.listForProject(projectId);
}
