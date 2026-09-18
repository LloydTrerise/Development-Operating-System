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
import { createTaskDispatcher } from '@devos/worker';

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
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
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
      await queue.complete(task.id, task.attempt, {});
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

    await queue.complete(reClaimed!.id, reClaimed!.attempt, {});
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

/**
 * DEVOS-092 — extends DEVOS-024's own coverage (above) with two genuinely
 * new operational-recovery scenarios, using the real `TaskDispatcher`
 * (`@devos/worker`), not just `TaskQueue` primitives directly:
 *
 *  - a worker crashing mid-task (never calling complete()/fail()) has its
 *    task recovered and finished by a second, independent worker instance,
 *    through each dispatcher's own real, timer-driven reclaim loop — not a
 *    manually-invoked reclaimStale() call, the way DEVOS-024's own restart-
 *    safety test exercises the queue primitive in isolation.
 *  - a transient failure at the queue level itself (simulating a dropped DB
 *    connection) does not permanently wedge the dispatch loop.
 */
describe('DEVOS-092: operational recovery — real TaskDispatcher instances', () => {
  it('recovers a task from a worker that crashes mid-task, completed by a second worker', async () => {
    const version = await createPublishedTwoNodeWorkflow();
    version.definition.nodes.length = 1;
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const queue = createPostgresTaskQueue(database.db);

    // "Worker A" claims the task via a handler that never resolves —
    // indistinguishable, from the queue's perspective, from a process that
    // crashed while holding it: the task stays RUNNING, complete()/fail()
    // is never called, and workerA is simply abandoned afterward (real
    // crash recovery never gets a graceful stop() call either).
    const workerA = createTaskDispatcher(queue, {
      pollIntervalMs: 20,
      staleThresholdMs: 200,
      reclaimIntervalMs: 100_000,
    });
    workerA.registerHandler('TASK', () => new Promise(() => {}));
    workerA.start();

    await vi.waitFor(async () => {
      const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
      expect(tasks[0]?.status).toBe('RUNNING');
    });

    // "Worker B" — a second, independent dispatcher instance pointed at the
    // same real queue, with a short reclaim interval so it recovers the
    // task on its own real timer, not via a manual reclaimStale() call.
    const workerB = createTaskDispatcher(queue, {
      pollIntervalMs: 20,
      staleThresholdMs: 200,
      reclaimIntervalMs: 50,
    });
    workerB.registerHandler('TASK', async () => ({ recoveredBy: 'workerB' }));
    workerB.start();

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 5000 },
    );

    const tasks = await createWorkflowTaskRepository(database.db).listForRun(run.id);
    expect(tasks[0]?.status).toBe('SUCCEEDED');
    // Reclaimed at least once (attempt incremented past workerA's original claim).
    expect(tasks[0]?.attempt).toBeGreaterThanOrEqual(2);

    await workerB.stop();
    // workerA is intentionally never stopped — it is standing in for a
    // crashed process; nothing calls stop() on a real one either.
  }, 15_000);

  it('survives a transient queue-level failure without ever wedging the dispatch loop', async () => {
    const version = await createPublishedTwoNodeWorkflow();
    version.definition.nodes.length = 1;
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);

    const realQueue = createPostgresTaskQueue(database.db);
    let claimAttempts = 0;
    // Wraps the real queue, injecting exactly one transient failure into
    // the first claimNext() call — simulating a dropped DB connection —
    // then behaving normally. Real Postgres underneath throughout.
    const flakyQueue: ReturnType<typeof createPostgresTaskQueue> = {
      ...realQueue,
      claimNext: async () => {
        claimAttempts += 1;
        if (claimAttempts === 1) throw new Error('connection terminated unexpectedly');
        return realQueue.claimNext();
      },
    };

    const worker = createTaskDispatcher(flakyQueue, { pollIntervalMs: 20 });
    worker.registerHandler('TASK', async () => ({}));
    worker.start();

    await vi.waitFor(
      async () => {
        const runAfter = await createWorkflowRunRepository(database.db).getById(run.id);
        expect(runAfter?.status).toBe('COMPLETED');
      },
      { timeout: 5000 },
    );

    await worker.stop();
    expect(claimAttempts).toBeGreaterThanOrEqual(2);
  }, 15_000);
});

/**
 * DEVOS-094 — reproduces the exact race `reclaimStale()`'s pure
 * started_at-based staleness check creates: worker A claims a task and
 * keeps genuinely working on it past `staleThresholdMs` (a slow build, a
 * slow real model call — not a crash); a restarted worker reclaims it as
 * stale and completes it under a new attempt; A, unaware, eventually
 * finishes its own (superseded) attempt and calls complete()/fail() late.
 * Before DEVOS-094, that late call updated the row by id alone and would
 * have silently overwritten worker B's real outcome. `complete()`/`fail()`
 * now take the caller's believed attempt as a fencing token and only apply
 * if the row is still RUNNING under that exact attempt — proven here
 * against real Postgres, not simulated.
 */
describe('DEVOS-094: completion fencing against a stale reclaim', () => {
  it("ignores worker A's late complete() after worker B has already completed the reclaimed task", async () => {
    const version = await createPublishedTwoNodeWorkflow();
    version.definition.nodes.length = 1;
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem);
    const queue = createPostgresTaskQueue(database.db);

    // Worker A claims the task (attempt 1) and is genuinely still "working"
    // — no crash, just slow.
    const claimedByA = await queue.claimNext();
    expect(claimedByA).not.toBeNull();
    expect(claimedByA?.attempt).toBe(1);

    // A restarted worker's reclaim pass judges A's task stale purely by
    // elapsed time (threshold 0 => immediately stale) and resets it to
    // PENDING, exactly as reclaimStale() does in production when a
    // genuinely-alive worker merely runs long.
    const reclaimedCount = await queue.reclaimStale(0);
    expect(reclaimedCount).toBe(1);

    // Worker B claims the same task (attempt 2) and finishes it first.
    const claimedByB = await queue.claimNext();
    expect(claimedByB).not.toBeNull();
    expect(claimedByB?.id).toBe(claimedByA!.id);
    expect(claimedByB?.attempt).toBe(2);
    await queue.complete(claimedByB!.id, claimedByB!.attempt, { completedBy: 'workerB' });

    const afterB = await createWorkflowTaskRepository(database.db).getById(claimedByA!.id);
    expect(afterB?.status).toBe('SUCCEEDED');
    expect(afterB?.output).toEqual({ completedBy: 'workerB' });
    const runAfterB = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runAfterB?.status).toBe('COMPLETED');

    // Worker A, unaware it was ever reclaimed, now finishes its own
    // (superseded) attempt-1 work and calls complete() late. Fenced by
    // attempt, this must be a safe no-op: it must not resurrect/overwrite
    // worker B's already-recorded outcome or the run's completed status.
    await queue.complete(claimedByA!.id, claimedByA!.attempt, { completedBy: 'workerA-late' });

    const afterLateA = await createWorkflowTaskRepository(database.db).getById(claimedByA!.id);
    expect(afterLateA?.status).toBe('SUCCEEDED');
    expect(afterLateA?.output).toEqual({ completedBy: 'workerB' });
    expect(afterLateA?.attempt).toBe(2);
    const runAfterLateA = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runAfterLateA?.status).toBe('COMPLETED');

    // Worker A's late fail() must be equally fenced and equally inert.
    await queue.fail(
      claimedByA!.id,
      claimedByA!.attempt,
      { message: 'workerA-late-failure' },
      true,
    );

    const afterLateFailA = await createWorkflowTaskRepository(database.db).getById(claimedByA!.id);
    expect(afterLateFailA?.status).toBe('SUCCEEDED');
    expect(afterLateFailA?.output).toEqual({ completedBy: 'workerB' });
  });
});

/**
 * DEVOS-108-followup: `claimNext()` previously had no way to know a task
 * depends on another's real output — every node's task was created as
 * independently claimable at run-start (DEVOS-096's own already-recorded
 * gap), relying only on a one-millisecond `createdAt` offset per node as an
 * *ordering hint* for a single sequential claimer. Live-verified during
 * DEVOS-108's own real pilot run to be a real, reproducible race once more
 * than one claimer is polling the same real Postgres queue at once (a
 * genuine multi-instance production deployment's normal operating mode, not
 * just a test artifact) — a downstream task got claimed and failed before
 * its real upstream sibling had finished. `run-creation.ts` now folds each
 * node's real upstream dependencies (from the workflow graph's own declared
 * edges) into its task's `input.dependsOn`; `claimNext()` now refuses to
 * claim a task until every task named there has reached `SUCCEEDED` in the
 * same run — proven here against real Postgres with two independent
 * concurrent claimers, not a single sequential one, and with the downstream
 * task's own `createdAt` deliberately set *earlier* than its upstream's, so
 * passing this test cannot be an accident of ordering.
 */
describe('DEVOS-108-followup: real dependency ordering at claim time', () => {
  async function createTwoNodeChainRun(
    downstreamDependsOn: string[],
    downstreamCreatedAtOffsetMs: number,
  ): Promise<{ run: WorkflowRun; upstreamTaskId: string; downstreamTaskId: string }> {
    const version = await createPublishedTwoNodeWorkflow();
    const workItem = await createWorkItemFixture();

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
    const upstreamTaskId = randomUUID() as WorkflowTask['id'];
    const downstreamTaskId = randomUUID() as WorkflowTask['id'];
    const tasks: WorkflowTask[] = [
      {
        id: upstreamTaskId,
        workflowRunId: run.id,
        taskKey: 'a',
        taskType: 'TASK',
        status: 'PENDING',
        attempt: 0,
        input: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: downstreamTaskId,
        workflowRunId: run.id,
        taskKey: 'b',
        taskType: 'TASK',
        status: 'PENDING',
        attempt: 0,
        input: downstreamDependsOn.length > 0 ? { dependsOn: downstreamDependsOn } : {},
        // Deliberately earlier than the upstream task's own createdAt (not
        // just equal) — if claimNext() were still only using createdAt
        // ordering, this would make the "downstream" task the *first*
        // candidate claimed, not the last.
        createdAt: new Date(Date.parse(now) + downstreamCreatedAtOffsetMs).toISOString(),
        updatedAt: now,
      },
    ];
    await createWorkflowRunStarter(database.db)(run, tasks, ACTOR_ID);
    return { run, upstreamTaskId, downstreamTaskId };
  }

  /**
   * `claimNext()` is deliberately global, not run-scoped (matching
   * production, and this file's own "duplicate delivery" test's precedent
   * above) — this real Postgres database is shared with whatever other e2e
   * test file's own spawned worker process is concurrently polling the same
   * queue. Claims and completes (a harmless no-op for whatever unrelated
   * task it turns out to be) up to `maxAttempts` times looking for
   * `targetTaskId` specifically, so these tests assert the real property
   * under test — not "the very next global claim", which shared-queue noise
   * could make flaky in either direction.
   */
  async function claimSpecific(
    queue: ReturnType<typeof createPostgresTaskQueue>,
    targetTaskId: string,
    maxAttempts: number,
  ): Promise<WorkflowTask | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const claimed = await queue.claimNext();
      if (!claimed) return null;
      if (claimed.id === targetTaskId) return claimed;
      await queue.complete(claimed.id, claimed.attempt, {});
    }
    return null;
  }

  it('refuses to claim a task whose declared dependency has not yet succeeded, even when it would otherwise be claimed first by createdAt', async () => {
    const { upstreamTaskId, downstreamTaskId } = await createTwoNodeChainRun(['a'], -60_000);
    const queue = createPostgresTaskQueue(database.db);

    const first = await claimSpecific(queue, upstreamTaskId, 50);
    expect(first?.id).toBe(upstreamTaskId);
    expect(first?.taskKey).toBe('a');

    // The downstream task must not be claimable while 'a' is still
    // RUNNING — drain a bounded number of (harmless, unrelated) claims
    // from the shared queue and confirm the target id never appears among
    // them, rather than assuming the very next claim is deterministic.
    for (let i = 0; i < 30; i++) {
      const claimed = await queue.claimNext();
      if (!claimed) break;
      expect(claimed.id).not.toBe(downstreamTaskId);
      await queue.complete(claimed.id, claimed.attempt, {});
    }

    await queue.complete(first!.id, first!.attempt, {});

    const second = await claimSpecific(queue, downstreamTaskId, 50);
    expect(second?.id).toBe(downstreamTaskId);
    expect(second?.taskKey).toBe('b');

    await queue.complete(second!.id, second!.attempt, {});
  }, 30_000);

  it('claims a task with no declared dependency immediately, regardless of a sibling task existing', async () => {
    const { upstreamTaskId, downstreamTaskId } = await createTwoNodeChainRun([], 0);
    const queue = createPostgresTaskQueue(database.db);

    // No `dependsOn` was declared on either task, so both are immediately
    // claimable — unchanged behavior for every workflow that declares no
    // real dependency between its nodes. Each is found (in some order,
    // possibly interleaved with unrelated shared-queue claims) well within
    // the bounded search.
    const first = await claimSpecific(queue, upstreamTaskId, 50);
    expect(first?.id).toBe(upstreamTaskId);
    await queue.complete(first!.id, first!.attempt, {});

    const second = await claimSpecific(queue, downstreamTaskId, 50);
    expect(second?.id).toBe(downstreamTaskId);
    await queue.complete(second!.id, second!.attempt, {});
  }, 30_000);

  it('marks a still-PENDING downstream task FAILED (never attempted) once its declared upstream dependency permanently fails, instead of leaving it claimable-but-never-claimed forever', async () => {
    const { upstreamTaskId, downstreamTaskId } = await createTwoNodeChainRun(['a'], 60_000);
    const queue = createPostgresTaskQueue(database.db);

    const claimed = await claimSpecific(queue, upstreamTaskId, 50);
    expect(claimed?.id).toBe(upstreamTaskId);

    // Non-retryable: fails permanently on the very first attempt, the same
    // real path a NonRetryableTaskError (e.g. a policy denial) takes.
    await queue.fail(claimed!.id, claimed!.attempt, { message: 'permanent failure' }, false);

    const downstream = await createWorkflowTaskRepository(database.db).getById(
      downstreamTaskId as WorkflowTask['id'],
    );
    expect(downstream?.status).toBe('FAILED');
    expect(downstream?.errorCode).toBe('DEVOS_UPSTREAM_TASK_FAILED');

    const run = await createWorkflowRunRepository(database.db).getById(
      (await createWorkflowTaskRepository(database.db).getById(
        upstreamTaskId as WorkflowTask['id'],
      ))!.workflowRunId,
    );
    expect(run?.status).toBe('FAILED');

    // Never claimable — the run already failed, and it never will succeed.
    const strayClaim = await queue.claimNext();
    expect(strayClaim?.id).not.toBe(downstreamTaskId);
    // Leave no lingering RUNNING row behind for a later test, whatever
    // unrelated task this turned out to be (see "duplicate delivery"'s own
    // identical cleanup above).
    if (strayClaim) await queue.complete(strayClaim.id, strayClaim.attempt, {});
  });
});
