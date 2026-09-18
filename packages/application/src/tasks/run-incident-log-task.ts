import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import type { TaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-125: the "Incident Response" workflow's low-severity `log-only`
 * branch (`severity-check`'s untaken-on-high-severity edge). Publishes a
 * real `INCIDENT_LOG_ENTRY` artifact recording the run's own reported
 * severity — deliberately minimal (no diagnosis, no notification, no
 * remediation gate) since a low-severity incident's own graph shape is not
 * this task's concern; it exists so `severity-check`'s `low` branch is a
 * real, runnable task rather than a dead end, and so a real run with
 * `severity: 'low'` proves both `CONDITION` branches and DEVOS-123's
 * `SKIPPED` cascade across the untaken high-severity subtree (DEVOS-126).
 */
export async function runIncidentLogTask(
  deps: TaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const severity = run.input.severity;
  const now = new Date().toISOString();
  const content = {
    artifactType: 'INCIDENT_LOG_ENTRY',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    severity,
    summary: `Low-severity incident "${workItem.title}" logged without diagnosis/notification/remediation.`,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'INCIDENT_LOG_ENTRY',
    name: `Incident Log Entry — ${workItem.title}`,
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
