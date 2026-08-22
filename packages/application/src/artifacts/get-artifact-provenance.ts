import type { ArtifactId } from '@devos/contracts';
import { requireArtifactAccess } from './artifact-access.js';
import type { ArtifactUseCaseDeps } from './deps.js';

export interface ArtifactProvenance {
  workflowRunId?: string;
  workflowTaskId?: string;
}

export async function getArtifactProvenance(
  deps: ArtifactUseCaseDeps,
  principalId: string,
  artifactId: ArtifactId,
): Promise<ArtifactProvenance> {
  const artifact = await requireArtifactAccess(deps, principalId, artifactId);

  return {
    ...(artifact.workflowRunId !== undefined ? { workflowRunId: artifact.workflowRunId } : {}),
    ...(artifact.workflowTaskId !== undefined ? { workflowTaskId: artifact.workflowTaskId } : {}),
  };
}
