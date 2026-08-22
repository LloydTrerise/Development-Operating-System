import type { ProjectId } from '@devos/contracts';
import type { RetrievalDeps } from './deps.js';
import type { RetrievedSource } from './retrieved-source.js';

/**
 * Project Context (specs/architecture/domain-model.md §5.6): "structured
 * information that applies to a project," providing stable information to
 * workflows and agents. The POC's `Project` entity already carries the
 * closest available stand-in (name/description); no dedicated
 * project-context store exists yet, so this retrieves what DevOS actually
 * has, rather than fabricating structured project-context content the spec
 * leaves unimplemented.
 */
export async function retrieveProjectContext(
  deps: RetrievalDeps,
  projectId: ProjectId,
): Promise<RetrievedSource | null> {
  const project = await deps.projects.getById(projectId);
  if (!project) return null;

  return {
    type: 'PROJECT_CONTEXT',
    ref: `project:${project.id}`,
    name: project.name,
    content: { name: project.name, description: project.description ?? null },
  };
}
