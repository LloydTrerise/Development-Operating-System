import type { Artifact, ArtifactVersion } from '@devos/domain';
import { BadRequestError } from '../http/errors.js';

export function toArtifactDto(artifact: Artifact) {
  return {
    id: artifact.id,
    projectId: artifact.projectId,
    type: artifact.artifactType,
    name: artifact.name,
    status: artifact.status,
    provenance: {
      workflowRunId: artifact.workflowRunId,
      workflowTaskId: artifact.workflowTaskId,
    },
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}

export function toArtifactVersionDto(version: ArtifactVersion) {
  return {
    id: version.id,
    artifactId: version.artifactId,
    version: version.version,
    contentType: version.contentType,
    contentUri: version.contentUri,
    contentHash: version.contentHash,
    metadata: version.metadata,
    createdBy: version.createdBy,
    createdAt: version.createdAt,
  };
}

/** DEVOS-095: an artifact version plus its owning artifact's name/type, so
 * a caller that only holds a bare `artifactVersionId` (e.g. an approval's
 * evidence) can show something more meaningful than a raw id. */
export function toArtifactVersionWithArtifactDto({
  version,
  artifact,
}: {
  version: ArtifactVersion;
  artifact: Artifact;
}) {
  return {
    ...toArtifactVersionDto(version),
    artifactName: artifact.name,
    artifactType: artifact.artifactType,
  };
}

export interface CreateArtifactBody {
  artifactType: string;
  name: string;
  content: string;
  contentType?: string;
}

export function parseCreateArtifactBody(body: unknown): CreateArtifactBody {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestError('Request body must be a JSON object.');
  }
  const { artifactType, name, content, contentType } = body as Record<string, unknown>;

  if (typeof artifactType !== 'string' || artifactType.trim().length === 0) {
    throw new BadRequestError('artifactType is required.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('name is required.');
  }
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new BadRequestError('content is required.');
  }
  if (contentType !== undefined && typeof contentType !== 'string') {
    throw new BadRequestError('contentType must be a string.');
  }

  return { artifactType, name, content, ...(contentType !== undefined ? { contentType } : {}) };
}

export function parseVersionNumber(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestError('version must be a positive integer.');
  }
  return value;
}
