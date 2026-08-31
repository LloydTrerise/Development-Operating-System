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
 * The second planning-path agent (DEVOS-032) — reads the DISCOVERY_REPORT
 * artifact produced earlier in the same run (DEVOS-031) and produces a
 * schema-validated PRD artifact. Unlike the discovery agent, this one has
 * an upstream dependency: it resolves that artifact itself (there can be
 * only one per run in the current sequential planning-path workflow) and
 * passes it to runAgentTask via `additionalContext`, which folds it into
 * both the model's input and the recorded context manifest — the link
 * DEVOS-032's acceptance criterion calls "correctly linked (via provenance
 * and context manifest) to the discovery report it was derived from".
 *
 * Not yet registered in apps/worker's dispatch table — deferred to
 * DEVOS-035 alongside the other three planning-path agents.
 */
export async function runRequirementsAgentTask(
  deps: AgentArtifactConsumerTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const discoveryArtifact = projectArtifacts.find(
    (artifact) => artifact.workflowRunId === run.id && artifact.artifactType === 'DISCOVERY_REPORT',
  );
  if (!discoveryArtifact) {
    throw new Error(
      `No DISCOVERY_REPORT artifact found for run ${run.id}; the requirements agent requires one.`,
    );
  }

  const discoveryVersions = await deps.artifactVersions.listForArtifact(discoveryArtifact.id);
  const latestDiscoveryVersion = discoveryVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestDiscoveryVersion) {
    throw new Error(`Discovery artifact ${discoveryArtifact.id} has no versions.`);
  }

  // DEVOS-109: no `sources` entry needed here anymore — runAgentTask's own
  // buildContext() call already records this artifact (and every other one
  // this run has produced so far) in the manifest automatically.
  const { agentExecutionId, agentVersionId, ...modelOutput } = await runAgentTask(deps, task, {
    input: { discoveryReport: latestDiscoveryVersion.metadata ?? {} },
  });

  const now = new Date().toISOString();
  const content = {
    artifactType: 'PRD',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    derivedFromArtifactId: discoveryArtifact.id,
    derivedFromArtifactVersionId: latestDiscoveryVersion.id,
    ...modelOutput,
    agentExecutionId,
    agentVersionId,
    generatedAt: now,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'PRD',
    name: `PRD — ${workItem.title}`,
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
    derivedFromArtifactId: discoveryArtifact.id,
  };
}
