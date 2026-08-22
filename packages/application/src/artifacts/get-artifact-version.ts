import type { ArtifactId } from '@devos/contracts';
import type { ArtifactVersion } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { requireArtifactAccess } from './artifact-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export async function getArtifactVersionByNumber(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactId: ArtifactId,
  versionNumber: number,
): Promise<ArtifactVersion> {
  await requireArtifactAccess(deps, principalId, artifactId);

  const versions = await deps.artifactVersions.listForArtifact(artifactId);
  const version = versions.find((v) => v.version === versionNumber);
  if (!version) throw new NotFoundError('Artifact version');

  return version;
}
