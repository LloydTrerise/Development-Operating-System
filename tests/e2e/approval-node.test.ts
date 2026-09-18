import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  Membership,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  approveApproval,
  rejectApproval,
  runApprovalTask,
  type ApprovalTaskHandlerDeps,
  type ApprovalUseCaseDeps,
} from '@devos/application';
import {
  createApprovalRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createDecideApprovalAndTransition,
  createMembershipRepository,
  createPolicyRepository,
  createPostgresTaskQueue,
  createProjectRepository,
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
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-122 — a real `APPROVAL` node, placed mid-graph (not at either of the
 * two hardcoded whole-run gate points), run to completion against real
 * Postgres via a real `TaskDispatcher`. Proves: the node's own approval
 * request is created at the point it's actually reached (not at whole-run
 * completion); the run's own status stays `PENDING` (never `AWAITING_APPROVAL`)
 * while it's pending, since this approval gates only its own downstream
 * dependents; deciding it through the existing, completely unchanged
 * DEVOS-110/111 decision path (`approveApproval`/`rejectApproval`) resumes
 * (or permanently fails) only this task, and the run reaches its real
 * terminal state from there through the ordinary `dependsOn` barrier —
 * mirrors `condition-node.test.ts`/`wait-node.test.ts`'s real-dispatcher
 * harness plus `approval-atomicity.test.ts`'s real decision-path harness.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-approval-node-test';

let database: DatabaseClient;

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Approval Node Test Project ${randomUUID()}`,
    slug: `approval-node-${randomUUID()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
  await createMembershipRepository(database.db).create({
    id: randomUUID() as Membership['id'],
    organisationId: project.organisationId,
    projectId: project.id,
    principalId: ACTOR_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  return project;
}

async function createApprovalWorkflowVersion(project: Project): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `approval-node-${randomUUID()}`,
    name: 'Approval Node Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Approval Node Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'start', type: 'TASK', name: 'Start' },
        {
          id: 'gate',
          type: 'APPROVAL',
          config: { approvalType: 'MID_BRANCH', pollIntervalSeconds: 0.2 },
        },
        { id: 'after', type: 'TASK', name: 'After gate' },
      ],
      edges: [
        { from: 'start', to: 'gate' },
        { from: 'gate', to: 'after' },
      ],
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

async function createWorkItemFixture(project: Project): Promise<WorkItem> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Approval node test work item',
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

// Mirrors condition-node.test.ts's own startRunFixture: this test talks to
// @devos/database directly (bypassing the application-layer use case), so it
// computes each task's own dependsOn by hand from the graph's declared edges
// exactly the way run-creation.ts does.
async function startRunFixture(project: Project, version: WorkflowVersion, workItem: WorkItem) {
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: version.id,
    workItemId: workItem.id,
    status: 'PENDING',
    input: {},
    idempotencyKey: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const tasks: WorkflowTask[] = version.definition.nodes.map((node) => {
    const dependsOn = version.definition.edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => edge.from);
    return {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: node.id,
      taskType: node.type,
      status: 'PENDING' as const,
      attempt: 0,
      input: dependsOn.length > 0 ? { dependsOn } : {},
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
  const approvalDeps: ApprovalTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    approvals: createApprovalRepository(database.db),
  };
  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
  dispatcher.registerHandler('APPROVAL', (task) => runApprovalTask(approvalDeps, task));
  dispatcher.registerHandler('TASK', async () => ({}));
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
  if (migrate.status !== 0)
    throw new Error(`Migration failed:\n${migrate.stdout}\n${migrate.stderr}`);
  const seed = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'seed'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (seed.status !== 0) throw new Error(`Seed failed:\n${seed.stdout}\n${seed.stderr}`);

  database = createDatabaseClient({ connectionString: DATABASE_URL });
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('DEVOS-122: real APPROVAL node execution', () => {
  it('creates a request at the gate, gates only its dependents, and resumes to completion once approved', async () => {
    const project = await createProjectFixture();
    const version = await createApprovalWorkflowVersion(project);
    const workItem = await createWorkItemFixture(project);
    const run = await startRunFixture(project, version, workItem);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(run.id, 'MID_BRANCH:gate');
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 5000 },
    );

    // Real proof this gates only its own dependents, not the whole run: the
    // run itself never enters AWAITING_APPROVAL (the run-level status the
    // two hardcoded whole-run gates use), and 'after' — which depends on
    // 'gate' — has not been claimed.
    const runWhilePending = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runWhilePending?.status).toBe('PENDING');
    const tasksWhilePending = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const afterWhilePending = tasksWhilePending.find((task) => task.taskKey === 'after');
    expect(afterWhilePending?.status).toBe('PENDING');

    const deps = buildApprovalUseCaseDeps();
    await approveApproval(deps, ACTOR_ID, pending.id, {
      scopeHash: pending.evidenceReference.scopeHash,
    });

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 5000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey.start?.status).toBe('SUCCEEDED');
    expect(byKey.gate?.status).toBe('SUCCEEDED');
    expect(byKey.gate?.output).toMatchObject({ approvalId: pending.id });
    expect(byKey.after?.status).toBe('SUCCEEDED');
  }, 15_000);

  it('permanently fails only the gated branch when rejected, failing the run (no tolerant JOIN in this graph)', async () => {
    const project = await createProjectFixture();
    const version = await createApprovalWorkflowVersion(project);
    const workItem = await createWorkItemFixture(project);
    const run = await startRunFixture(project, version, workItem);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(run.id, 'MID_BRANCH:gate');
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 5000 },
    );

    const deps = buildApprovalUseCaseDeps();
    await rejectApproval(deps, ACTOR_ID, pending.id, {
      scopeHash: pending.evidenceReference.scopeHash,
      comment: 'Not ready for this test.',
    });

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('FAILED');
      },
      { timeout: 5000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey.gate?.status).toBe('FAILED');
    expect(byKey.after?.status).toBe('FAILED');
  }, 15_000);
});
