import type { ArtifactId } from '@devos/contracts';
import type { Artifact } from '@devos/domain';
import { requireArtifactAccess } from './artifact-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export async function getArtifactForPrincipal(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactId: ArtifactId,
): Promise<Artifact> {
  return requireArtifactAccess(deps, principalId, artifactId);
}
