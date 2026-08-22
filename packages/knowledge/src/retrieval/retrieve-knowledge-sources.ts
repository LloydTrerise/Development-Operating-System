import type { ProjectId } from '@devos/contracts';
import type { RetrievalDeps } from './deps.js';
import type { RetrievedSource } from './retrieved-source.js';

/**
 * "Resolve approved knowledge sources" (specs/workflows/software-change-workflow.md
 * §28, step 2). Only `ACTIVE` sources are retrievable — there is no
 * separate publish/approval state for a knowledge source (DEVOS-039), so
 * `ACTIVE` is the approved state.
 */
export async function retrieveActiveKnowledgeSources(
  deps: RetrievalDeps,
  projectId: ProjectId,
): Promise<RetrievedSource[]> {
  const sources = await deps.knowledgeSources.listForProject(projectId);

  return sources
    .filter((source) => source.status === 'ACTIVE')
    .map((source) => ({
      type: 'KNOWLEDGE_SOURCE',
      ref: `knowledge-source:${source.id}`,
      name: source.name,
      content: source.content,
    }));
}
