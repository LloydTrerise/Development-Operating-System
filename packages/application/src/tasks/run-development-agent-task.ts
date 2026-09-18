import { randomUUID } from 'node:crypto';
import type { AgentVersionId } from '@devos/contracts';
import type { Artifact, ArtifactVersion, WorkflowTask } from '@devos/domain';
import {
  createGitHubPullRequestProvider,
  createWorkspace,
  destroyWorkspace,
  runGit,
  type PullRequestProvider,
} from '@devos/integrations';
import { listRepositoryFiles } from '@devos/knowledge';
import { invokeTool } from '@devos/tools';
import { createGitProviderAdapters } from './git-provider-adapters.js';
import { buildAuthenticatedCloneUrl, resolveGitHubRepositoryTarget } from './github-context.js';
import { createPullRequestProviderAdapter } from './pull-request-provider-adapter.js';
import { runAgentTask } from './run-agent-task.js';
import type { DevelopmentAgentTaskHandlerDeps } from './deps.js';

const CONTENT_TYPE = 'application/json';

// Matches publish-artifact.ts's SYSTEM_ACTOR_IDS and
// record-context-manifest.ts's SYSTEM_ACTOR_ID — the agent runtime acting
// without a human principal. Unlike those two call sites, invokeTool's
// "Project Scope" step actually authorizes against this principal, so a
// real membership row for it must exist (seeded — see
// SEED_AGENT_RUNTIME_MEMBERSHIP_ID).
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

interface GitHubContext {
  cloneUrl: string;
  pullRequestProvider: PullRequestProvider;
}

/**
 * Resolves the real GitHub context (an authenticated clone URL and a real
 * `PullRequestProvider`) when the project's Git integration configures a
 * real GitHub target, resolving its live PAT through `deps.credentialResolver`
 * (DEVOS-106) once and reusing it for both. Returns `undefined` — not an
 * error — for any project without a real GitHub target configured (every
 * existing test, and any project that hasn't set one up), so the caller
 * falls back to `deps.pullRequestProvider`/the plain `repositoryPath`
 * unchanged. Resolved fresh per task, not once at worker startup, mirroring
 * `run-release-task.ts`'s identical per-call
 * `createLocalStagingDeploymentProvider(stagingRoot)` pattern — a worker
 * process serves many projects, each potentially targeting a different
 * repository. `resolveGitHubRepositoryTarget`/`buildAuthenticatedCloneUrl`
 * live in `github-context.ts`, shared with `run-validation-task.ts`
 * (DEVOS-108).
 */
async function resolveGitHubContext(
  deps: DevelopmentAgentTaskHandlerDeps,
  gitIntegration: { credentialReference: string; configuration: Record<string, unknown> },
  repositoryPath: string,
): Promise<GitHubContext | undefined> {
  const target = resolveGitHubRepositoryTarget(gitIntegration.configuration);
  if (!target) return undefined;

  if (!deps.credentialResolver) {
    throw new Error(
      'Git integration configures a real GitHub target (configuration.github) but no credentialResolver is available to resolve its token.',
    );
  }
  const token = await deps.credentialResolver.resolve(gitIntegration.credentialReference);
  if (token === null) {
    throw new Error(
      `Could not resolve a credential for reference "${gitIntegration.credentialReference}".`,
    );
  }

  return {
    cloneUrl: buildAuthenticatedCloneUrl(repositoryPath, token),
    pullRequestProvider: createGitHubPullRequestProvider({
      token,
      owner: target.owner,
      repo: target.repo,
    }),
  };
}

/**
 * Stage 7 — Development (specs/workflows/software-change-workflow.md §17):
 * "Implement the approved plan through controlled repository actions."
 * Consistent with Constitution Principle 6/7, the agent itself never
 * writes to the repository or invokes git — `runAgentTask` only ever
 * produces a structured, schema-validated proposed change (file paths +
 * content); everything from here down is deterministic platform code
 * applying that change through the Tool Gateway (DEVOS-052), using
 * DEVOS-054's Git adapter (wired in via `createGitProviderAdapters`,
 * closing the gap DEVOS-054 deferred to this task) and a workspace scoped
 * to this task (DEVOS-055), reliably destroyed afterward regardless of
 * outcome.
 *
 * No dedicated `development_agent` domain entity/table exists — this is a
 * normal `AgentDefinition`/`AgentVersion` with `role: 'DEVELOPMENT'`,
 * matching every other planning-path agent's pattern (DEVOS-031–034).
 *
 * DEVOS-061 registers this in apps/worker's dispatch table and wires it
 * into a seeded "development-path" workflow (a separate one-node workflow,
 * not a 5th node appended to "planning-path" — the existing task queue
 * only advances a run's approval gate once *every* task in it has
 * succeeded, so a development node co-located with the planning nodes
 * would block the planning-approval gate itself on development also
 * succeeding, inverting the intended "approve, then develop" order;
 * flagged as an implementation-level consequence of the current engine,
 * not a spec requirement). DEVOS-061 also closes two things this task
 * originally deferred: PR creation (folded in below, after the commit —
 * Stage 7's own "Expected activities" list includes "create a pull
 * request where authorised" as part of this same stage) and the plan
 * lookup, now project-scoped rather than run-scoped, since development
 * now runs as its own separate run consuming an earlier run's approved
 * plan.
 */
export async function runDevelopmentAgentTask(
  deps: DevelopmentAgentTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const workItem = await deps.workItems.getById(run.workItemId);
  if (!workItem) throw new Error(`Work item ${run.workItemId} not found.`);

  // DEVOS-088: threaded from the API request that started this run, if any
  // (run-creation.ts folds it into every task's `input`).
  const correlationId =
    typeof task.input.correlationId === 'string' ? task.input.correlationId : undefined;

  // Project-scoped, not run-scoped: development now runs as its own
  // separate run (see this function's doc comment), consuming the latest
  // approved plan produced by an earlier planning run in the same
  // project, not one produced within this same run.
  const projectArtifacts = await deps.artifacts.listForProject(run.projectId);
  const planArtifact = projectArtifacts
    .filter((artifact) => artifact.artifactType === 'IMPLEMENTATION_PLAN')
    // Not `b.createdAt.localeCompare(a.createdAt)`: despite ArtifactVersion's
    // `createdAt: string` domain type, pg's default type parser returns
    // `timestamptz` columns as `Date` instances at runtime (no
    // `.localeCompare` on those) — a pre-existing mismatch between the
    // domain contract and the database layer's actual runtime values,
    // flagged in DEVOS-SPRINT4-DECISIONS.md as out-of-scope-for-this-task
    // verification debt. `new Date(...)` accepts both a `Date` and a
    // string, so this comparison is correct either way.
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (!planArtifact) {
    throw new Error(
      `No IMPLEMENTATION_PLAN artifact found in project ${run.projectId}; the development agent requires an approved plan.`,
    );
  }

  const planVersions = await deps.artifactVersions.listForArtifact(planArtifact.id);
  const latestPlanVersion = planVersions.sort((a, b) => b.version - a.version)[0];
  if (!latestPlanVersion) {
    throw new Error(`Implementation plan artifact ${planArtifact.id} has no versions.`);
  }

  // DEVOS-067: if the most recent review of this project's work required
  // changes, this development attempt is a rework cycle — fold the
  // findings into the model's input (see developer/v1's prompt) so the
  // agent actually addresses what the review flagged, rather than
  // repeating the same rejected proposal. Not found on a first attempt
  // (no REVIEW_EVIDENCE exists yet), which is the common case and not an
  // error.
  const reviewArtifact = projectArtifacts
    .filter((artifact) => artifact.artifactType === 'REVIEW_EVIDENCE')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const reviewVersion = reviewArtifact
    ? (await deps.artifactVersions.listForArtifact(reviewArtifact.id)).sort(
        (a, b) => b.version - a.version,
      )[0]
    : undefined;
  const priorReview =
    reviewVersion?.metadata?.decision === 'CHANGES_REQUIRED' ? reviewVersion : undefined;

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

  const githubContext = await resolveGitHubContext(deps, gitIntegration, repositoryPath);
  const workspace = await createWorkspace(task.id, githubContext?.cloneUrl ?? repositoryPath);

  try {
    const { stdout: revisionOut } = await runGit(['rev-parse', 'HEAD'], workspace.path);
    const revision = revisionOut.trim();
    const repositoryFiles = await listRepositoryFiles(workspace.path);

    const {
      agentExecutionId,
      agentVersionId: agentVersionIdUnknown,
      ...modelOutput
    } = await runAgentTask(deps, task, {
      input: {
        implementationPlan: latestPlanVersion.metadata ?? {},
        repositoryFiles: repositoryFiles.map((file) => file.path),
        ...(priorReview ? { priorReviewFindings: priorReview.metadata?.findings ?? [] } : {}),
      },
      sources: [
        { type: 'ARTIFACT', ref: `artifact:${planArtifact.id}:v${latestPlanVersion.version}` },
        { type: 'REPOSITORY_LISTING', ref: `repository-listing:${revision}` },
        ...(priorReview && reviewArtifact
          ? [
              {
                type: 'ARTIFACT' as const,
                ref: `artifact:${reviewArtifact.id}:v${priorReview.version}`,
              },
            ]
          : []),
      ],
    });
    const agentVersionId = agentVersionIdUnknown as AgentVersionId;

    const proposedFiles = Array.isArray(modelOutput.files)
      ? (modelOutput.files as { path: string; content: string }[])
      : [];
    if (proposedFiles.length === 0) {
      throw new Error(`Development agent for task ${task.id} proposed no file changes.`);
    }

    const branchName =
      typeof modelOutput.branchName === 'string' && modelOutput.branchName.trim().length > 0
        ? modelOutput.branchName
        : `devos/task-${task.id}`;
    const commitMessage =
      typeof modelOutput.commitMessage === 'string' && modelOutput.commitMessage.trim().length > 0
        ? modelOutput.commitMessage
        : `DevOS: ${workItem.title}`;

    const pullRequestProvider = githubContext?.pullRequestProvider ?? deps.pullRequestProvider;
    const gatewayDeps = {
      ...deps,
      adapters: {
        ...createGitProviderAdapters(workspace),
        ...createPullRequestProviderAdapter(pullRequestProvider),
      },
    };

    for (const file of proposedFiles) {
      const invocation = await invokeTool(gatewayDeps, SYSTEM_ACTOR_ID, run.projectId, task.id, {
        capabilityKey: 'repo-write',
        target: { repositoryPath },
        parameters: { path: file.path, content: file.content, branch: branchName },
        idempotencyKey: `${task.id}:repo-write:${file.path}`,
        agentVersionId,
        ...(correlationId !== undefined ? { correlationId } : {}),
      });
      if (invocation.status !== 'SUCCEEDED') {
        throw new Error(
          `Failed to write proposed file "${file.path}" for task ${task.id}: ${invocation.errorCode ?? 'unknown error'}`,
        );
      }
    }

    const commitInvocation = await invokeTool(
      gatewayDeps,
      SYSTEM_ACTOR_ID,
      run.projectId,
      task.id,
      {
        capabilityKey: 'git-commit',
        target: { repositoryPath },
        parameters: { branch: branchName, message: commitMessage },
        idempotencyKey: `${task.id}:git-commit`,
        agentVersionId,
        ...(correlationId !== undefined ? { correlationId } : {}),
      },
    );
    if (commitInvocation.status !== 'SUCCEEDED') {
      throw new Error(
        `Failed to create commit for task ${task.id}: ${commitInvocation.errorCode ?? 'unknown error'}`,
      );
    }
    const commitSha = commitInvocation.providerReference;

    // Stage 7's own "Expected activities" list includes "create a pull
    // request where authorised" — folded into this same task rather than a
    // separate one, matching every other planning-path stage's
    // one-task-per-stage shape.
    const targetBranch =
      typeof gitIntegration.configuration.defaultBranch === 'string' &&
      gitIntegration.configuration.defaultBranch.trim().length > 0
        ? gitIntegration.configuration.defaultBranch
        : 'main';
    const prTitle =
      typeof modelOutput.summary === 'string' && modelOutput.summary.trim().length > 0
        ? modelOutput.summary
        : commitMessage;

    const pullRequestInvocation = await invokeTool(
      gatewayDeps,
      SYSTEM_ACTOR_ID,
      run.projectId,
      task.id,
      {
        capabilityKey: 'pull-request-create',
        target: { repositoryPath },
        parameters: {
          sourceBranch: branchName,
          targetBranch,
          title: prTitle,
          description: commitMessage,
          idempotencyKey: `${task.id}:pull-request-create`,
        },
        idempotencyKey: `${task.id}:pull-request-create`,
        agentVersionId,
        ...(correlationId !== undefined ? { correlationId } : {}),
      },
    );
    if (pullRequestInvocation.status !== 'SUCCEEDED') {
      throw new Error(
        `Failed to create pull request for task ${task.id}: ${pullRequestInvocation.errorCode ?? 'unknown error'}`,
      );
    }
    const pullRequestReference = pullRequestInvocation.providerReference;

    const now = new Date().toISOString();
    const content = {
      artifactType: 'CODE_CHANGE',
      workItemId: workItem.id,
      workItemTitle: workItem.title,
      derivedFromArtifactId: planArtifact.id,
      derivedFromArtifactVersionId: latestPlanVersion.id,
      summary: modelOutput.summary,
      branchName,
      commitMessage,
      commitSha,
      pullRequestReference,
      files: proposedFiles.map((file) => file.path),
      agentExecutionId,
      agentVersionId,
      generatedAt: now,
    };

    const stored = await deps.storage.put(JSON.stringify(content), CONTENT_TYPE);

    const artifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId: run.projectId,
      artifactType: 'CODE_CHANGE',
      name: `Code Change — ${workItem.title}`,
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
      branchName,
      commitSha,
      pullRequestReference,
    };
  } finally {
    await destroyWorkspace(workspace);
  }
}
