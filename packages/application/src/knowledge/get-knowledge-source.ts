import type { KnowledgeSourceId } from '@devos/contracts';
import type { KnowledgeSource } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

export async function getKnowledgeSourceForPrincipal(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  knowledgeSourceId: KnowledgeSourceId,
): Promise<KnowledgeSource> {
  const source = await deps.knowledgeSources.getById(knowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');

  const project = await deps.projects.getById(source.projectId);
  if (!project) throw new NotFoundError('KnowledgeSource');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('KnowledgeSource');

  return source;
}
