import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import { createWorkspace, destroyWorkspace, runGit } from '@devos/integrations';
import { invokeTool } from '@devos/tools';
import { createCommandProviderAdapters } from './command-provider-adapters.js';
import type { ToolTaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

// Matches run-development-agent-task.ts's identical constant — the agent
// runtime acting without a human principal. No agent is actually invoked
// here (see deps.ts's doc comment on ToolTaskHandlerDeps), but the Tool
// Gateway still needs a principal with a real project membership.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * Stage 8 — Automated Validation (specs/workflows/software-change-workflow.md
 * §18): "Determine whether the implementation satisfies the approved
 * requirements and engineering quality expectations." No agent is named for
 * this stage — build/type-check/lint/test are purely mechanical, so this
 * task calls the Tool Gateway directly (DEVOS-062/063's `build-run`/
 * `test-run` capabilities), the same way `runDevelopmentAgentTask` applies
 * its proposed change, but with no model call anywhere in this function.
 *
 * Consumes the project's latest `CODE_CHANGE` artifact (project-scoped,
 * mirroring DEVOS-061's plan lookup — not run-scoped, since this task will
 * run inside the same run as development once DEVOS-066 wires the full
 * three-node workflow, but must not hard-assume that positioning). Builds a
 * fresh workspace checked out to that artifact's `branchName` — the
 * ephemeral workspace development used no longer exists by the time this
 * task runs.
 *
 * The build/test commands themselves come from the project's Git
 * integration configuration (`buildCommand`/`testCommand`), never
 * fabricated — see DEVOS-062's `runCommand` doc comment for why this must
 * only ever be an admin-configured value, never agent output. Missing
 * configuration fails the task clearly rather than guessing a command.
 *
 * Publishes a `TEST_EVIDENCE` artifact recording exactly what §18 requires:
 * commands executed, results (exit codes), stdout/stderr, environment
 * revision, timestamp, and traceability (`derivedFromArtifactId`) to the
 * `CODE_CHANGE` it validates. A non-zero exit code does not fail this task
 * — that's exactly the "pass"/"fail" data the evidence exists to capture;
 * DEVOS-069's release-readiness evaluator is what actually judges it. This
 * task only fails on an infrastructure problem (no `CODE_CHANGE`, no Git
 * integration, no configured command, or the Tool Gateway itself rejecting
 * the invocation).
 */
export async function runValidationTask(
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
      `No CODE_CHANGE artifact found in project ${run.projectId}; validation requires a development output.`,
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

  const buildCommand = gitIntegration.configuration.buildCommand;
  const testCommand = gitIntegration.configuration.testCommand;
  if (typeof buildCommand !== 'string' || buildCommand.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "buildCommand".`);
  }
  if (typeof testCommand !== 'string' || testCommand.trim().length === 0) {
    throw new Error(`Git integration ${gitIntegration.id} has no configured "testCommand".`);
  }

  const workspace = await createWorkspace(task.id, repositoryPath);

  try {
    await runGit(['checkout', branchName], workspace.path);
    const { stdout: revisionOut } = await runGit(['rev-parse', 'HEAD'], workspace.path);
    const revision = revisionOut.trim();

    const gatewayDeps = { ...deps, adapters: createCommandProviderAdapters(workspace) };

    const buildInvocation = await invokeTool(gatewayDeps, SYSTEM_ACTOR_ID, run.projectId, task.id, {
      capabilityKey: 'build-run',
      target: { repositoryPath: workspace.path },
      parameters: { command: buildCommand },
      idempotencyKey: `${task.id}:build-run`,
      ...(correlationId !== undefined ? { correlationId } : {}),
    });
    if (buildInvocation.status !== 'SUCCEEDED') {
      throw new Error(
        `Build invocation failed for task ${task.id}: ${buildInvocation.errorCode ?? 'unknown error'}`,
      );
    }

    const testInvocation = await invokeTool(gatewayDeps, SYSTEM_ACTOR_ID, run.projectId, task.id, {
      capabilityKey: 'test-run',
      target: { repositoryPath: workspace.path },
      parameters: { command: testCommand },
      idempotencyKey: `${task.id}:test-run`,
      ...(correlationId !== undefined ? { correlationId } : {}),
    });
    if (testInvocation.status !== 'SUCCEEDED') {
      throw new Error(
        `Test invocation failed for task ${task.id}: ${testInvocation.errorCode ?? 'unknown error'}`,
      );
    }

    const buildExitCode = buildInvocation.outputMetadata?.exitCode;
    const testExitCode = testInvocation.outputMetadata?.exitCode;
    const passed = buildExitCode === 0 && testExitCode === 0;

    const now = new Date().toISOString();
    const content = {
      artifactType: 'TEST_EVIDENCE',
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      derivedFromArtifactId: codeChangeArtifact.id,
      derivedFromArtifactVersionId: latestCodeChangeVersion.id,
      revision,
      passed,
      build: {
        command: buildCommand,
        exitCode: buildExitCode,
        stdout: buildInvocation.outputMetadata?.stdout,
        stderr: buildInvocation.outputMetadata?.stderr,
        toolInvocationId: buildInvocation.id,
      },
      test: {
        command: testCommand,
        exitCode: testExitCode,
        stdout: testInvocation.outputMetadata?.stdout,
        stderr: testInvocation.outputMetadata?.stderr,
        toolInvocationId: testInvocation.id,
      },
      generatedAt: now,
    };

    const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

    const artifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId: run.projectId,
      artifactType: 'TEST_EVIDENCE',
      name: `Test Evidence — ${workItem.title}`,
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
      buildExitCode,
      testExitCode,
    };
  } finally {
    await destroyWorkspace(workspace);
  }
}
