import type { ProjectId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

export async function listKnowledgeSourcesForProject(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<KnowledgeSource[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.knowledgeSources.listForProject(projectId);
}
