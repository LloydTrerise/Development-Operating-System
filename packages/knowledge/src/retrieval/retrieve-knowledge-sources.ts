import type { ProjectId } from '@devos/contracts';
import type { RetrievalDeps } from './deps.js';
import type { RetrievedSource } from './retrieved-source.js';

function toRetrievedSource(source: {
  id: string;
  name: string;
  content: string;
}): RetrievedSource {
  return {
    type: 'KNOWLEDGE_SOURCE',
    ref: `knowledge-source:${source.id}`,
    name: source.name,
    content: source.content,
  };
}

/**
 * "Resolve approved knowledge sources" (specs/workflows/software-change-workflow.md
 * §28, step 2). Only `ACTIVE` sources are retrievable — there is no
 * separate publish/approval state for a knowledge source (DEVOS-039), so
 * `ACTIVE` is the approved state.
 *
 * DEVOS-187: when a real, non-empty `query` is supplied and the repository
 * supports real Postgres full-text search (`searchForProject`, optional —
 * see `RetrievalDeps`), this narrows to real, ranked keyword matches instead
 * of every `ACTIVE` source. Zero matches, no query, or no repository
 * support all fall back to today's exact unconditional-inclusion behaviour
 * — never a surprising empty context (see `specs/sprints/sprint-25/README.md`'s
 * own recorded design decision). Never embeddings/semantic search.
 */
export async function retrieveActiveKnowledgeSources(
  deps: RetrievalDeps,
  projectId: ProjectId,
  query?: string,
): Promise<RetrievedSource[]> {
  const trimmedQuery = query?.trim();
  if (trimmedQuery && deps.knowledgeSources.searchForProject) {
    const matches = await deps.knowledgeSources.searchForProject(projectId, trimmedQuery);
    if (matches.length > 0) return matches.map(toRetrievedSource);
  }

  const sources = await deps.knowledgeSources.listForProject(projectId);
  return sources.filter((source) => source.status === 'ACTIVE').map(toRetrievedSource);
}
