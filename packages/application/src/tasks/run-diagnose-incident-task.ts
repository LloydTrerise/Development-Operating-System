import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import type { TaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-125: the `diagnose` branch of the "Incident Response" workflow's
 * `diagnose-and-notify` `PARALLEL` node. Deliberately mirrors
 * `run-discovery-task.ts`'s own shape (deterministic, no Git checkout, no
 * Tool Gateway) rather than `run-security-scan-task.ts`'s — an Incident
 * Response project needing a real Git integration just to diagnose would be
 * an unnecessary dependency this sprint's own objective (proving the engine
 * primitives generalize) doesn't call for. Publishes a real
 * `INCIDENT_DIAGNOSIS_EVIDENCE` artifact recording the run's own reported
 * severity — a real, verifiable local action, not a fabricated external
 * diagnostic tool (`specs/sprints/sprint-12/README.md`'s own flagged
 * scoping decision).
 */
export async function runDiagnoseIncidentTask(
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
    artifactType: 'INCIDENT_DIAGNOSIS_EVIDENCE',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    severity,
    summary: `Deterministic diagnosis pass for incident "${workItem.title}" (severity: ${String(severity)}).`,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'INCIDENT_DIAGNOSIS_EVIDENCE',
    name: `Incident Diagnosis Evidence — ${workItem.title}`,
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
