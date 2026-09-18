import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { runWaitTask, type WaitTaskHandlerDeps } from '@devos/application';
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-121 — a real `WAIT` node run to completion against real Postgres via
 * a real `TaskDispatcher`. Both variants reuse the same `WAITING`/
 * `resumeReadyWaits()` mechanism (`packages/database/src/repositories/task-queue.ts`)
 * — a short `reclaimIntervalMs` is used so the dispatcher's own periodic
 * re-check (the same tick that already runs `reclaimStale()`) happens often
 * enough to observe within a real, but small, wall-clock delay.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-wait-node-test';

let database: DatabaseClient;
let project: Project;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createWorkflowVersion(nodes: WorkflowVersion['definition']['nodes']) {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `wait-node-${randomUUID()}`,
    name: 'Wait Node Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Wait Node Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes,
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

async function createWorkItemFixture(): Promise<WorkItem> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Wait node test work item',
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
  const tasks: WorkflowTask[] = version.definition.nodes.map((node) => ({
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: node.id,
    taskType: node.type,
    status: 'PENDING' as const,
    attempt: 0,
    input: {},
    createdAt: now,
    updatedAt: now,
  }));

  await createWorkflowRunStarter(database.db)(run, tasks, ACTOR_ID);
  return run;
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
    name: `Wait Node Test Project ${Date.now()}`,
    slug: `wait-node-${Date.now()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('DEVOS-121: real WAIT node execution', () => {
  it('a time-based WAIT resumes and completes only after its real duration has elapsed', async () => {
    const version = await createWorkflowVersion([
      { id: 'wait', type: 'WAIT', config: { waitType: 'duration', durationSeconds: 1 } },
    ]);
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const waitDeps: WaitTaskHandlerDeps = {
      workflowRuns: createWorkflowRunRepository(database.db),
      workflowVersions: createWorkflowVersionRepository(database.db),
      workflowTasks: createWorkflowTaskRepository(database.db),
    };
    const queue = createPostgresTaskQueue(database.db);
    const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
    dispatcher.registerHandler('WAIT', (task) => runWaitTask(waitDeps, task));

    const startedAt = Date.now();
    dispatcher.start();

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 8000 },
    );
    const elapsedMs = Date.now() - startedAt;
    await dispatcher.stop();

    // Proves a real wall-clock delay actually happened, not an instantly
    // resolved/mocked one — allowing a small margin below the configured
    // 1000ms for scheduling jitter between the WAIT task's own recorded
    // waitUntil and this test's own start-of-dispatcher timestamp.
    expect(elapsedMs).toBeGreaterThanOrEqual(900);

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    expect(tasks[0]?.status).toBe('SUCCEEDED');
  }, 15_000);

  it('a dependency-based WAIT resumes only once its named task has actually produced an artifact', async () => {
    const version = await createWorkflowVersion([
      { id: 'produce', type: 'TASK' },
      {
        id: 'wait',
        type: 'WAIT',
        config: { waitType: 'dependency', taskKey: 'produce', pollIntervalSeconds: 0.2 },
      },
    ]);
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const waitDeps: WaitTaskHandlerDeps = {
      workflowRuns: createWorkflowRunRepository(database.db),
      workflowVersions: createWorkflowVersionRepository(database.db),
      workflowTasks: createWorkflowTaskRepository(database.db),
    };
    const producedArtifactId = randomUUID();
    const queue = createPostgresTaskQueue(database.db);
    const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
    dispatcher.registerHandler('WAIT', (task) => runWaitTask(waitDeps, task));
    dispatcher.registerHandler('TASK', async () => {
      // Deliberately not instant: proves the WAIT node genuinely re-checks
      // (WAITING -> resumeReadyWaits -> re-claimed -> still not ready ->
      // WAITING again) rather than only ever passing on a first, lucky
      // check — 'produce' has no graph edge into 'wait', so both are
      // claimable immediately and the WAIT node's own first check will
      // real-world race ahead of this delay.
      await delay(300);
      return { artifactId: producedArtifactId };
    });

    dispatcher.start();

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 8000 },
    );
    await dispatcher.stop();

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    const byKey = Object.fromEntries(tasks.map((task) => [task.taskKey, task]));
    expect(byKey.produce?.status).toBe('SUCCEEDED');
    expect(byKey.wait?.status).toBe('SUCCEEDED');
    expect(byKey.wait?.output).toMatchObject({ artifactId: producedArtifactId });
  }, 15_000);
});
