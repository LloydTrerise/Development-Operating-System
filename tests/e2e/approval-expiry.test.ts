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
import { runApprovalTask, type ApprovalTaskHandlerDeps } from '@devos/application';
import {
  createApprovalRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createMembershipRepository,
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
 * DEVOS-145 — a real, already-past `expiresAt` on a `PENDING` approval is
 * transitioned to `EXPIRED` by a real dispatcher tick (`approvals.expirePending()`,
 * wired into the same periodic tick `reclaimStale()`/`resumeReadyWaits()`
 * already run on — no mocked clock, no separate timer), and a real
 * `APPROVAL` graph node blocked on it fails permanently exactly like a
 * rejection. Mirrors `approval-node.test.ts`'s own real-dispatcher harness.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-approval-expiry-test';

let database: DatabaseClient;

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Approval Expiry Test Project ${randomUUID()}`,
    slug: `approval-expiry-${randomUUID()}`,
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
    key: `approval-expiry-${randomUUID()}`,
    name: 'Approval Expiry Test Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Approval Expiry Test Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        { id: 'start', type: 'TASK', name: 'Start' },
        {
          id: 'gate',
          type: 'APPROVAL',
          config: { approvalType: 'EXPIRY_GATE', pollIntervalSeconds: 0.2 },
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
    title: 'Approval expiry test work item',
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

function startDispatcher() {
  const approvalDeps: ApprovalTaskHandlerDeps = {
    workflowRuns: createWorkflowRunRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    approvals: createApprovalRepository(database.db),
  };
  const queue = createPostgresTaskQueue(database.db);
  // DEVOS-145: the real, new `approvals` option — the same periodic tick
  // that already reclaims stale tasks now also expires past-due approvals.
  const dispatcher = createTaskDispatcher(queue, {
    pollIntervalMs: 20,
    reclaimIntervalMs: 100,
    approvals: createApprovalRepository(database.db),
  });
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

describe('DEVOS-145: real approval expiry', () => {
  it('transitions a real PENDING approval with an already-past expiresAt to EXPIRED via a real dispatcher tick, failing its gated branch', async () => {
    const project = await createProjectFixture();
    const version = await createApprovalWorkflowVersion(project);
    const workItem = await createWorkItemFixture(project);
    const run = await startRunFixture(project, version, workItem);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(run.id, 'EXPIRY_GATE:gate');
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 5000 },
    );
    expect(pending.status).toBe('PENDING');

    // A real, already-past expiry — the next real dispatcher tick (not a
    // mocked clock) must pick this up on its own.
    await database.db
      .updateTable('approvals')
      .set({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .where('id', '=', pending.id)
      .execute();

    await vi.waitFor(
      async () => {
        const found = await approvals.getById(pending.id);
        expect(found?.status).toBe('EXPIRED');
      },
      { timeout: 5000 },
    );

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

  it('never expires a PENDING approval with no expiresAt set (existing behaviour unaffected)', async () => {
    const project = await createProjectFixture();
    const version = await createApprovalWorkflowVersion(project);
    const workItem = await createWorkItemFixture(project);
    const run = await startRunFixture(project, version, workItem);

    const dispatcher = startDispatcher();
    const approvals = createApprovalRepository(database.db);

    const pending = await vi.waitFor(
      async () => {
        const found = await approvals.getPendingForRunAndType(run.id, 'EXPIRY_GATE:gate');
        expect(found).not.toBeNull();
        return found!;
      },
      { timeout: 5000 },
    );
    expect(pending.expiresAt).toBeUndefined();

    // Give the dispatcher's real periodic tick several real chances to run.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const stillPending = await approvals.getById(pending.id);
    expect(stillPending?.status).toBe('PENDING');

    await dispatcher.stop();
  }, 15_000);
});
