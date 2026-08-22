import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-024 — hardening proofs for two properties that are specific to the
 * real Postgres adapter and cannot be faithfully exercised by
 * @devos/application's in-memory-fake unit tests, or by @devos/e2e-tests'
 * black-box HTTP proof (there is no HTTP endpoint for "claim a task" — that
 * only happens inside the worker process):
 *
 *  - duplicate delivery: SELECT ... FOR UPDATE SKIP LOCKED must never let
 *    two concurrent claimNext() callers walk away with the same task.
 *  - restart safety: a task a worker claimed and then never finished
 *    (crash, kill -9) must not be stuck in RUNNING forever — reclaimStale()
 *    must recover it, respecting the same MAX_TASK_ATTEMPTS accounting as
 *    an ordinary retryable failure.
 *
 * Talks to Postgres directly through @devos/database's repositories —
 * deliberately bypassing the application layer's auth/membership
 * resolution (which is already covered by its own unit tests) and the API
 * HTTP layer, since neither is what's under test here.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-hardening-test';

let database: DatabaseClient;
let project: Project;

async function createPublishedTwoNodeWorkflow(): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `hardening-${randomUUID()}`,
    name: 'Hardening Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Hardening Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'a', type: 'TASK', name: 'A' },
        { id: 'b', type: 'TASK', name: 'B' },
      ],
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
    title: 'Hardening test work item',
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
    name: `Hardening Test Project ${Date.now()}`,
    slug: `hardening-${Date.now()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('Sprint 1 hardening: duplicate delivery', () => {
  it('never lets two concurrent claimNext() callers claim the same task', async () => {
    const version = await createPublishedTwoNodeWorkflow();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const queue = createPostgresTaskQueue(database.db);

    // 6 concurrent claimers against exactly 2 PENDING tasks (this run's,
    // plus whatever else may be sitting in the shared queue — claimNext()
    // is deliberately global, not run-scoped, matching production).
    const results = await Promise.all(Array.from({ length: 6 }, () => queue.claimNext()));

    const claimedIds = results
      .filter((task): task is WorkflowTask => task !== null)
      .map((task) => task.id);
    // The property under test: no task id is ever handed to two callers,
    // regardless of how many total tasks existed in the queue.
    expect(new Set(claimedIds).size).toBe(claimedIds.length);

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    expect(tasks.every((task) => task.status === 'RUNNING' || task.status === 'PENDING')).toBe(
      true,
    );
    expect(tasks.filter((task) => task.status === 'RUNNING')).toHaveLength(2);

    // Leave no lingering RUNNING rows behind for later tests/manual
    // inspection — claimNext() is global, so an uncompleted RUNNING task
    // here would otherwise be eligible for reclaimStale() in a later test.
    for (const task of tasks) {
      await queue.complete(task.id, {});
    }
  });
});

describe('Sprint 1 hardening: restart safety (stale task reclaim)', () => {
  it('reclaims a stale RUNNING task back to PENDING and it becomes claimable again', async () => {
    const version = await createPublishedTwoNodeWorkflow();
    // Single-node run: with two sibling PENDING tasks sharing the same
    // created_at, a later claimNext() could legitimately pick either one,
    // making "did I get MY task back" ambiguous. One task removes that.
    version.definition.nodes.length = 1;
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);
    const queue = createPostgresTaskQueue(database.db);

    const claimed = await queue.claimNext();
    expect(claimed).not.toBeNull();
    expect(claimed?.attempt).toBe(1);

    // Threshold 0 => every RUNNING task is immediately "stale", simulating
    // an arbitrarily long-dead worker without needing to sleep in the test.
    const reclaimedCount = await queue.reclaimStale(0);
    expect(reclaimedCount).toBeGreaterThanOrEqual(1);

    const reclaimedTask = await createWorkflowTaskRepository(database.db).getById(claimed!.id);
    expect(reclaimedTask?.status).toBe('PENDING');

    const reClaimed = await queue.claimNext();
    expect(reClaimed?.id).toBe(claimed!.id);
    expect(reClaimed?.attempt).toBe(2);

    await queue.complete(reClaimed!.id, {});
    const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runAfter?.status).toBe('COMPLETED');
  });

  it('reclaiming a task past MAX_TASK_ATTEMPTS marks it and its run FAILED, not stuck forever', async () => {
    const version = await createPublishedTwoNodeWorkflow();
    const workItem = await createWorkItemFixture();
    // A single-node run keeps this test's assertions about the run's
    // terminal status unambiguous (no sibling task to wait on).
    version.definition.nodes.length = 1;
    const run = await startRunFixture(version, workItem);
    const queue = createPostgresTaskQueue(database.db);

    // Simulate three consecutive crash-before-finishing cycles.
    for (let cycle = 0; cycle < 3; cycle++) {
      const task = await queue.claimNext();
      expect(task).not.toBeNull();
      await queue.reclaimStale(0);
    }

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe('FAILED');
    expect(tasks[0]?.attempt).toBe(3);

    const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runAfter?.status).toBe('FAILED');

    const audit = await database.db
      .selectFrom('audit_records')
      .select(['action', 'outcome'])
      .where('target_id', '=', run.id)
      .where('action', '=', 'workflow_run.failed')
      .execute();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.outcome).toBe('FAILURE');
  });
});
