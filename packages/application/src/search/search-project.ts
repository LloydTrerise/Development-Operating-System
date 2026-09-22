import type { Agent, Artifact, WorkflowDefinition, WorkItem } from '@devos/domain';
import type { ProjectId } from '@devos/contracts';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { SearchUseCaseDeps } from './deps.js';

export interface ProjectSearchResults {
  projectId: ProjectId;
  query: string;
  workItems: WorkItem[];
  artifacts: Artifact[];
  workflows: WorkflowDefinition[];
  agents: Agent[];
}

/**
 * DEVOS-262: fans out across DEVOS-261's four new `searchForProject`
 * repository methods within one project, gated by `resolveMembership()`
 * exactly as every other project-scoped use case already does — no new
 * permission model. Mirrors `getProjectSystemHealth`'s (DEVOS-258) own
 * "one project-scoped use case, `Promise.all` over already-constructed
 * repositories" shape.
 *
 * Deliberately does not include `knowledge_sources.searchForProject`
 * (DEVOS-187) — that method's real, only caller today is RAG context
 * retrieval (`packages/knowledge`), never a user-facing search surface, and
 * this story's own backlog text names only the four DEVOS-261 entities.
 *
 * An empty/whitespace-only query short-circuits to empty results for all
 * four entities without touching Postgres — never a surprising "everything"
 * result for a blank search box.
 */
export async function searchProject(
  deps: SearchUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  query: string,
): Promise<ProjectSearchResults> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return {
      projectId,
      query: trimmedQuery,
      workItems: [],
      artifacts: [],
      workflows: [],
      agents: [],
    };
  }

  const [workItems, artifacts, workflows, agents] = await Promise.all([
    deps.workItems.searchForProject?.(projectId, trimmedQuery) ?? Promise.resolve([]),
    deps.artifacts.searchForProject?.(projectId, trimmedQuery) ?? Promise.resolve([]),
    deps.workflowDefinitions.searchForProject?.(projectId, trimmedQuery) ?? Promise.resolve([]),
    deps.agents.searchForProject?.(projectId, trimmedQuery) ?? Promise.resolve([]),
  ]);

  return { projectId, query: trimmedQuery, workItems, artifacts, workflows, agents };
}
