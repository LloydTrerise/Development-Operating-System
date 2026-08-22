import type { ProjectId, WorkflowRunId } from '@devos/contracts';
import type { RetrievalDeps } from './deps.js';
import type { RetrievedSource } from './retrieved-source.js';

/**
 * Retrieves the latest version of every artifact produced so far by a
 * given workflow run, within a project — "retrieve relevant artifacts"
 * (specs/architecture/system-context-engineering-knowledge.md §22, step 6).
 * Content comes from `ArtifactVersion.metadata`, the same in-memory
 * representation the four planning-path agent handlers (DEVOS-032–034)
 * already read directly — not the raw stored bytes behind `contentUri`,
 * which would require an `ArtifactStorage` round trip this task's scope
 * does not need.
 */
export async function retrieveArtifactsForRun(
  deps: RetrievalDeps,
  projectId: ProjectId,
  workflowRunId: WorkflowRunId,
): Promise<RetrievedSource[]> {
  const artifacts = await deps.artifacts.listForProject(projectId);
  const runArtifacts = artifacts.filter((artifact) => artifact.workflowRunId === workflowRunId);

  const sources: RetrievedSource[] = [];

  for (const artifact of runArtifacts) {
    const versions = await deps.artifactVersions.listForArtifact(artifact.id);
    const latest = versions.sort((a, b) => b.version - a.version)[0];
    if (!latest) continue;

    sources.push({
      type: 'ARTIFACT',
      ref: `artifact:${artifact.id}:v${latest.version}`,
      name: artifact.name,
      content: latest.metadata ?? {},
    });
  }

  return sources;
}
