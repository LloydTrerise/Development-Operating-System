import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  Integration,
  Membership,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  approveApproval,
  createProject,
  runApprovalTask,
  runConditionTask,
  runDiagnoseIncidentTask,
  runIncidentLogTask,
  runJoinTask,
  runNotifyStakeholdersTask,
  runParallelTask,
  runReleaseRollbackTask,
  runWaitTask,
  type ApprovalTaskHandlerDeps,
  type ApprovalUseCaseDeps,
  type ConditionTaskHandlerDeps,
  type ProjectUseCaseDeps,
  type ToolTaskHandlerDeps,
  type WaitTaskHandlerDeps,
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
  createProjectTypeAgentRepository,
  createProjectTypeRepository,
  createProjectTypeWorkflowRepository,
  createProjectWithClonesCreator,
  createToolCapabilityRepository,
  createToolInvocationRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  SEED_INCIDENT_RESPONSE_PROJECT_TYPE_ID,
  SEED_INCIDENT_RESPONSE_WORKFLOW_KEY,
  SEED_ORGANISATION_ID,
  type DatabaseClient,
} from '@devos/database';
import { runGit } from '@devos/integrations';
import { createLocalFilesystemStorage } from '@devos/storage';
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-126 — the Sprint 12 pilot: a real project of the new
 * `incident-response` type is created through the real, unmodified clone
 * pipeline (`createProject`, `specs/architecture/organisations-and-project-types.md`
 * §8), and its cloned `incident-response` workflow is run to completion for
 * real against Postgres, exercising every Sprint 11 primitive together —
 * `CONDITION`, `PARALLEL`/`JOIN` (including a real deliberately-failing
 * branch under a tolerant policy), `WAIT` (duration), and `APPROVAL` placed
 * mid-branch — plus DEVOS-123's `SKIPPED` cascade across a longer chain than
 * any Sprint 11 test used.
 *
 * Real finding disclosed during DEVOS-125 (see `specs/sprints/sprint-12/DEVOS-125.md`):
 * `tool_capabilities` rows are project-scoped and are not cloned by the
 * ProjectType pipeline (confirmed by reading `invoke-tool.ts`'s
 * `getByProjectAndKey` lookup and `packages/domain/src/tools/tool-capability.ts`'s
 * own doc comment) — a pre-existing gap this sprint does not fix, since
 * fixing it generally is unrequested scope beyond proving the engine
 * primitives. This test works around it exactly the way it would for any
 * brand-new project needing `deploy`/`health-check`: registering those two
 * capability rows directly, the same real precondition
 * `release-rollback.test.ts` already sets up for the one seeded project.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-incident-response-e2e-test';
const AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';
const FAILING_NOTIFY_ERROR_FRAGMENT = 'Notification deliberately failed';

let database: DatabaseClient;
let project: Project;
let repositoryPath: string;
let stagingRoot: string;
let storageDir: string;
let revision: string;
let workflowVersion: WorkflowVersion;

function projectUseCaseDeps(): ProjectUseCaseDeps {
  return {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    auditRecords: createAuditRecordRepository(database.db),
    projectTypes: createProjectTypeRepository(database.db),
    projectTypeWorkflows: createProjectTypeWorkflowRepository(database.db),
    projectTypeAgents: createProjectTypeAgentRepository(database.db),
    createProjectWithClones: createProjectWithClonesCreator(database.db),
  };
}

/** Mirrors `release-rollback.test.ts`'s identical helper: a real local
 * repository with one real commit is all `remediation`/`rollback` needs — a
 * genuine prior/known revision to (re-)deploy, not a fabricated one. */
async function createRealRepositoryWithOneCommit(): Promise<{
  repositoryPath: string;
  revision: string;
}> {
  const repoPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-incident-response-repo-'));
  await runGit(['init'], repoPath);
  await runGit(['config', 'user.email', 'devos-e2e@example.com'], repoPath);
  await runGit(['config', 'user.name', 'DevOS E2E'], repoPath);
  await writeFile(path.join(repoPath, 'STATUS.md'), '# v1\n', 'utf8');
  await runGit(['add', 'STATUS.md'], repoPath);
  await runGit(['commit', '-m', 'v1'], repoPath);
  const head = await runGit(['rev-parse', 'HEAD'], repoPath);
  return { repositoryPath: repoPath, revision: head.stdout.trim() };
}

/**
 * The one real, disclosed precondition DEVOS-125 found: a brand-new
 * project has no `tool_capabilities` rows of its own (the clone pipeline
 * only clones workflows/agents), so `remediation`/`rollback`'s two Tool
 * Gateway calls (`deploy`, `health-check`) would otherwise fail with
 * `NotFoundError('ToolCapability')` before ever reaching a provider adapter.
 */
async function registerToolCapabilities(projectId: WorkItem['projectId']): Promise<void> {
  const toolCapabilities = createToolCapabilityRepository(database.db);
  const now = new Date().toISOString();
  await toolCapabilities.create({
    id: randomUUID() as Parameters<typeof toolCapabilities.create>[0]['id'],
    projectId,
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
    projectId,
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
 * `remediation`'s `rollback` handler invokes the Tool Gateway as
 * `devos-agent-runtime` (`run-release-task.ts`'s own `SYSTEM_ACTOR_ID`), not
 * this test's own `ACTOR_ID` — that principal needs its own real project
 * membership, mirroring `SEED_AGENT_RUNTIME_MEMBERSHIP_ID`'s exact role
 * (`OWNER`) for the one seeded project.
 */
async function grantAgentRuntimeMembership(
  organisationId: Membership['organisationId'],
  projectId: Membership['projectId'],
): Promise<void> {
  const now = new Date().toISOString();
  await createMembershipRepository(database.db).create({
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId,
    principalId: AGENT_RUNTIME_PRINCIPAL_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
}

async function createDeploymentGitIntegration(projectId: Integration['projectId']): Promise<void> {
  const now = new Date().toISOString();
  const gitIntegration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId,
    type: 'Git',
    provider: 'local',
    name: `DEVOS-126 e2e repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'DEVOS126_E2E_TEST_CREDENTIAL',
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

async function createWorkItemFixture(projectId: WorkItem['projectId']): Promise<WorkItem> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
    title: 'Incident response e2e test work item',
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

/** Mirrors `parallel-join-node.test.ts`/`skip-cascade-node.test.ts`'s
 * identical helper: this test talks to `@devos/database` directly (the run
 * is started against the real cloned workflow version, but bypassing the
 * application-layer "start run" use case itself), so it computes each
 * task's own `dependsOn`/`dependsOnTerminalOnly` by hand from the graph's
 * declared edges exactly the way `run-creation.ts` does. */
async function startRunFixture(
  projectId: WorkItem['projectId'],
  workItem: WorkItem,
  input: Record<string, unknown>,
): Promise<WorkflowRun> {
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId,
    workflowVersionId: workflowVersion.id,
    workItemId: workItem.id,
    status: 'PENDING',
    input,
    idempotencyKey: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const tasks: WorkflowTask[] = workflowVersion.definition.nodes.map((node) => {
    const dependsOn = workflowVersion.definition.edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => edge.from);
    const dependsOnTerminalOnly =
      node.type === 'JOIN' &&
      (node.config as Record<string, unknown> | undefined)?.branchFailurePolicy === 'tolerant';
    return {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: node.id,
      taskType: node.type,
      status: 'PENDING' as const,
      attempt: 0,
      // Mirrors `run-creation.ts`'s own DEVOS-114 behavior: the run's own
      // input is spread into every task's input too, since
      // `runReleaseRollbackTask` reads `task.input.rollbackToRevision`, not
      // `run.input.rollbackToRevision`.
      input: {
        ...input,
        ...(dependsOn.length > 0 ? { dependsOn } : {}),
        ...(dependsOnTerminalOnly ? { dependsOnTerminalOnly: true } : {}),
      },
      createdAt: now,
      updatedAt: now,
    };
  });

  await createWorkflowRunStarter(database.db)(run, tasks, ACTOR_ID);
  return run;
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
  const conditionDeps: ConditionTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    artifacts: createArtifactRepository(database.db),
  };
  const waitDeps: WaitTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
  };
  const approvalDeps: ApprovalTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    approvals: createApprovalRepository(database.db),
  };
  const toolTaskDeps: ToolTaskHandlerDeps = {
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
  };

  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
  dispatcher.registerHandler('CONDITION', (task) => runConditionTask(conditionDeps, task));
  dispatcher.registerHandler('PARALLEL', () => runParallelTask());
  dispatcher.registerHandler('JOIN', () => runJoinTask());
  dispatcher.registerHandler('WAIT', (task) => runWaitTask(waitDeps, task));
  dispatcher.registerHandler('APPROVAL', (task) => runApprovalTask(approvalDeps, task));
  // Mirrors `apps/worker/src/tool-task-router.ts`'s real `routeToolTask`
  // dispatch for exactly the four taskKeys this workflow uses — that
  // module isn't exported from `@devos/worker` (only `task-dispatcher.ts`
  // is), so this inlines the identical routing the real worker performs.
  dispatcher.registerHandler('TOOL_TASK', (task) => {
    switch (task.taskKey) {
      case 'diagnose':
        return runDiagnoseIncidentTask(toolTaskDeps, task);
      case 'notify':
        return runNotifyStakeholdersTask(toolTaskDeps, task);
      case 'log-only':
        return runIncidentLogTask(toolTaskDeps, task);
      case 'rollback':
        return runReleaseRollbackTask(toolTaskDeps, task);
      default:
        throw new Error(`Unexpected TOOL_TASK taskKey "${task.taskKey}" in this test.`);
    }
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
  storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-incident-response-storage-'));
  stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-e2e-incident-response-staging-'));
  const repo = await createRealRepositoryWithOneCommit();
  repositoryPath = repo.repositoryPath;
  revision = repo.revision;

  // The real, unmodified clone pipeline (create-project.ts) — the first
  // real Postgres proof it generalizes beyond the one "software-development"
  // type it has ever cloned until now.
  project = await createProject(projectUseCaseDeps(), ACTOR_ID, {
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_INCIDENT_RESPONSE_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Incident Response E2E Project ${Date.now()}`,
    slug: `incident-response-e2e-${Date.now()}`,
  });

  await grantAgentRuntimeMembership(project.organisationId, project.id);
  await createDeploymentGitIntegration(project.id);
  await registerToolCapabilities(project.id);

  const clonedDefinition = await createWorkflowDefinitionRepository(database.db).getByProjectAndKey(
    project.id,
    SEED_INCIDENT_RESPONSE_WORKFLOW_KEY,
  );
  if (!clonedDefinition) {
    throw new Error(
      `Clone pipeline did not create a "${SEED_INCIDENT_RESPONSE_WORKFLOW_KEY}" workflow definition for project ${project.id}.`,
    );
  }
  const clonedVersion = await createWorkflowVersionRepository(database.db).getLatestForDefinition(
    clonedDefinition.id,
  );
  if (!clonedVersion) {
    throw new Error(`Cloned workflow definition ${clonedDefinition.id} has no version.`);
  }
  workflowVersion = clonedVersion;
}, 60_000);

afterAll(async () => {
  await database?.close();
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
  if (repositoryPath) await rm(repositoryPath, { recursive: true, force: true });
  if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
});

describe('DEVOS-126: real end-to-end Incident Response pilot', () => {
  it('a real project of the new type clones the real workflow verbatim', () => {
    expect(workflowVersion.definition.nodes.map((node) => node.id).sort()).toEqual(
      [
        'await-confirmation',
        'diagnose',
        'diagnose-and-notify',
        'diagnosis-join',
        'log-only',
        'notify',
        'remediation-approval',
        'rollback',
        'severity-check',
      ].sort(),
    );
  });

  it('high severity: runs diagnose+notify in parallel, joins, waits, gates remediation behind approval, and completes — the untaken low-severity branch is SKIPPED', async () => {
    const workItem = await createWorkItemFixture(project.id);
    const run = await startRunFixture(project.id, workItem, {
      severity: 'high',
      rollbackToRevision: revision,
    });

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const startedAt = Date.now();
    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(
          run.id,
          'incident-remediation:remediation-approval',
        );
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 10_000 },
    );
    // Real proof the WAIT genuinely elapsed real wall-clock time (1s
    // configured) before the APPROVAL request downstream of it was ever
    // created — mirrors wait-node.test.ts's own >=900ms convention.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);

    const approvalDeps = buildApprovalUseCaseDeps();
    await approveApproval(approvalDeps, ACTOR_ID, pending.id, {
      scopeHash: pending.evidenceReference.scopeHash,
    });

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 15_000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey['severity-check']?.status).toBe('SUCCEEDED');
    expect(byKey['severity-check']?.output).toMatchObject({ branch: 'high' });
    expect(byKey['diagnose-and-notify']?.status).toBe('SUCCEEDED');
    expect(byKey.diagnose?.status).toBe('SUCCEEDED');
    expect(byKey.notify?.status).toBe('SUCCEEDED');
    expect(byKey['diagnosis-join']?.status).toBe('SUCCEEDED');
    expect(byKey['await-confirmation']?.status).toBe('SUCCEEDED');
    expect(byKey['remediation-approval']?.status).toBe('SUCCEEDED');
    expect(byKey['remediation-approval']?.output).toMatchObject({ approvalId: pending.id });
    expect(byKey.rollback?.status).toBe('SUCCEEDED');
    // The untaken low-severity branch, real proof of DEVOS-119/123 in this
    // new graph shape too.
    expect(byKey['log-only']?.status).toBe('SKIPPED');
  }, 30_000);

  /**
   * Real finding from live-verifying this scenario (disclosed in
   * `specs/sprints/sprint-12/DEVOS-126.md`, not silently patched): a
   * *tolerant* `JOIN`'s own handler (`runJoinTask()`) unconditionally
   * returns `SUCCEEDED` once its dependencies reach any terminal state —
   * it never itself becomes `SKIPPED`, regardless of whether its own
   * upstream branches genuinely ran, failed, or were skipped by a
   * `CONDITION`. So on the low-severity path, `diagnose`/`notify` (and the
   * `diagnose-and-notify` `PARALLEL` node one hop above them) really are
   * skipped via DEVOS-119/123's real one-hop-then-cascade mechanism, but
   * `diagnosis-join` genuinely proceeds to `SUCCEEDED` anyway (that is
   * exactly what "tolerant" means), and everything after it —
   * `await-confirmation`, `remediation-approval`, `rollback` — genuinely
   * executes for real too, requiring the same real approval decision as the
   * high-severity path. A tolerant `JOIN` cannot be used to fully bypass
   * its own downstream inside a conditionally-skipped branch; only a task
   * that plainly `dependsOn` a `SKIPPED`/`FAILED` upstream (with no
   * intervening tolerant `JOIN`) cascades to `SKIPPED` itself.
   */
  it('low severity: skips diagnose/notify but the tolerant join still proceeds for real, requiring the same approval as high severity', async () => {
    const workItem = await createWorkItemFixture(project.id);
    const run = await startRunFixture(project.id, workItem, {
      severity: 'low',
      rollbackToRevision: revision,
    });

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(
          run.id,
          'incident-remediation:remediation-approval',
        );
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 10_000 },
    );

    const approvalDeps = buildApprovalUseCaseDeps();
    await approveApproval(approvalDeps, ACTOR_ID, pending.id, {
      scopeHash: pending.evidenceReference.scopeHash,
    });

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 15_000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey['severity-check']?.status).toBe('SUCCEEDED');
    expect(byKey['severity-check']?.output).toMatchObject({ branch: 'low' });
    expect(byKey['log-only']?.status).toBe('SUCCEEDED');
    // DEVOS-119's own one-hop skip covers diagnose-and-notify; diagnose/
    // notify have no direct relationship to severity-check at all — only
    // DEVOS-123's real transitive-closure cascade resolves them.
    expect(byKey['diagnose-and-notify']?.status).toBe('SKIPPED');
    expect(byKey.diagnose?.status).toBe('SKIPPED');
    expect(byKey.notify?.status).toBe('SKIPPED');
    // The tolerant join genuinely proceeds regardless — see this test's own
    // doc comment above.
    expect(byKey['diagnosis-join']?.status).toBe('SUCCEEDED');
    expect(byKey['await-confirmation']?.status).toBe('SUCCEEDED');
    expect(byKey['remediation-approval']?.status).toBe('SUCCEEDED');
    expect(byKey.rollback?.status).toBe('SUCCEEDED');
  }, 20_000);

  it('a deliberately failing notify branch does not block the tolerant join — diagnosis still proceeds to remediation', async () => {
    const workItem = await createWorkItemFixture(project.id);
    const run = await startRunFixture(project.id, workItem, {
      severity: 'high',
      rollbackToRevision: revision,
      simulateNotifyFailure: true,
    });

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(
          run.id,
          'incident-remediation:remediation-approval',
        );
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 10_000 },
    );

    const approvalDeps = buildApprovalUseCaseDeps();
    await approveApproval(approvalDeps, ACTOR_ID, pending.id, {
      scopeHash: pending.evidenceReference.scopeHash,
    });

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 15_000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey.diagnose?.status).toBe('SUCCEEDED');
    expect(byKey.notify?.status).toBe('FAILED');
    expect(byKey.notify?.errorMessage).toContain(FAILING_NOTIFY_ERROR_FRAGMENT);
    // The tolerant JOIN's own dependsOnTerminalOnly barrier let it proceed
    // once both branches reached ANY terminal state (SUCCEEDED or FAILED),
    // not only SUCCEEDED — real proof of DEVOS-120's policy in this new
    // graph shape.
    expect(byKey['diagnosis-join']?.status).toBe('SUCCEEDED');
    expect(byKey['await-confirmation']?.status).toBe('SUCCEEDED');
    expect(byKey['remediation-approval']?.status).toBe('SUCCEEDED');
    expect(byKey.rollback?.status).toBe('SUCCEEDED');
  }, 30_000);
});
