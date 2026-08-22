import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { runAgentTask } from './run-agent-task.js';
import type { AgentArtifactTaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

// Matches publish-artifact.ts's SYSTEM_ACTOR_IDS and
// record-context-manifest.ts's SYSTEM_ACTOR_ID — the agent runtime acting
// without a human principal.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * The first concrete agent (DEVOS-031) — functionally replaces DEVOS-016's
 * deterministic runDiscoveryTask as the actual task handler, producing a
 * DISCOVERY_REPORT artifact through the same artifact/provenance mechanism
 * (DEVOS-017), but backed by a real, schema-validated LLM call through the
 * generic agent runtime (DEVOS-026) rather than a hardcoded string.
 *
 * Registering this in place of runDiscoveryTask in apps/worker's dispatch
 * table is deliberately deferred to DEVOS-035, alongside the other three
 * planning-path agents, per specs/sprints/sprint-02/README.md.
 */
export async function runDiscoveryAgentTask(
  deps: AgentArtifactTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const { agentExecutionId, agentVersionId, ...modelOutput } = await runAgentTask(deps, task);

  const now = new Date().toISOString();
  const content = {
    artifactType: 'DISCOVERY_REPORT',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    // modelOutput still carries runAgentTask's own "status" field
    // (always 'SUCCEEDED' here — an unsuccessful invocation throws instead
    // of returning) alongside the schema-validated summary/findings.
    ...modelOutput,
    agentExecutionId,
    agentVersionId,
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
    agentExecutionId,
    agentVersionId,
  };
}
