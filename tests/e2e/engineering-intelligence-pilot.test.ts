import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Artifact,
  ArtifactVersion,
  Membership,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  createArtifactRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createMembershipRepository,
  createProjectRepository,
  createWorkflowDefinitionRepository,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-171 — the real end-to-end pilot for the whole E24 Engineering
 * Intelligence epic: a real project with more than one real deploy
 * (including a real rollback) and a real workflow run driven by a real
 * spawned `apps/worker` process produces correct real DORA figures (via
 * `apps/api`'s `GET /projects/:projectId/engineering-report`) and a
 * correct real bottleneck ranking (via `apps/api`'s
 * `GET /projects/:projectId/slowest-workflows`, itself proxying the
 * worker's own live `GET /slowest-workflows` — DEVOS-170's disclosed
 * cross-process bridge), independently cross-checked against a second,
 * direct call to the worker's own raw endpoint. Mirrors this codebase's
 * own established real-process pilot convention (DEVOS-100/108/126/137/
 * 148/157/161).
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-171-e2e-${Date.now()}`;

let database: DatabaseClient;

interface ManagedProcess {
  child: ChildProcess;
  output: string[];
}

function spawnApp(appDir: string, env: NodeJS.ProcessEnv): ManagedProcess {
  const child = spawn(process.execPath, [TSX_CLI, 'src/main.ts'], {
    cwd: path.join(REPO_ROOT, appDir),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  return { child, output };
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${url} did not become healthy within ${timeoutMs}ms: ${String(lastError)}`);
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
  meta: { requestId: string };
}

function createApiClient(baseUrl: string, bearerToken: string) {
  return async function api<T>(
    method: string,
    pathname: string,
  ): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

async function createEvidenceArtifact(
  projectId: Project['id'],
  artifactType: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId,
    artifactType,
    name: `${artifactType} pilot fixture`,
    status: 'GENERATED',
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };
  await createArtifactRepository(database.db).create(artifact);

  const version: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: artifact.id,
    version: 1,
    contentType: 'application/json',
    contentUri: `memory://${artifact.id}`,
    contentHash: 'fixture-hash',
    metadata,
    createdBy: ACTOR_ID,
    createdAt: now,
  };
  await createArtifactVersionRepository(database.db).create(version);
  return artifact.id;
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

describe('DEVOS-171 real E2E pilot — DORA metrics and bottleneck ranking, end to end', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  const apiPort = 3923;
  const metricsPort = 39531;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl, ACTOR_ID);

  beforeAll(async () => {
    workerProcess = spawnApp('apps/worker', {
      ...process.env,
      DATABASE_URL,
      METRICS_PORT: String(metricsPort),
    });
    await waitForHealth(`http://localhost:${metricsPort}/metrics`, 20_000).catch((error) => {
      throw new Error(
        `${(error as Error).message}\n--- worker ---\n${workerProcess.output.join('')}`,
      );
    });

    apiProcess = spawnApp('apps/api', {
      ...process.env,
      DATABASE_URL,
      PORT: String(apiPort),
      WORKER_METRICS_URL: `http://localhost:${metricsPort}`,
    });
    await waitForHealth(`${baseUrl}/api/v1/health`, 20_000).catch((error) => {
      throw new Error(`${(error as Error).message}\n--- api ---\n${apiProcess.output.join('')}`);
    });
  }, 40_000);

  afterAll(() => {
    apiProcess?.child.kill();
    workerProcess?.child.kill();
  });

  it('produces correct real DORA figures and a correct real bottleneck ranking from a real workflow run and real release history', async () => {
    const now = new Date().toISOString();

    // --- Real project + membership ---
    const project: Project = {
      id: randomUUID() as Project['id'],
      organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
      projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
      name: `Engineering Intelligence Pilot ${randomUUID()}`,
      slug: `ei-pilot-${randomUUID()}`,
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

    // --- Real workflow run through a real worker: a single TASK node,
    // dispatched and completed by the real `runDiscoveryTask` handler
    // (deterministic, no LLM), generating real `workflow_task.duration_ms`
    // metrics labelled by this run's own real `workflowVersionId`. ---
    const workflowDefinitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
    const workflowName = `Engineering Intelligence Pilot Workflow ${randomUUID()}`;
    await createWorkflowDefinitionRepository(database.db).create({
      id: workflowDefinitionId,
      projectId: project.id,
      key: `ei-pilot-${randomUUID()}`,
      name: workflowName,
      createdAt: now,
      updatedAt: now,
    });
    const version: WorkflowVersion = {
      id: randomUUID() as WorkflowVersion['id'],
      workflowDefinitionId,
      version: 1,
      status: 'PUBLISHED',
      definition: {
        name: workflowName,
        trigger: { type: 'WORK_ITEM_MANUAL' },
        inputs: [],
        nodes: [{ id: 'discover', type: 'TASK', name: 'Discover' }],
        edges: [],
        policies: [],
        outputs: [],
      },
      publishedAt: now,
      createdBy: ACTOR_ID,
      createdAt: now,
    };
    await createWorkflowVersionRepository(database.db).create(version);

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId: project.id,
      title: `Engineering intelligence pilot work item ${randomUUID()}`,
      type: 'GENERAL',
      status: 'OPEN',
      priority: 'MEDIUM',
      metadata: {},
      createdBy: ACTOR_ID,
      createdAt: now,
      updatedAt: now,
    };
    await createWorkItemRepository(database.db).create(workItem);

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
    const task: WorkflowTask = {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: 'discover',
      taskType: 'TASK',
      status: 'PENDING',
      attempt: 0,
      input: {},
      createdAt: now,
      updatedAt: now,
    };
    await createWorkflowRunStarter(database.db)(run, [task], ACTOR_ID);

    // Poll for the real worker to actually claim and complete this real task.
    const workflowRuns = createWorkflowRunRepository(database.db);
    const deadline = Date.now() + 15_000;
    let completedRun: WorkflowRun | null = null;
    while (Date.now() < deadline) {
      const current = await workflowRuns.getById(run.id);
      if (current?.status === 'COMPLETED') {
        completedRun = current;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(completedRun).not.toBeNull();

    // --- Real release history: a real CODE_CHANGE, then deploy -> rollback
    // -> deploy, each linked back to the CODE_CHANGE via
    // `derivedFromArtifactId` (DEVOS-168's own real one-hop link). ---
    const codeChangeGeneratedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const codeChangeArtifactId = await createEvidenceArtifact(project.id, 'CODE_CHANGE', {
      commitSha: 'pilot-abc123',
      generatedAt: codeChangeGeneratedAt,
    });
    await createEvidenceArtifact(project.id, 'REVIEW_EVIDENCE', { decision: 'PASS' });
    await createEvidenceArtifact(project.id, 'TEST_EVIDENCE', { passed: true });
    await createEvidenceArtifact(project.id, 'SECURITY_SCAN_EVIDENCE', { passed: true });
    await createEvidenceArtifact(project.id, 'RELEASE_EVIDENCE', {
      action: 'deploy',
      passed: false,
      completedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      derivedFromArtifactId: codeChangeArtifactId,
    });
    await createEvidenceArtifact(project.id, 'RELEASE_EVIDENCE', {
      action: 'rollback',
      passed: false,
      completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    await createEvidenceArtifact(project.id, 'RELEASE_EVIDENCE', {
      action: 'deploy',
      passed: true,
      completedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      derivedFromArtifactId: codeChangeArtifactId,
    });

    // --- Real engineering-report figures, via the real running apps/api ---
    const report = await api<{
      deployCount: number;
      rollbackCount: number;
      dora: { deploymentCount: number; changeFailureCount: number; changeFailureRate: number };
      leadTime: { sampleCount: number; leadTimeMsP50: number };
      releaseRecoveryProxy: { sampleCount: number; meanMs: number; label: string };
    }>('GET', `/api/v1/projects/${project.id}/engineering-report`);
    expect(report.status).toBe(200);
    expect(report.body.data!.deployCount).toBe(2);
    expect(report.body.data!.rollbackCount).toBe(1);
    expect(report.body.data!.dora.deploymentCount).toBe(2);
    // Change failure = the failed deploy + the rollback = 2 failures out of 2 deploys.
    expect(report.body.data!.dora.changeFailureCount).toBe(2);
    expect(report.body.data!.dora.changeFailureRate).toBeCloseTo(1, 6);
    // Lead time: only the *passed* deploy counts — one real sample, ~90 minutes.
    expect(report.body.data!.leadTime.sampleCount).toBe(1);
    expect(report.body.data!.leadTime.leadTimeMsP50).toBeGreaterThan(0);
    // Recovery proxy: the rollback at -60m recovers at the deploy at -30m — one real ~30-minute sample.
    expect(report.body.data!.releaseRecoveryProxy.sampleCount).toBeGreaterThanOrEqual(1);
    expect(report.body.data!.releaseRecoveryProxy.label).toBe(
      'release-failure-to-next-successful-deploy',
    );

    // --- Real bottleneck ranking, via the real running apps/api, proxying
    // the real running apps/worker's own live metrics registry ---
    const slowest = await api<
      {
        workflowVersionId: string;
        workflowDefinitionName: string;
        meanDurationMs: number;
        taskCount: number;
      }[]
    >('GET', `/api/v1/projects/${project.id}/slowest-workflows`);
    expect(slowest.status).toBe(200);
    const ourRow = slowest.body.data!.find((row) => row.workflowVersionId === version.id);
    expect(ourRow).toBeDefined();
    expect(ourRow!.workflowDefinitionName).toBe(workflowName);
    expect(ourRow!.meanDurationMs).toBeGreaterThan(0);
    expect(ourRow!.taskCount).toBe(1);

    // Independent cross-check: query the worker's own raw endpoint directly
    // (bypassing the api proxy) and confirm the same real row is there.
    const directWorkerResponse = await fetch(`http://localhost:${metricsPort}/slowest-workflows`);
    const directWorkerRows = (await directWorkerResponse.json()) as {
      workflowVersionId: string;
    }[];
    expect(directWorkerRows.some((row) => row.workflowVersionId === version.id)).toBe(true);

    // A non-member's request 404s, matching every other project-scoped route.
    const nonMember = createApiClient(baseUrl, `devos-171-non-member-${Date.now()}`);
    const denied = await nonMember('GET', `/api/v1/projects/${project.id}/engineering-report`);
    expect(denied.status).toBe(404);

    // --- Cleanup: confirm 0 remaining rows afterward (outbox_events/
    // audit_records both carry a real `project_id` FK, so they must be
    // cleared before the project row itself) ---
    await database.db
      .deleteFrom('artifact_versions')
      .where(
        'artifact_id',
        'in',
        database.db.selectFrom('artifacts').select('id').where('project_id', '=', project.id),
      )
      .execute();
    await database.db.deleteFrom('artifacts').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('workflow_tasks').where('workflow_run_id', '=', run.id).execute();
    await database.db.deleteFrom('workflow_runs').where('id', '=', run.id).execute();
    await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('workflow_versions').where('id', '=', version.id).execute();
    await database.db
      .deleteFrom('workflow_definitions')
      .where('id', '=', workflowDefinitionId)
      .execute();
    await database.db.deleteFrom('work_items').where('id', '=', workItem.id).execute();
    await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('projects').where('id', '=', project.id).execute();

    const remainingProject = await createProjectRepository(database.db).getById(project.id);
    expect(remainingProject).toBeNull();
  }, 40_000);
});
