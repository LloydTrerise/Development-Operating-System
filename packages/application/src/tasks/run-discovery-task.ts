import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import type { TaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

/**
 * Deterministic, non-LLM stand-in for real agent execution (DEVOS-016).
 * Produces a DISCOVERY_REPORT artifact from the run's work item. Swapping
 * this out for real agent execution later is a one-line change in
 * apps/worker/src/main.ts's handler registration — nothing about the task
 * queue, dispatcher, or storage needs to change.
 */
export async function runDiscoveryTask(
  deps: TaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const now = new Date().toISOString();
  const content = {
    artifactType: 'DISCOVERY_REPORT',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    summary: `Deterministic discovery pass for work item "${workItem.title}".`,
    description: workItem.description ?? null,
    findings: [
      'No LLM was used to produce this report — it is a deterministic placeholder pending real agent execution.',
    ],
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'DISCOVERY_REPORT',
    name: `Discovery Report — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: task.id,
    createdBy: 'devos-deterministic-stub',
    createdAt: now,
    updatedAt: now,
  };

  const version: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifact.id,
    version: 1,
    contentType: CONTENT_TYPE,
    contentUri: stored.uri,
    contentHash: stored.hash,
    metadata: content,
    createdBy: 'devos-deterministic-stub',
    createdAt: now,
  };

  await deps.publishArtifact(artifact, version);

  return {
    status: 'SUCCEEDED',
    artifactId: artifact.id,
    artifactVersionId: version.id,
    artifactType: artifact.artifactType,
    contentHash: stored.hash,
  };
}
