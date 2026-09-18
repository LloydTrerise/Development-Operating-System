import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Project, WorkflowRun, WorkflowTask, WorkflowVersion, WorkItem } from '@devos/domain';
import {
  createArtifactRepository,
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
import { runConditionTask, runJoinTask, type ConditionTaskHandlerDeps } from '@devos/application';
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-123 — real Postgres proof that `SKIPPED` propagates however many
 * hops deep, not just the one hop DEVOS-119's own `skipTaskKeys` covers, and
 * that a tolerant `JOIN` (DEVOS-120) whose own dependency chain runs through
 * such a cascade does not wait forever. Both branches of the `CONDITION`
 * below have their own two-hop chain feeding the same tolerant `JOIN` — the
 * untaken side's second hop (`yesHop2`/`noHop2`) has no direct relationship
 * to the `CONDITION` at all, only to its own immediate (directly-skipped)
 * predecessor, so it can only ever reach `SKIPPED` via DEVOS-123's real
 * transitive-closure cascade (`cascadeSkippedTasks`,
 * `packages/database/src/repositories/task-queue.ts`), not DEVOS-119's own
 * one-hop mechanism. The `JOIN` becoming eligible, and `after` (which
 * depends only on the `JOIN`'s own output) actually running, is what proves
 * the cascade unblocked it rather than leaving it stuck `PENDING` forever.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-skip-cascade-node-test';

let database: DatabaseClient;
let project: Project;

async function createSkipCascadeWorkflowVersion(): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `skip-cascade-${randomUUID()}`,
    name: 'Skip Cascade Node Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Skip Cascade Node Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        {
          id: 'route',
          type: 'CONDITION',
          config: {
            rule: { source: 'variable', path: 'flag', operator: 'equals', value: true },
            whenTrue: 'yes',
            whenFalse: 'no',
          },
        },
        { id: 'yesPath', type: 'TASK', name: 'Yes path' },
        { id: 'yesHop2', type: 'TASK', name: 'Yes path, two hops from route' },
        { id: 'noPath', type: 'TASK', name: 'No path' },
        { id: 'noHop2', type: 'TASK', name: 'No path, two hops from route' },
        { id: 'join', type: 'JOIN', config: { branchFailurePolicy: 'tolerant' } },
        { id: 'after', type: 'TASK', name: 'After the join' },
      ],
      edges: [
        { from: 'route', to: 'yesPath', branch: 'yes' },
        { from: 'route', to: 'noPath', branch: 'no' },
        { from: 'yesPath', to: 'yesHop2' },
        { from: 'noPath', to: 'noHop2' },
        { from: 'yesHop2', to: 'join' },
        { from: 'noHop2', to: 'join' },
        { from: 'join', to: 'after' },
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
    title: 'Skip cascade node test work item',
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

// Mirrors condition-node.test.ts/parallel-join-node.test.ts's own identical
// helper: this test talks to @devos/database directly, so it computes each
// task's own dependsOn/dependsOnTerminalOnly by hand from the graph's
// declared edges exactly the way run-creation.ts does.
async function startRunFixture(
  version: WorkflowVersion,
  workItem: WorkItem,
  input: Record<string, unknown>,
): Promise<WorkflowRun> {
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: version.id,
    workItemId: workItem.id,
    status: 'PENDING',
    input,
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

function startDispatcher() {
  const conditionDeps: ConditionTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    artifacts: createArtifactRepository(database.db),
  };
  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20 });
  dispatcher.registerHandler('CONDITION', (task) => runConditionTask(conditionDeps, task));
  dispatcher.registerHandler('JOIN', () => runJoinTask());
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
    name: `Skip Cascade Node Test Project ${Date.now()}`,
    slug: `skip-cascade-node-${Date.now()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('DEVOS-123: SKIPPED cascades transitively, unblocking a tolerant JOIN behind it', () => {
  it('cascades SKIPPED two hops down the untaken (no) branch and completes through the tolerant join', async () => {
    const version = await createSkipCascadeWorkflowVersion();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem, { flag: true });

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
    expect(byKey.route?.status).toBe('SUCCEEDED');
    expect(byKey.yesPath?.status).toBe('SUCCEEDED');
    expect(byKey.yesHop2?.status).toBe('SUCCEEDED');
    // noPath is DEVOS-119's own one-hop skip; noHop2 has no direct
    // relationship to route at all — only DEVOS-123's cascade can resolve
    // it, since its own dependsOn names only noPath.
    expect(byKey.noPath?.status).toBe('SKIPPED');
    expect(byKey.noHop2?.status).toBe('SKIPPED');
    // The tolerant join's own dependsOn names yesHop2 (SUCCEEDED) and
    // noHop2 (SKIPPED, only true because of the cascade above) — if the
    // cascade hadn't run, noHop2 would still be PENDING and the join, and
    // everything after it, would never become eligible.
    expect(byKey.join?.status).toBe('SUCCEEDED');
    expect(byKey.after?.status).toBe('SUCCEEDED');
  }, 15_000);

  it('cascades SKIPPED two hops down the untaken (yes) branch and completes through the tolerant join', async () => {
    const version = await createSkipCascadeWorkflowVersion();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem, { flag: false });

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
    expect(byKey.route?.status).toBe('SUCCEEDED');
    expect(byKey.noPath?.status).toBe('SUCCEEDED');
    expect(byKey.noHop2?.status).toBe('SUCCEEDED');
    expect(byKey.yesPath?.status).toBe('SKIPPED');
    expect(byKey.yesHop2?.status).toBe('SKIPPED');
    expect(byKey.join?.status).toBe('SUCCEEDED');
    expect(byKey.after?.status).toBe('SUCCEEDED');
  }, 15_000);
});
