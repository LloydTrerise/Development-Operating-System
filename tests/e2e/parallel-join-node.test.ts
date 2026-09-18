import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NonRetryableTaskError } from '@devos/domain';
import type { Project, WorkflowRun, WorkflowTask, WorkflowVersion, WorkItem } from '@devos/domain';
import {
  createDatabaseClient,
  createPostgresTaskQueue,
  createProjectRepository,
  createWorkflowDefinitionRepository,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';
import { runJoinTask, runParallelTask } from '@devos/application';
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-120 — a real `PARALLEL`/`JOIN` pair run to completion against real
 * Postgres via a real `TaskDispatcher`. Three scenarios, each proving the
 * queue/failure machinery (`packages/database/src/repositories/task-queue.ts`),
 * not these deliberately trivial handlers:
 *
 *  - every branch succeeds -> the join succeeds -> the run completes.
 *  - one branch permanently fails under a STRICT join -> the whole run
 *    fails, matching every pre-Sprint-11 workflow's unchanged behavior.
 *  - one branch permanently fails under a TOLERANT join -> the run still
 *    reaches COMPLETED (real partial-failure semantics), the failed
 *    branch's own task stays FAILED, and everything downstream of the join
 *    still runs for real.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-parallel-join-node-test';
const FAILING_BRANCH_ERROR = 'deliberate branch failure for DEVOS-120 e2e coverage';

let database: DatabaseClient;
let project: Project;

async function createParallelJoinWorkflowVersion(
  branchFailurePolicy?: 'strict' | 'tolerant',
): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `parallel-join-${randomUUID()}`,
    name: 'Parallel Join Node Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Parallel Join Node Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'fanout', type: 'PARALLEL' },
        { id: 'branchA', type: 'TASK', name: 'Branch A' },
        { id: 'branchB', type: 'TASK', name: 'Branch B' },
        {
          id: 'join',
          type: 'JOIN',
          ...(branchFailurePolicy !== undefined ? { config: { branchFailurePolicy } } : {}),
        },
        { id: 'final', type: 'TASK', name: 'Final' },
      ],
      edges: [
        { from: 'fanout', to: 'branchA' },
        { from: 'fanout', to: 'branchB' },
        { from: 'branchA', to: 'join' },
        { from: 'branchB', to: 'join' },
        { from: 'join', to: 'final' },
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

async function createWorkItemFixture(): Promise<WorkItem> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Parallel join node test work item',
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

/** Mirrors run-creation.ts's dependsOn/dependsOnTerminalOnly computation — see condition-node.test.ts's identical helper for why this test talks to @devos/database directly. */
async function startRunFixture(version: WorkflowVersion, workItem: WorkItem): Promise<WorkflowRun> {
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
      input: {
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

function startDispatcher(failingTaskKey?: string) {
  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20 });
  dispatcher.registerHandler('PARALLEL', () => runParallelTask());
  dispatcher.registerHandler('JOIN', () => runJoinTask());
  dispatcher.registerHandler('TASK', async (task) => {
    if (task.taskKey === failingTaskKey) {
      throw new NonRetryableTaskError(FAILING_BRANCH_ERROR);
    }
    return {};
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

  const now = new Date().toISOString();
  project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Parallel Join Node Test Project ${Date.now()}`,
    slug: `parallel-join-node-${Date.now()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('DEVOS-120: real PARALLEL/JOIN node execution', () => {
  it('fans out both branches concurrently, joins, and completes when everything succeeds', async () => {
    const version = await createParallelJoinWorkflowVersion();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const dispatcher = startDispatcher();

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
    expect(byKey.fanout?.status).toBe('SUCCEEDED');
    expect(byKey.branchA?.status).toBe('SUCCEEDED');
    expect(byKey.branchB?.status).toBe('SUCCEEDED');
    expect(byKey.join?.status).toBe('SUCCEEDED');
    expect(byKey.final?.status).toBe('SUCCEEDED');
  }, 15_000);

  it('fails the whole run when one branch fails under the default (strict) join policy', async () => {
    const version = await createParallelJoinWorkflowVersion('strict');
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const dispatcher = startDispatcher('branchA');

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
    expect(byKey.branchA?.status).toBe('FAILED');
    // join/final never became eligible under the strict (SUCCEEDED-only)
    // barrier, so the existing DEVOS-108-followup sibling-cascade marks
    // them FAILED too — the same behavior every pre-Sprint-11 workflow
    // already relies on, completely unchanged by this task.
    expect(byKey.join?.status).toBe('FAILED');
    expect(byKey.final?.status).toBe('FAILED');
  }, 15_000);

  it('survives one branch permanently failing under a tolerant join, and still completes the run', async () => {
    const version = await createParallelJoinWorkflowVersion('tolerant');
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const dispatcher = startDispatcher('branchA');

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
    expect(byKey.branchA?.status).toBe('FAILED');
    expect(byKey.branchA?.errorMessage).toBe(FAILING_BRANCH_ERROR);
    expect(byKey.branchB?.status).toBe('SUCCEEDED');
    expect(byKey.join?.status).toBe('SUCCEEDED');
    expect(byKey.final?.status).toBe('SUCCEEDED');
  }, 15_000);
});
