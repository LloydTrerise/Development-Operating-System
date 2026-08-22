import type { ProjectId } from '@devos/contracts';
import type { Artifact } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export async function listArtifactsForProject(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Artifact[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.artifacts.listForProject(projectId);
}
