import type { ArtifactId } from '@devos/contracts';
import type { Artifact } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export async function requireArtifactAccess(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactId: ArtifactId,
): Promise<Artifact> {
  const artifact = await deps.artifacts.getById(artifactId);
  if (!artifact) throw new NotFoundError('Artifact');

  const project = await deps.projects.getById(artifact.projectId);
  if (!project) throw new NotFoundError('Artifact');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Artifact');

  return artifact;
}
