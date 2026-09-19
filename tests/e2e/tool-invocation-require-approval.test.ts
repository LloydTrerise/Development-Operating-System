import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  Integration,
  Membership,
  Policy,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  approveApproval,
  rejectApproval,
  runReleaseRollbackTask,
  type ApprovalUseCaseDeps,
  type ToolTaskHandlerDeps,
} from '@devos/application';
import {
  createApprovalRepository,
  createArtifactPublisher,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createDatabaseClient,
  createDecideApprovalAndTransition,
  createIntegrationRepository,
  createMembershipRepository,
  createPolicyRepository,
  createPostgresTaskQueue,
  createProjectRepository,
  createToolCapabilityRepository,
  createToolInvocationRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';
import { runGit } from '@devos/integrations';
import { createLocalFilesystemStorage } from '@devos/storage';
import { createTaskDispatcher } from '@devos/worker';

/**
 * Gap revisit (post-Sprint-16) — real, live-Postgres proof of the
 * tool-invocation `REQUIRE_APPROVAL` mechanism added to
 * `packages/tools/src/gateway/invoke-tool.ts`: a real project policy
 * gating the `deploy` capability with `REQUIRE_APPROVAL` causes a real
 * `rollback` TOOL_TASK to create a real, `PENDING` `Approval` (with real
 * ABAC context) and park itself `WAITING` rather than fail — the run stays
 * `PENDING`, not `AWAITING_APPROVAL` (that run-level status is reserved for
 * the two hardcoded whole-run gates, per `approval-node.test.ts`'s own
 * finding) — and a real decision through the ordinary, unmodified
 * `approveApproval` path lets the next real dispatcher tick's retry
 * observe it and complete the deploy for real.
 *
 * Uses a fresh, dedicated project fixture (mirroring `approval-node.test.ts`/
 * `incident-response-workflow.test.ts`, not `release-rollback.test.ts`'s
 * shared `SEED_PROJECT_ID`): a `REQUIRE_APPROVAL` policy is project-scoped
 * *state*, not a per-test-file local variable — publishing it against the
 * one shared seeded project genuinely broke unrelated e2e files
 * (`release-rollback.test.ts`, `full-workflow.test.ts`) that also deploy
 * through that same project when the full suite ran, a real cross-test
 * pollution bug caught during this task's own validation, not merely a
 * hypothetical one.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-tool-invocation-approval-test';
const AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';

let database: DatabaseClient;
let project: Project;
let repositoryPath: string;
let stagingRoot: string;
let storageDir: string;
let firstRevision: string;
let secondRevision: string;

/** Two real commits, so there's a real revision to (re-)deploy. */
async function createRealRepositoryWithTwoCommits(): Promise<{
  repositoryPath: string;
  firstRevision: string;
  secondRevision: string;
}> {
  const repoPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-tool-approval-repo-'));
  await runGit(['init'], repoPath);
  await runGit(['config', 'user.email', 'devos-e2e@example.com'], repoPath);
  await runGit(['config', 'user.name', 'DevOS E2E'], repoPath);
  await writeFile(path.join(repoPath, 'STATUS.md'), '# v1\n', 'utf8');
  await runGit(['add', 'STATUS.md'], repoPath);
  await runGit(['commit', '-m', 'v1'], repoPath);
  const first = await runGit(['rev-parse', 'HEAD'], repoPath);

  await writeFile(path.join(repoPath, 'STATUS.md'), '# v2\n', 'utf8');
  await runGit(['add', 'STATUS.md'], repoPath);
  await runGit(['commit', '-m', 'v2'], repoPath);
  const second = await runGit(['rev-parse', 'HEAD'], repoPath);

  return {
    repositoryPath: repoPath,
    firstRevision: first.stdout.trim(),
    secondRevision: second.stdout.trim(),
  };
}

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const created: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Tool-Invocation Approval E2E Project ${randomUUID()}`,
    slug: `tool-invocation-approval-${randomUUID()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(created);
  return created;
}

/**
 * A brand-new project has no `tool_capabilities` rows of its own (only the
 * clone pipeline populates them, and this fixture bypasses it), so
 * `runReleaseRollbackTask`'s two Tool Gateway calls (`deploy`,
 * `health-check`) need these registered directly — mirrors
 * `incident-response-workflow.test.ts`'s identical, disclosed precondition.
 */
async function registerToolCapabilities(): Promise<void> {
  const toolCapabilities = createToolCapabilityRepository(database.db);
  const now = new Date().toISOString();
  await toolCapabilities.create({
    id: randomUUID() as Parameters<typeof toolCapabilities.create>[0]['id'],
    projectId: project.id,
    key: 'deploy',
    name: 'Deploy to Environment',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: { revision: { type: 'string' } },
      required: ['revision'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        deploymentId: { type: 'string' },
        deployedPath: { type: 'string' },
        revision: { type: 'string' },
      },
      required: ['deploymentId', 'deployedPath', 'revision'],
    },
    status: 'ACTIVE',
    createdAt: now,
  });
  await toolCapabilities.create({
    id: randomUUID() as Parameters<typeof toolCapabilities.create>[0]['id'],
    projectId: project.id,
    key: 'health-check',
    name: 'Run Post-Release Health Check',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
      },
      required: ['exitCode', 'stdout', 'stderr'],
    },
    status: 'ACTIVE',
    createdAt: now,
  });
}

/**
 * `runReleaseRollbackTask`'s Tool Gateway calls run as `devos-agent-runtime`
 * (`run-release-task.ts`'s own `SYSTEM_ACTOR_ID`), and `approveApproval`/
 * `rejectApproval` decide as this test's own `ACTOR_ID` — both need their
 * own real, `OWNER` project membership on this fresh project (`OWNER` is
 * required by `canDecideApproval`, and by the deploy/health-check
 * capability-permission check).
 */
async function grantMemberships(): Promise<void> {
  const now = new Date().toISOString();
  const memberships = createMembershipRepository(database.db);
  await memberships.create({
    id: randomUUID() as Membership['id'],
    organisationId: project.organisationId,
    projectId: project.id,
    principalId: AGENT_RUNTIME_PRINCIPAL_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  await memberships.create({
    id: randomUUID() as Membership['id'],
    organisationId: project.organisationId,
    projectId: project.id,
    principalId: ACTOR_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

async function createDeploymentGitIntegration(): Promise<void> {
  const now = new Date().toISOString();
  const gitIntegration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId: project.id,
    type: 'Git',
    provider: 'local',
    name: `Gap-revisit e2e repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'GAP_REVISIT_E2E_TEST_CREDENTIAL',
    configuration: {
      repositoryPath,
      releaseEnvironment: 'staging',
      stagingRoot,
      healthCheckCommand: process.platform === 'win32' ? 'cd' : 'pwd',
    },
    createdAt: now,
    updatedAt: now,
  };
  await createIntegrationRepository(database.db).create(gitIntegration);
}

async function publishRequireApprovalPolicy(): Promise<void> {
  const now = new Date().toISOString();
  const policies = createPolicyRepository(database.db);
  const policy: Policy = {
    id: randomUUID() as Policy['id'],
    organisationId: project.organisationId,
    projectId: project.id,
    key: `gap-revisit-e2e-require-approval-${Date.now()}`,
    version: 1,
    status: 'PUBLISHED',
    definition: { rules: [{ action: 'deploy', effect: 'REQUIRE_APPROVAL' }] },
    createdBy: ACTOR_ID,
    publishedAt: now,
    createdAt: now,
  };
  await policies.create(policy);
  await policies.publish(policy.id, now);
}

async function createWorkItemFixture(): Promise<WorkItem> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Tool-invocation REQUIRE_APPROVAL e2e test work item',
    type: 'GENERAL',
    status: 'OPEN',
    priority: 'MEDIUM',
    metadata: {},
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };
  await createWorkItemRepository(database.db).create(workItem);
  return workItem;
}

async function createRollbackWorkflowVersion(): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `gap-revisit-tool-approval-${randomUUID()}`,
    name: 'Gap Revisit Tool-Invocation Approval Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Gap Revisit Tool-Invocation Approval Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'rollback', type: 'TOOL_TASK', name: 'Rollback' }],
      edges: [],
      policies: [],
      outputs: [],
    },
    publishedAt: now,
    createdBy: ACTOR_ID,
    createdAt: now,
  };
  await createWorkflowVersionRepository(database.db).create(version);

  return version;
}

async function startRunFixture(
  version: WorkflowVersion,
  workItem: WorkItem,
  rollbackToRevision: string,
): Promise<WorkflowRun> {
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: version.id,
    workItemId: workItem.id,
    status: 'PENDING',
    input: { rollbackToRevision },
    idempotencyKey: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const tasks: WorkflowTask[] = version.definition.nodes.map((node) => ({
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: node.id,
    taskType: node.type,
    status: 'PENDING' as const,
    attempt: 0,
    input: { rollbackToRevision },
    createdAt: now,
    updatedAt: now,
  }));

  await createWorkflowRunStarter(database.db)(run, tasks, ACTOR_ID);
  return run;
}

// No explicit `: ToolTaskHandlerDeps` return-type annotation — this
// object also needs a real `workflowVersions` repository (an optional
// field `ToolGatewayDeps` declares but `ToolTaskHandlerDeps` doesn't) so
// `invokeTool`'s own DEVOS-138 ABAC resolution can actually populate
// `workflowId`/`workflowVersion` on the real Approval this test asserts
// against; an explicit narrower annotation would reject it as an excess
// property. `runReleaseRollbackTask` still accepts this structurally.
function buildToolTaskDeps() {
  return {
    workflowRuns: createWorkflowRunRepository(database.db),
    workItems: createWorkItemRepository(database.db),
    storage: createLocalFilesystemStorage(storageDir),
    publishArtifact: createArtifactPublisher(database.db),
    artifacts: createArtifactRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    policies: createPolicyRepository(database.db),
    toolCapabilities: createToolCapabilityRepository(database.db),
    toolInvocations: createToolInvocationRepository(database.db),
    auditRecords: createAuditRecordRepository(database.db),
    integrations: createIntegrationRepository(database.db),
    // Gap revisit: the two new, optional deps that activate the real
    // REQUIRE_APPROVAL mechanism in `invoke-tool.ts` — without these, a
    // REQUIRE_APPROVAL decision falls back to an outright rejection.
    approvals: createApprovalRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
  };
}

function buildApprovalUseCaseDeps(): ApprovalUseCaseDeps {
  return {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    workflowRuns: createWorkflowRunRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    approvals: createApprovalRepository(database.db),
    policies: createPolicyRepository(database.db),
    decideApprovalAndTransition: createDecideApprovalAndTransition(database.db),
    workItems: createWorkItemRepository(database.db),
    workflowDefinitions: createWorkflowDefinitionRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    createDraft: createWorkflowDraftCreator(database.db),
    startRun: createWorkflowRunStarter(database.db),
  };
}

function startDispatcher() {
  const toolTaskDeps = buildToolTaskDeps();
  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
  dispatcher.registerHandler('TOOL_TASK', (task) => {
    if (task.taskKey !== 'rollback') {
      throw new Error(`Unexpected TOOL_TASK taskKey "${task.taskKey}" in this test.`);
    }
    return runReleaseRollbackTask(toolTaskDeps as ToolTaskHandlerDeps, task);
  });
  dispatcher.start();
  return dispatcher;
}

beforeAll(async () => {
  const migrate = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'migrate'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (migrate.status !== 0) {
    throw new Error(`Migration failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }
  const seed = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'seed'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (seed.status !== 0) {
    throw new Error(`Seed failed:\n${seed.stdout}\n${seed.stderr}`);
  }

  database = createDatabaseClient({ connectionString: DATABASE_URL });
  storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-tool-approval-storage-'));
  stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-e2e-tool-approval-staging-'));
  const repo = await createRealRepositoryWithTwoCommits();
  repositoryPath = repo.repositoryPath;
  firstRevision = repo.firstRevision;
  secondRevision = repo.secondRevision;

  project = await createProjectFixture();
  await registerToolCapabilities();
  await grantMemberships();
  await createDeploymentGitIntegration();
}, 60_000);

afterAll(async () => {
  await database?.close();
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
  if (repositoryPath) await rm(repositoryPath, { recursive: true, force: true });
  if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
});

describe('Gap revisit: a real policy REQUIRE_APPROVAL decision on a tool invocation creates and resolves a real Approval', () => {
  it('parks the deploy WAITING behind a real, PENDING Approval carrying real ABAC context, and an approved decision lets the next retry complete it for real', async () => {
    await publishRequireApprovalPolicy();

    const workItem = await createWorkItemFixture();
    const version = await createRollbackWorkflowVersion();
    const run = await startRunFixture(version, workItem, firstRevision);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);
    const tasks = createWorkflowTaskRepository(database.db);

    try {
      const rollbackTask = (await tasks.listForRun(run.id))[0]!;
      const expectedApprovalType = `tool-invocation:deploy:${rollbackTask.id}:rollback`;

      const pending = await vi.waitFor(
        async () => {
          const found = await approvals.getPendingForRunAndType(run.id, expectedApprovalType);
          expect(found).not.toBeNull();
          return found!;
        },
        { timeout: 10_000 },
      );
      expect(pending.status).toBe('PENDING');
      expect(pending.requestedBy).toBe(AGENT_RUNTIME_PRINCIPAL_ID);
      // Real ABAC context, not fabricated: the deploy capability's own
      // riskClass, carried straight through onto the real Approval row.
      expect(pending.riskClass).toBe('R3');
      expect(pending.workflowId).toBe(version.workflowDefinitionId);
      expect(pending.workflowVersion).toBe(version.version);

      // Real proof this doesn't fail the task outright: it parks WAITING
      // (a real dispatcher tick writes this asynchronously, so this polls
      // rather than reading a single snapshot), and the run itself never
      // moves off PENDING (this is not the run-level AWAITING_APPROVAL
      // gate).
      await vi.waitFor(
        async () => {
          const waitingTask = await tasks.getById(rollbackTask.id);
          expect(waitingTask?.status).toBe('WAITING');
        },
        { timeout: 5000 },
      );
      const runWhilePending = await createWorkflowRunRepository(database.db).getById(run.id);
      expect(runWhilePending?.status).toBe('PENDING');

      // The real, unmodified decision path — no special-casing for a
      // tool-invocation-triggered approval.
      const decided = await approveApproval(buildApprovalUseCaseDeps(), ACTOR_ID, pending.id, {
        scopeHash: pending.evidenceReference.scopeHash,
      });
      expect(decided.status).toBe('APPROVED');

      // The real dispatcher's own periodic tick (not a mocked clock) must
      // pick this up on its own retry once the WAITING task's real
      // `waitUntil` elapses.
      await vi.waitFor(
        async () => {
          const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
          expect(runAfter?.status).toBe('COMPLETED');
        },
        { timeout: 15_000 },
      );

      const finalTasks = await tasks.listForRun(run.id);
      expect(finalTasks[0]?.status).toBe('SUCCEEDED');

      const artifacts = await createArtifactRepository(database.db).listForProject(project.id);
      const releaseEvidence = artifacts
        .filter(
          (artifact) =>
            artifact.workflowRunId === run.id && artifact.artifactType === 'RELEASE_EVIDENCE',
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      expect(releaseEvidence).toBeDefined();
      const versions = await createArtifactVersionRepository(database.db).listForArtifact(
        releaseEvidence!.id,
      );
      const latest = versions.sort((a, b) => b.version - a.version)[0]!;
      expect(latest.metadata?.action).toBe('rollback');
      expect(latest.metadata?.revision).toBe(firstRevision);
      expect(latest.metadata?.passed).toBe(true);

      // Real confirmation, not assumed: the real staging directory's own
      // HEAD is genuinely checked out at the approved (rolled-back-to)
      // revision.
      const deployedHead = await runGit(['rev-parse', 'HEAD'], path.join(stagingRoot, 'staging'));
      expect(deployedHead.stdout.trim()).toBe(firstRevision);
      expect(deployedHead.stdout.trim()).not.toBe(secondRevision);
      const statusContent = await readFile(path.join(stagingRoot, 'staging', 'STATUS.md'), 'utf8');
      expect(statusContent).toContain('v1');
    } finally {
      await dispatcher.stop();
    }
  }, 45_000);

  it('a rejected decision permanently fails the WAITING task on the next retry, without ever retrying the deploy again', async () => {
    await publishRequireApprovalPolicy();

    const workItem = await createWorkItemFixture();
    const version = await createRollbackWorkflowVersion();
    const run = await startRunFixture(version, workItem, firstRevision);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);
    const tasks = createWorkflowTaskRepository(database.db);

    try {
      const rollbackTask = (await tasks.listForRun(run.id))[0]!;
      const expectedApprovalType = `tool-invocation:deploy:${rollbackTask.id}:rollback`;

      const pending = await vi.waitFor(
        async () => {
          const found = await approvals.getPendingForRunAndType(run.id, expectedApprovalType);
          expect(found).not.toBeNull();
          return found!;
        },
        { timeout: 10_000 },
      );

      await rejectApproval(buildApprovalUseCaseDeps(), ACTOR_ID, pending.id, {
        scopeHash: pending.evidenceReference.scopeHash,
        comment: 'Not approved for this test.',
      });

      await vi.waitFor(
        async () => {
          const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
          expect(runAfter?.status).toBe('FAILED');
        },
        { timeout: 15_000 },
      );

      const finalTasks = await tasks.listForRun(run.id);
      expect(finalTasks[0]?.status).toBe('FAILED');
    } finally {
      await dispatcher.stop();
    }
  }, 45_000);
});
