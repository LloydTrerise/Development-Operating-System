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
import { runConditionTask, type ConditionTaskHandlerDeps } from '@devos/application';
import { createTaskDispatcher } from '@devos/worker';

/**
 * DEVOS-119 — a real `CONDITION` node run to completion against real
 * Postgres via a real `TaskDispatcher`: the taken branch's task actually
 * runs and succeeds, the untaken branch's task reaches `SKIPPED` without
 * ever being claimed, and the run still completes (`maybeCompleteRun`
 * treats `SKIPPED` as acceptable alongside `SUCCEEDED`). Mirrors
 * `hardening.test.ts`'s own real-dispatcher-against-real-Postgres harness.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-condition-node-test';

let database: DatabaseClient;
let project: Project;

async function createConditionWorkflowVersion(): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `condition-node-${randomUUID()}`,
    name: 'Condition Node Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Condition Node Test Workflow',
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
        { id: 'takenPath', type: 'TASK', name: 'Taken path' },
        { id: 'untakenPath', type: 'TASK', name: 'Untaken path' },
      ],
      edges: [
        { from: 'route', to: 'takenPath', branch: 'yes' },
        { from: 'route', to: 'untakenPath', branch: 'no' },
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
    title: 'Condition node test work item',
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

/**
 * Mirrors `run-creation.ts`'s own `dependsOn` computation (this test talks
 * to `@devos/database` directly, the same way `hardening.test.ts` does,
 * bypassing the application-layer use case) — a downstream task's
 * `input.dependsOn` names every node its own incoming edges point *from*,
 * which is what `claimNext()`'s real dependency barrier reads.
 */
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
    name: `Condition Node Test Project ${Date.now()}`,
    slug: `condition-node-${Date.now()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
}, 30_000);

afterAll(async () => {
  await database?.close();
});

describe('DEVOS-119: real CONDITION node execution', () => {
  it('runs the true branch, skips the false branch, and completes the run', async () => {
    const version = await createConditionWorkflowVersion();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem, { flag: true });

    const queue = createPostgresTaskQueue(database.db);
    const conditionDeps: ConditionTaskHandlerDeps = {
      workflowRuns: createWorkflowRunRepository(database.db),
      workflowVersions: createWorkflowVersionRepository(database.db),
      workflowTasks: createWorkflowTaskRepository(database.db),
      artifacts: createArtifactRepository(database.db),
    };
    const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20 });
    dispatcher.registerHandler('CONDITION', (task) => runConditionTask(conditionDeps, task));
    dispatcher.registerHandler('TASK', async () => ({}));
    dispatcher.start();

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
    expect(byKey.route?.output).toMatchObject({ branch: 'yes' });
    expect(byKey.takenPath?.status).toBe('SUCCEEDED');
    expect(byKey.untakenPath?.status).toBe('SKIPPED');
  }, 15_000);

  it('runs the false branch, skips the true branch, and completes the run', async () => {
    const version = await createConditionWorkflowVersion();
    const workItem = await createWorkItemFixture();
    const run = await startRunFixture(version, workItem, { flag: false });

    const queue = createPostgresTaskQueue(database.db);
    const conditionDeps: ConditionTaskHandlerDeps = {
      workflowRuns: createWorkflowRunRepository(database.db),
      workflowVersions: createWorkflowVersionRepository(database.db),
      workflowTasks: createWorkflowTaskRepository(database.db),
      artifacts: createArtifactRepository(database.db),
    };
    const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20 });
    dispatcher.registerHandler('CONDITION', (task) => runConditionTask(conditionDeps, task));
    dispatcher.registerHandler('TASK', async () => ({}));
    dispatcher.start();

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
    expect(byKey.route?.output).toMatchObject({ branch: 'no' });
    expect(byKey.takenPath?.status).toBe('SKIPPED');
    expect(byKey.untakenPath?.status).toBe('SUCCEEDED');
  }, 15_000);
});
