import type { KnowledgeSourceId } from '@devos/contracts';
import type { KnowledgeReference } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { KnowledgeUseCaseDeps } from './deps.js';

/**
 * DEVOS-184: the real, previously-nonexistent read side of usage
 * traceability — every real execution that has actually used this
 * knowledge source, per `run-agent-task.ts`'s own new write path.
 */
export async function getKnowledgeSourceReferences(
  deps: KnowledgeUseCaseDeps,
  principalId: string,
  knowledgeSourceId: KnowledgeSourceId,
): Promise<KnowledgeReference[]> {
  const source = await deps.knowledgeSources.getById(knowledgeSourceId);
  if (!source) throw new NotFoundError('KnowledgeSource');

  const project = await deps.projects.getById(source.projectId);
  if (!project) throw new NotFoundError('KnowledgeSource');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('KnowledgeSource');

  if (!deps.knowledgeReferences) return [];
  return deps.knowledgeReferences.listForSource(knowledgeSourceId);
}
