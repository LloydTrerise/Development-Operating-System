import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { runAgentTask } from './run-agent-task.js';
import type { AgentArtifactConsumerTaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

// Matches publish-artifact.ts's SYSTEM_ACTOR_IDS and
// record-context-manifest.ts's SYSTEM_ACTOR_ID — the agent runtime acting
// without a human principal.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * The fourth and final planning-path agent (DEVOS-034) — reads the
 * TECHNICAL_DESIGN artifact produced earlier in the same run (DEVOS-033)
 * and produces a schema-validated implementation plan artifact.
 * Structurally identical to DEVOS-032/033's consuming agents (resolve the
 * upstream artifact itself, pass it via runAgentTask's `additionalContext`,
 * publish a derived artifact) — the fourth and last stage of the
 * discovery → requirements → technical design → planning chain.
 *
 * Not yet registered in apps/worker's dispatch table — deferred to
 * DEVOS-035 alongside the other three planning-path agents.
 */
export async function runPlanningAgentTask(
  deps: AgentArtifactConsumerTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const designArtifact = projectArtifacts.find(
    (artifact) => artifact.workflowRunId === run.id && artifact.artifactType === 'TECHNICAL_DESIGN',
  );
  if (!designArtifact) {
    throw new Error(
      `No TECHNICAL_DESIGN artifact found for run ${run.id}; the planning agent requires one.`,
    );
  }

  const designVersions = await deps.artifactVersions.listForArtifact(designArtifact.id);
  const latestDesignVersion = designVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestDesignVersion) {
    throw new Error(`Technical design artifact ${designArtifact.id} has no versions.`);
  }

  const { agentExecutionId, agentVersionId, ...modelOutput } = await runAgentTask(deps, task, {
    input: { technicalDesign: latestDesignVersion.metadata ?? {} },
    sources: [
      { type: 'ARTIFACT', ref: `artifact:${designArtifact.id}:v${latestDesignVersion.version}` },
    ],
  });

  const now = new Date().toISOString();
  const content = {
    artifactType: 'IMPLEMENTATION_PLAN',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    derivedFromArtifactId: designArtifact.id,
    derivedFromArtifactVersionId: latestDesignVersion.id,
    ...modelOutput,
    agentExecutionId,
    agentVersionId,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'IMPLEMENTATION_PLAN',
    name: `Implementation Plan — ${workItem.title}`,
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
    derivedFromArtifactId: designArtifact.id,
  };
}
