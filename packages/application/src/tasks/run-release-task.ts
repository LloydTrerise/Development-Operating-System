import { randomUUID } from 'node:crypto';
import type { ProjectId } from '@devos/contracts';
import type { Artifact, ArtifactVersion, ToolInvocation, WorkflowTask } from '@devos/domain';
import { NonRetryableTaskError } from '@devos/domain';
import {
  createLocalStagingDeploymentProvider,
  createRenderDeploymentProvider,
  type DeploymentProvider,
} from '@devos/integrations';
import { invokeTool } from '@devos/tools';
import { createDeploymentProviderAdapters } from './deployment-provider-adapters.js';
import { createHealthCheckProviderAdapter } from './health-check-provider-adapter.js';
import { createHttpHealthCheckProviderAdapter } from './http-health-check-provider-adapter.js';
import type { ToolTaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

// Matches run-validation-task.ts's identical constant — the agent runtime
// acting without a human principal.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

interface LocalReleaseTarget {
  kind: 'local';
  repositoryPath: string;
  environment: string;
  stagingRoot: string;
  healthCheckCommand: string;
}

/**
 * DEVOS-105: a real Render target, resolved from a separate `Deployment`
 * -type `Integration` (not the `Git` integration's own `configuration`,
 * unlike the local staging config below) — a project's real deployment
 * credentials/target are their own concern, distinct from its Git
 * credentials, and this keeps the local-only path (no `Deployment`
 * integration registered) byte-identical to every prior sprint's behaviour.
 */
interface RenderReleaseTarget {
  kind: 'render';
  environment: string;
  serviceId: string;
  credentialReference: string;
}

type ReleaseTarget = LocalReleaseTarget | RenderReleaseTarget;

/**
 * Reads `deploy`'s target configuration for the project — a real `Deployment`
 * integration (DEVOS-105) when one is registered, else the pre-existing
 * local staging configuration read from the project's active Git
 * integration (DEVOS-074, unchanged). Shared by both a fresh release and an
 * authorised rollback, since both deploy to the same environment through
 * the same mechanism.
 */
async function resolveReleaseTarget(
  deps: ToolTaskHandlerDeps,
  projectId: ProjectId,
): Promise<ReleaseTarget> {
  const integrations = await deps.integrations.listForProject(projectId);

  const deploymentIntegration = integrations.find(
    (integration) => integration.type === 'Deployment' && integration.status === 'ACTIVE',
  );
  if (deploymentIntegration) {
    const serviceId = deploymentIntegration.configuration.serviceId;
    if (typeof serviceId !== 'string' || serviceId.trim().length === 0) {
      throw new Error(
        `Deployment integration ${deploymentIntegration.id} has no configured "serviceId".`,
      );
    }
    const environment = deploymentIntegration.configuration.environment;
    if (typeof environment !== 'string' || environment.trim().length === 0) {
      throw new Error(
        `Deployment integration ${deploymentIntegration.id} has no configured "environment".`,
      );
    }
    return {
      kind: 'render',
      environment,
      serviceId,
      credentialReference: deploymentIntegration.credentialReference,
    };
  }

  const gitIntegration = integrations.find(
    (integration) => integration.type === 'Git' && integration.status === 'ACTIVE',
  );
  if (!gitIntegration) {
    throw new Error(`No active Git integration configured for project ${projectId}.`);
  }

  const repositoryPath = gitIntegration.configuration.repositoryPath;
  if (typeof repositoryPath !== 'string' || repositoryPath.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "repositoryPath".`);
  }
  const environment = gitIntegration.configuration.releaseEnvironment;
  if (typeof environment !== 'string' || environment.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "releaseEnvironment".`);
  }
  const stagingRoot = gitIntegration.configuration.stagingRoot;
  if (typeof stagingRoot !== 'string' || stagingRoot.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "stagingRoot".`);
  }
  const healthCheckCommand = gitIntegration.configuration.healthCheckCommand;
  if (typeof healthCheckCommand !== 'string' || healthCheckCommand.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "healthCheckCommand".`);
  }

  return { kind: 'local', repositoryPath, environment, stagingRoot, healthCheckCommand };
}

/**
 * Resolves the real Render API key through `CredentialResolver` (DEVOS-106)
 * — mirrors `run-development-agent-task.ts`'s identical
 * `resolvePullRequestProvider` credential-resolution pattern (DEVOS-104).
 */
async function resolveRenderApiKey(
  deps: ToolTaskHandlerDeps,
  target: RenderReleaseTarget,
): Promise<string> {
  if (!deps.credentialResolver) {
    throw new Error(
      'Project configures a real Render deployment target but no credentialResolver is available to resolve its API key.',
    );
  }
  const apiKey = await deps.credentialResolver.resolve(target.credentialReference);
  if (apiKey === null) {
    throw new Error(
      `Could not resolve a credential for reference "${target.credentialReference}".`,
    );
  }
  return apiKey;
}

/**
 * §24 Retry Rules distinguish "retry only transient failures automatically"
 * from "do not automatically retry permission denials." A `REJECTED` tool
 * invocation *is* a permission/policy/schema denial (§56's own Tool Gateway
 * chain — see `invoke-tool.ts`'s doc comment: "REJECTED covers everything
 * the Tool Gateway itself rejects"); a `FAILED` one is the provider
 * adapter's own outcome — a real infrastructure problem that may well be
 * transient. `NonRetryableTaskError` (DEVOS-077, `@devos/domain`) is how a
 * task handler tells the dispatcher which is which; retrying a rejected
 * invocation would just be rejected again for the identical reason.
 */
function requireSucceeded(invocation: ToolInvocation, label: string, taskId: string): void {
  if (invocation.status === 'SUCCEEDED') return;
  const message = `${label} invocation failed for task ${taskId}: ${invocation.errorCode ?? 'unknown error'}`;
  if (invocation.status === 'REJECTED') {
    throw new NonRetryableTaskError(message);
  }
  throw new Error(message);
}

interface PerformReleaseInput {
  action: 'deploy' | 'rollback';
  revision: string;
  derivedFromArtifactId?: string;
  derivedFromArtifactVersionId?: string;
}

/**
 * The actual release mechanics — deploy the given revision (DEVOS-074),
 * then post-release-validate it (DEVOS-075), then publish the combined
 * result as a `RELEASE_EVIDENCE` artifact (DEVOS-076) — factored out so a
 * fresh release (`runReleaseTask`) and an authorised rollback
 * (`runReleaseRollbackTask`, DEVOS-077) share one implementation rather
 * than duplicating the deploy/health-check/evidence pipeline. Only
 * `revision`/`action`/optional provenance differ between the two callers.
 */
async function performRelease(
  deps: ToolTaskHandlerDeps,
  task: WorkflowTask,
  input: PerformReleaseInput,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  // DEVOS-088: threaded from the API request that started this run, if any.
  const correlationId =
    typeof task.input.correlationId === 'string' ? task.input.correlationId : undefined;

  const releaseTarget = await resolveReleaseTarget(deps, run.projectId);
  const environment = releaseTarget.environment;

  // DEVOS-105: which real provider/health-check mechanism this release uses
  // depends entirely on which kind of target was resolved — a real Render
  // target has no local `repositoryPath`/`deployedPath` and is health-
  // checked over real HTTP instead of a local shell command.
  let deploymentProvider: DeploymentProvider;
  let deployTarget: Record<string, unknown>;
  if (releaseTarget.kind === 'render') {
    const apiKey = await resolveRenderApiKey(deps, releaseTarget);
    deploymentProvider = createRenderDeploymentProvider({
      apiKey,
      serviceId: releaseTarget.serviceId,
    });
    deployTarget = { environment };
  } else {
    deploymentProvider = createLocalStagingDeploymentProvider(releaseTarget.stagingRoot);
    deployTarget = { repositoryPath: releaseTarget.repositoryPath, environment };
  }
  const deployDeps = { ...deps, adapters: createDeploymentProviderAdapters(deploymentProvider) };

  const startedAt = new Date().toISOString();
  const deployInvocation = await invokeTool(deployDeps, SYSTEM_ACTOR_ID, run.projectId, task.id, {
    capabilityKey: 'deploy',
    target: deployTarget,
    parameters: { revision: input.revision },
    idempotencyKey: `${task.id}:${input.action}`,
    ...(correlationId !== undefined ? { correlationId } : {}),
  });
  requireSucceeded(deployInvocation, 'Deploy', task.id);

  const deployedPath = deployInvocation.outputMetadata?.deployedPath;
  const deployedUrl = deployInvocation.outputMetadata?.url;
  const healthCheckCommand =
    releaseTarget.kind === 'local' ? releaseTarget.healthCheckCommand : undefined;

  const healthCheckDeps =
    deployedUrl !== undefined
      ? { ...deps, adapters: createHttpHealthCheckProviderAdapter(String(deployedUrl)) }
      : { ...deps, adapters: createHealthCheckProviderAdapter(String(deployedPath)) };
  // DEVOS-105: `health-check`'s seeded inputSchema requires a non-empty
  // `command` string regardless of which adapter is behind it — for the
  // real HTTP adapter (which needs no shell command, the URL is already
  // closed over at construction) this is the checked URL itself, recorded
  // as a real, meaningful part of the tool invocation's own audit trail
  // rather than an arbitrary placeholder.
  const healthCheckCommandParameter = healthCheckCommand ?? String(deployedUrl);

  const healthCheckInvocation = await invokeTool(
    healthCheckDeps,
    SYSTEM_ACTOR_ID,
    run.projectId,
    task.id,
    {
      capabilityKey: 'health-check',
      target: {},
      parameters: { command: healthCheckCommandParameter },
      idempotencyKey: `${task.id}:${input.action}-health-check`,
      ...(correlationId !== undefined ? { correlationId } : {}),
    },
  );
  requireSucceeded(healthCheckInvocation, 'Health-check', task.id);

  const healthCheckExitCode = healthCheckInvocation.outputMetadata?.exitCode;
  const passed = healthCheckExitCode === 0;
  const completedAt = new Date().toISOString();

  const content = {
    artifactType: 'RELEASE_EVIDENCE',
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    ...(input.derivedFromArtifactId !== undefined
      ? { derivedFromArtifactId: input.derivedFromArtifactId }
      : {}),
    ...(input.derivedFromArtifactVersionId !== undefined
      ? { derivedFromArtifactVersionId: input.derivedFromArtifactVersionId }
      : {}),
    action: input.action,
    target: deployTarget,
    revision: input.revision,
    passed,
    deployment: {
      deploymentId: deployInvocation.outputMetadata?.deploymentId,
      ...(deployedPath !== undefined ? { deployedPath } : {}),
      ...(deployedUrl !== undefined ? { url: deployedUrl } : {}),
      toolInvocationId: deployInvocation.id,
    },
    healthCheck: {
      command: healthCheckCommandParameter,
      exitCode: healthCheckExitCode,
      stdout: healthCheckInvocation.outputMetadata?.stdout,
      stderr: healthCheckInvocation.outputMetadata?.stderr,
      toolInvocationId: healthCheckInvocation.id,
    },
    startedAt,
    completedAt,
    generatedAt: completedAt,
  };

  const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: run.projectId,
    artifactType: 'RELEASE_EVIDENCE',
    name: `Release Evidence — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: task.id,
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: completedAt,
    updatedAt: completedAt,
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
    createdAt: completedAt,
  };

  await deps.publishArtifact(artifact, version);

  return {
    status: 'SUCCEEDED',
    artifactId: artifact.id,
    artifactVersionId: version.id,
    artifactType: artifact.artifactType,
    contentHash: stored.hash,
    passed,
    action: input.action,
    revision: input.revision,
    ...(deployedPath !== undefined ? { deployedPath } : {}),
    ...(deployedUrl !== undefined ? { url: deployedUrl } : {}),
  };
}

/**
 * Stage 11 — Release (specs/workflows/software-change-workflow.md §22):
 * "The workflow records: action; target; revision; provider result;
 * timing; outcome; relevant logs/evidence." Combines the actual deploy
 * (DEVOS-074's `deploy` capability) and post-release validation
 * (DEVOS-075's `health-check` capability) in one task and publishes their
 * combined result as a `RELEASE_EVIDENCE` artifact — mirroring DEVOS-064's
 * `runValidationTask` precedent exactly (build-run + test-run, one task,
 * one `TEST_EVIDENCE` artifact), the design question DEVOS-076's own task
 * file left open ("folded into the same task, or a dedicated one").
 *
 * **Not yet wired into `apps/worker`'s dispatcher or a seeded workflow
 * node** — deferred to DEVOS-079 ("Full Software Change Workflow"),
 * mirroring DEVOS-064's own precedent (validation wasn't wired in until
 * DEVOS-067). This task deliberately makes no assumption about which run
 * or node it executes inside; it is invoked directly in its own tests, the
 * same way DEVOS-064 was before its own later wiring.
 *
 * Consumes the project's **latest `CODE_CHANGE` artifact** (project-scoped,
 * mirroring every prior stage's lookup) and deploys its recorded
 * `commitSha` — a precise, immutable revision, not the movable branch tip
 * `test-run`/`build-run` checked out.
 *
 * A failing health check (non-zero exit) does not fail this task — like
 * `runValidationTask`'s build/test result, it is exactly the pass/fail
 * *data* the `RELEASE_EVIDENCE` artifact's own `passed` field exists to
 * capture (DEVOS-077's failure handling is what actually acts on it). This
 * task only throws on a genuine infrastructure problem: no `CODE_CHANGE`,
 * no active Git integration, missing release configuration, or the Tool
 * Gateway itself rejecting either invocation (policy/schema failure,
 * `NonRetryableTaskError` — DEVOS-077) — unlike a failing health check, a
 * rejected/failed *invocation* means the release action itself could not
 * be trusted to have happened at all.
 */
export async function runReleaseTask(
  deps: ToolTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const codeChangeArtifact = projectArtifacts
    .filter((artifact) => artifact.artifactType === 'CODE_CHANGE')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!codeChangeArtifact) {
    throw new Error(
      `No CODE_CHANGE artifact found in project ${run.projectId}; release requires a development output.`,
    );
  }

  const codeChangeVersions = await deps.artifactVersions.listForArtifact(codeChangeArtifact.id);
  const latestCodeChangeVersion = codeChangeVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestCodeChangeVersion) {
    throw new Error(`Code change artifact ${codeChangeArtifact.id} has no versions.`);
  }

  const revision = latestCodeChangeVersion.metadata?.commitSha;
  if (typeof revision !== 'string' || revision.trim().length === 0) {
    throw new Error(
      `Code change artifact version ${latestCodeChangeVersion.id} has no recorded commitSha.`,
    );
  }

  return performRelease(deps, task, {
    action: 'deploy',
    revision,
    derivedFromArtifactId: codeChangeArtifact.id,
    derivedFromArtifactVersionId: latestCodeChangeVersion.id,
  });
}

/**
 * DEVOS-077: "an authorised rollback path exists and itself produces
 * evidence/audit records exactly like the original deployment did" — §22's
 * Risk Model (R3/R4) treats rollback with the same authorisation
 * discipline as the original release, so this is never triggered
 * automatically by a failure; it requires an explicit `rollbackToRevision`
 * in the task's own input, supplied by whatever authorised human/process
 * decided to roll back (this task makes no assumption about which — that
 * belongs to whatever calls it). Reuses `performRelease` exactly like
 * `runReleaseTask`, so a rollback goes through the identical Tool Gateway
 * chain (the same policy/approval discipline) and produces its own
 * `RELEASE_EVIDENCE` artifact (`action: 'rollback'`), never a special case.
 */
export async function runReleaseRollbackTask(
  deps: ToolTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const rollbackToRevision = task.input.rollbackToRevision;
  if (typeof rollbackToRevision !== 'string' || rollbackToRevision.trim().length === 0) {
    throw new Error(
      'rollbackToRevision is required in task.input for an authorised rollback; rollback is never automatic.',
    );
  }

  return performRelease(deps, task, { action: 'rollback', revision: rollbackToRevision });
}
