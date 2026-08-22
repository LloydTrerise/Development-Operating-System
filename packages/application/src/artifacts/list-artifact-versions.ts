import type { ArtifactId } from '@devos/contracts';
import type { ArtifactVersion } from '@devos/domain';
import { requireArtifactAccess } from './artifact-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export async function listArtifactVersions(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactId: ArtifactId,
): Promise<ArtifactVersion[]> {
  await requireArtifactAccess(deps, principalId, artifactId);
  return deps.artifactVersions.listForArtifact(artifactId);
}
