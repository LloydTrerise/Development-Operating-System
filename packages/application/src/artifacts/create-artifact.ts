import { randomUUID } from 'node:crypto';
import type { ProjectId } from '@devos/contracts';
import type { Artifact, ArtifactVersion } from '@devos/domain';
import { NotFoundError, ValidationError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export interface CreateArtifactInput {
  artifactType: string;
  name: string;
  content: string;
  contentType?: string;
}

export async function createArtifact(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
  input: CreateArtifactInput,
): Promise<{ artifact: Artifact; version: ArtifactVersion }> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  if (input.artifactType.trim().length === 0)
    throw new ValidationError('artifactType is required.');
  if (input.name.trim().length === 0) throw new ValidationError('name is required.');
  if (input.content.trim().length === 0) throw new ValidationError('content is required.');

  const contentType = input.contentType ?? 'text/plain';
  const stored = await deps.storage.put(input.content, contentType);

  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId,
    artifactType: input.artifactType,
    name: input.name,
    status: 'GENERATED',
    createdBy: principalId,
    createdAt: now,
    updatedAt: now,
  };

  const version: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifact.id,
    version: 1,
    contentType,
    contentUri: stored.uri,
    contentHash: stored.hash,
    createdBy: principalId,
    createdAt: now,
  };

  await deps.publishArtifact(artifact, version);

  return { artifact, version };
}
