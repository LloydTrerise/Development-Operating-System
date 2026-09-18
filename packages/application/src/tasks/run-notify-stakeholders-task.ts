import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { NonRetryableTaskError } from '@devos/domain';
import type { TaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-125: the `notify` branch of the "Incident Response" workflow's
 * `diagnose-and-notify` `PARALLEL` node. Publishes a real `STATUS_UPDATE`
 * artifact — an explicitly disclosed local stand-in for a real external
 * paging/status-page provider, which does not exist in this codebase and is
 * not introduced by this task (`specs/sprints/sprint-12/README.md`'s own
 * flagged scoping decision, matching Sprint 6's `createLocalStagingDeploymentProvider`
 * precedent).
 *
 * `run.input.simulateNotifyFailure === true` is a deliberate, disclosed test
 * hook (the same "explicit input-driven test control" convention as
 * `SEED_RELEASE_ROLLBACK_WORKFLOW_GRAPH`'s `rollbackToRevision` or
 * DEVOS-071's `DEVELOPMENT_FIXTURE_SEQUENCE`) — it exists only to let
 * DEVOS-126's real e2e suite prove `diagnosis-join`'s tolerant
 * branch-failure policy for real, without fabricating a flaky/incidental
 * failure. It is never set by any real run.
 */
export async function runNotifyStakeholdersTask(
  deps: TaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  if (run.input.simulateNotifyFailure === true) {
    throw new NonRetryableTaskError(
      `Notification deliberately failed for run ${run.id} (run.input.simulateNotifyFailure).`,
    );
  }

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const severity = run.input.severity;
  const now = new Date().toISOString();
  const content = {
    artifactType: 'STATUS_UPDATE',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    severity,
    summary: `Stakeholders notified of incident "${workItem.title}" (severity: ${String(severity)}).`,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'STATUS_UPDATE',
    name: `Status Update — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: task.id,
    createdBy: SYSTEM_ACTOR_ID,
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
    createdBy: SYSTEM_ACTOR_ID,
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
