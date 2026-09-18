import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { createWorkspace, destroyWorkspace, runGit } from '@devos/integrations';
import { invokeTool } from '@devos/tools';
import { createCommandProviderAdapters } from './command-provider-adapters.js';
import type { ToolTaskHandlerDeps } from './deps.js';
import { resolveAuthenticatedCloneUrl } from './github-context.js';

const CONTENT_TYPE = 'application/json';

// Matches run-validation-task.ts's identical constant — the agent runtime
// acting without a human principal.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * DEVOS-113: the new `security-scan` node in the `release-path` workflow's
 * v3 graph (`SEED_RELEASE_PATH_WORKFLOW_V3_GRAPH`,
 * `packages/database/src/seed-constants.ts`), which runs ahead of
 * `runReleaseReadinessCheckTask` via the real `dependsOn` barrier
 * (`packages/database/src/repositories/task-queue.ts`). Mirrors
 * `runValidationTask`'s exact shape: consumes the project's latest
 * `CODE_CHANGE` artifact, checks out its `branchName`, runs a real
 * project-configured command through the Tool Gateway, and publishes the
 * real (not fabricated) result as evidence.
 *
 * The scan command comes from the project's Git integration configuration
 * (`securityScanCommand`, parallel to `buildCommand`/`testCommand`), never
 * fabricated — same reasoning as `runValidationTask`'s `buildCommand`/
 * `testCommand` doc comment. Missing configuration fails the task clearly.
 *
 * Publishes a `SECURITY_SCAN_EVIDENCE` artifact recording the command,
 * exit code, stdout/stderr, and a `passed` verdict (`exitCode === 0`) — the
 * exact same shape `evaluateReleaseReadiness` (DEVOS-069, extended by this
 * task) already expects of `TEST_EVIDENCE`. A non-zero exit code does not
 * fail this task itself, for the same reason a failing test doesn't fail
 * `runValidationTask`: it's real pass/fail *data* for the readiness
 * evaluator to judge, not an infrastructure failure of this task.
 */
export async function runSecurityScanTask(
  deps: ToolTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  // DEVOS-088: threaded from the API request that started this run, if any.
  const correlationId =
    typeof task.input.correlationId === 'string' ? task.input.correlationId : undefined;

  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const codeChangeArtifact = projectArtifacts
    .filter((artifact) => artifact.artifactType === 'CODE_CHANGE')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!codeChangeArtifact) {
    throw new Error(
      `No CODE_CHANGE artifact found in project ${run.projectId}; security scan requires a development output.`,
    );
  }

  const codeChangeVersions = await deps.artifactVersions.listForArtifact(codeChangeArtifact.id);
  const latestCodeChangeVersion = codeChangeVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestCodeChangeVersion) {
    throw new Error(`Code change artifact ${codeChangeArtifact.id} has no versions.`);
  }

  const branchName = latestCodeChangeVersion.metadata?.branchName;
  if (typeof branchName !== 'string' || branchName.trim().length === 0) {
    throw new Error(
      `Code change artifact version ${latestCodeChangeVersion.id} has no recorded branchName.`,
    );
  }

  const integrations = await deps.integrations.listForProject(run.projectId);
  const gitIntegration = integrations.find(
    (integration) => integration.type === 'Git' && integration.status === 'ACTIVE',
  );
  if (!gitIntegration) {
    throw new Error(`No active Git integration configured for project ${run.projectId}.`);
  }

  const repositoryPath = gitIntegration.configuration.repositoryPath;
  if (typeof repositoryPath !== 'string' || repositoryPath.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "repositoryPath".`);
  }

  const securityScanCommand = gitIntegration.configuration.securityScanCommand;
  if (typeof securityScanCommand !== 'string' || securityScanCommand.trim().length === 0) {
    throw new Error(
      `Git integration ${gitIntegration.id} has no configured "securityScanCommand".`,
    );
  }

  const cloneUrl = await resolveAuthenticatedCloneUrl(
    deps.credentialResolver,
    gitIntegration,
    repositoryPath,
  );
  const workspace = await createWorkspace(task.id, cloneUrl);

  try {
    await runGit(['checkout', branchName], workspace.path);
    const { stdout: revisionOut } = await runGit(['rev-parse', 'HEAD'], workspace.path);
    const revision = revisionOut.trim();

    const gatewayDeps = { ...deps, adapters: createCommandProviderAdapters(workspace) };

    const scanInvocation = await invokeTool(gatewayDeps, SYSTEM_ACTOR_ID, run.projectId, task.id, {
      capabilityKey: 'security-scan',
      target: { repositoryPath: workspace.path },
      parameters: { command: securityScanCommand },
      idempotencyKey: `${task.id}:security-scan`,
      ...(correlationId !== undefined ? { correlationId } : {}),
    });
    if (scanInvocation.status !== 'SUCCEEDED') {
      throw new Error(
        `Security scan invocation failed for task ${task.id}: ${scanInvocation.errorCode ?? 'unknown error'}`,
      );
    }

    const scanExitCode = scanInvocation.outputMetadata?.exitCode;
    const passed = scanExitCode === 0;

    const now = new Date().toISOString();
    const content = {
      artifactType: 'SECURITY_SCAN_EVIDENCE',
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      derivedFromArtifactId: codeChangeArtifact.id,
      derivedFromArtifactVersionId: latestCodeChangeVersion.id,
      revision,
      passed,
      scan: {
        command: securityScanCommand,
        exitCode: scanExitCode,
        stdout: scanInvocation.outputMetadata?.stdout,
        stderr: scanInvocation.outputMetadata?.stderr,
        toolInvocationId: scanInvocation.id,
      },
      generatedAt: now,
    };

    const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

    const artifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId: run.projectId,
      artifactType: 'SECURITY_SCAN_EVIDENCE',
      name: `Security Scan Evidence — ${workItem.title}`,
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
      passed,
      scanExitCode,
    };
  } finally {
    await destroyWorkspace(workspace);
  }
}
