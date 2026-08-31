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
 * The third planning-path agent (DEVOS-033) — reads the PRD artifact
 * produced earlier in the same run (DEVOS-032) and produces a
 * schema-validated technical design artifact. Structurally identical to
 * DEVOS-032's requirements agent (resolve the upstream artifact itself,
 * pass it via runAgentTask's `additionalContext`, publish a derived
 * artifact), just one stage further down the planning-path chain.
 *
 * Not yet registered in apps/worker's dispatch table — deferred to
 * DEVOS-035 alongside the other three planning-path agents.
 */
export async function runTechnicalDesignAgentTask(
  deps: AgentArtifactConsumerTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const prdArtifact = projectArtifacts.find(
    (artifact) => artifact.workflowRunId === run.id && artifact.artifactType === 'PRD',
  );
  if (!prdArtifact) {
    throw new Error(
      `No PRD artifact found for run ${run.id}; the technical design agent requires one.`,
    );
  }

  const prdVersions = await deps.artifactVersions.listForArtifact(prdArtifact.id);
  const latestPrdVersion = prdVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestPrdVersion) {
    throw new Error(`PRD artifact ${prdArtifact.id} has no versions.`);
  }

  // DEVOS-109: no `sources` entry needed here anymore — runAgentTask's own
  // buildContext() call already records this artifact (and every other one
  // this run has produced so far) in the manifest automatically.
  const { agentExecutionId, agentVersionId, ...modelOutput } = await runAgentTask(deps, task, {
    input: { prd: latestPrdVersion.metadata ?? {} },
  });

  const now = new Date().toISOString();
  const content = {
    artifactType: 'TECHNICAL_DESIGN',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    derivedFromArtifactId: prdArtifact.id,
    derivedFromArtifactVersionId: latestPrdVersion.id,
    ...modelOutput,
    agentExecutionId,
    agentVersionId,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'TECHNICAL_DESIGN',
    name: `Technical Design — ${workItem.title}`,
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
    derivedFromArtifactId: prdArtifact.id,
  };
}
