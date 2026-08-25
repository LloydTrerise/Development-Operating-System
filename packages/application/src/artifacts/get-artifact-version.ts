import type { ArtifactId, ArtifactVersionId } from '@devos/contracts';
import type { Artifact, ArtifactVersion } from '@devos/domain';
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

/**
 * DEVOS-095: resolves an artifact version by its own id (not by
 * artifactId+version number, the only lookup `getArtifactVersionByNumber`
 * supports) — what a caller holding only a bare `artifactVersionId` (e.g.
 * an approval's `evidenceReference.artifactVersionIds`, DEVOS-045) actually
 * has. Returns the owning artifact alongside the version so a caller can
 * show a real name/type instead of the raw id, without a second
 * access-checked round trip.
 */
export async function getArtifactVersionById(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactVersionId: ArtifactVersionId,
): Promise<{ version: ArtifactVersion; artifact: Artifact }> {
  const version = await deps.artifactVersions.getById(artifactVersionId);
  if (!version) throw new NotFoundError('Artifact version');

  const artifact = await requireArtifactAccess(deps, principalId, version.artifactId);
  return { version, artifact };
}
