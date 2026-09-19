import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentExecution,
  AgentVersion,
  Membership,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  createAgentExecutionRepository,
  createAgentRepository,
  createAgentVersionRepository,
  createDatabaseClient,
  createMembershipRepository,
  createProjectRepository,
  createWorkflowDefinitionRepository,
  createWorkflowRunStarter,
  createWorkItemRepository,
  createWorkflowVersionRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-150/DEVOS-151 — real, end-to-end verification that the new
 * organisation-spanning cost rollup/breakdown queries (DEVOS-150) and the
 * new `GET /projects/:projectId/cost` / `GET /organisations/:organisationId/cost-report`
 * routes (DEVOS-151) return correct, real data: two real projects in the
 * same seeded organisation, each with real completed `agent_executions`
 * across two different agent roles, summed and broken down correctly both
 * at the project scope and across the organisation. Mirrors
 * `audit-coverage.test.ts`'s real-spawned-`apps/api` harness.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-150-151-e2e-${Date.now()}`;

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

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`API did not become healthy within ${timeoutMs}ms: ${String(lastError)}`);
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

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Cost Reporting Test Project ${randomUUID()}`,
    slug: `cost-reporting-${randomUUID()}`,
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

async function createAgentFixture(project: Project, role: string): Promise<AgentVersion> {
  const now = new Date().toISOString();
  const agent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId: project.id,
    key: `cost-test-${role}-${randomUUID()}`,
    name: `Cost test ${role} agent`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createAgentRepository(database.db).create(agent);

  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: agent.id,
    version: 1,
    status: 'PUBLISHED',
    configuration: {
      role,
      provider: 'gemini',
      modelRef: 'gemini-3.6-flash',
      allowedCapabilities: [],
    },
    createdBy: ACTOR_ID,
    publishedAt: now,
    createdAt: now,
  };
  await createAgentVersionRepository(database.db).create(version);
  return version;
}

interface RunAndTaskFixture {
  task: WorkflowTask;
  workflowName: string;
  workItemTitle: string;
}

async function createRunAndTaskFixture(
  project: Project,
  label: string,
): Promise<RunAndTaskFixture> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  const workflowName = `Cost Reporting Test Workflow ${label} ${randomUUID()}`;
  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `cost-reporting-${randomUUID()}`,
    name: workflowName,
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: workflowName,
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'work', type: 'AGENT_TASK', name: 'Work' }],
      edges: [],
      policies: [],
      outputs: [],
    },
    publishedAt: now,
    createdBy: ACTOR_ID,
    createdAt: now,
  };
  await createWorkflowVersionRepository(database.db).create(version);

  const workItemTitle = `Cost reporting test work item ${label} ${randomUUID()}`;
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: workItemTitle,
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
    taskKey: 'work',
    taskType: 'AGENT_TASK',
    status: 'PENDING',
    attempt: 0,
    input: {},
    createdAt: now,
    updatedAt: now,
  };
  await createWorkflowRunStarter(database.db)(run, [task], ACTOR_ID);
  return { task, workflowName, workItemTitle };
}

async function createCompletedExecution(
  task: WorkflowTask,
  version: AgentVersion,
  estimatedCostUsd: number,
): Promise<void> {
  const now = new Date().toISOString();
  const execution: AgentExecution = {
    id: randomUUID() as AgentExecution['id'],
    workflowTaskId: task.id,
    agentVersionId: version.id,
    status: 'SUCCEEDED',
    input: {},
    output: {},
    modelReference: 'gemini-3.6-flash',
    usage: { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 },
    estimatedCostUsd,
    startedAt: now,
    completedAt: now,
    createdAt: now,
  };
  await createAgentExecutionRepository(database.db).create(execution);
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

describe('DEVOS-150/151 real E2E — organisation cost rollup, breakdown, and the new cost API routes', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3921;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl, ACTOR_ID);

  beforeAll(async () => {
    apiProcess = spawnApp('apps/api', { ...process.env, DATABASE_URL, PORT: String(apiPort) });
    try {
      await waitForHealth(baseUrl, 20_000);
    } catch (error) {
      throw new Error(`${(error as Error).message}\n--- api ---\n${apiProcess.output.join('')}`, {
        cause: error,
      });
    }
  }, 30_000);

  afterAll(() => {
    apiProcess?.child.kill();
  });

  it('sums and breaks down real cost correctly at project and organisation scope, via real Postgres and the real new routes', async () => {
    const projectA = await createProjectFixture();
    const projectB = await createProjectFixture();

    const plannerVersion = await createAgentFixture(projectA, 'PLANNER');
    const developerVersionA = await createAgentFixture(projectA, 'DEVELOPER');
    const developerVersionB = await createAgentFixture(projectB, 'DEVELOPER');

    const fixtureA1 = await createRunAndTaskFixture(projectA, 'A1');
    const fixtureA2 = await createRunAndTaskFixture(projectA, 'A2');
    const fixtureB1 = await createRunAndTaskFixture(projectB, 'B1');

    await createCompletedExecution(fixtureA1.task, plannerVersion, 1.5);
    await createCompletedExecution(fixtureA2.task, developerVersionA, 2.5);
    await createCompletedExecution(fixtureB1.task, developerVersionB, 4.0);

    // Project A: real per-role breakdown, real total.
    const projectACost = await api<{
      totalUsd: number;
      breakdownByRole: { key: string; totalUsd: number }[];
      breakdownByWorkflow: { key: string; totalUsd: number }[];
      breakdownByWorkItem: { key: string; totalUsd: number }[];
    }>('GET', `/api/v1/projects/${projectA.id}/cost`);
    expect(projectACost.status).toBe(200);
    expect(projectACost.body.data!.totalUsd).toBeCloseTo(4.0, 6);
    const rolesA = Object.fromEntries(
      projectACost.body.data!.breakdownByRole.map((row) => [row.key, row.totalUsd]),
    );
    expect(rolesA.PLANNER).toBeCloseTo(1.5, 6);
    expect(rolesA.DEVELOPER).toBeCloseTo(2.5, 6);

    // DEVOS-156: real attribution by workflow and by work item — project A
    // spans two distinct workflow definitions and two distinct work items,
    // each carrying only its own real cost.
    const workflowsA = Object.fromEntries(
      projectACost.body.data!.breakdownByWorkflow.map((row) => [row.key, row.totalUsd]),
    );
    expect(workflowsA[fixtureA1.workflowName]).toBeCloseTo(1.5, 6);
    expect(workflowsA[fixtureA2.workflowName]).toBeCloseTo(2.5, 6);
    const workItemsA = Object.fromEntries(
      projectACost.body.data!.breakdownByWorkItem.map((row) => [row.key, row.totalUsd]),
    );
    expect(workItemsA[fixtureA1.workItemTitle]).toBeCloseTo(1.5, 6);
    expect(workItemsA[fixtureA2.workItemTitle]).toBeCloseTo(2.5, 6);

    // Project B: independent from project A.
    const projectBCost = await api<{ totalUsd: number }>(
      'GET',
      `/api/v1/projects/${projectB.id}/cost`,
    );
    expect(projectBCost.status).toBe(200);
    expect(projectBCost.body.data!.totalUsd).toBeCloseTo(4.0, 6);

    // Organisation: real rollup spanning both real projects (DEVOS-150's
    // own real-join precedent, not a client-side loop).
    const orgCost = await api<{
      totalUsd: number;
      projectCount: number;
      breakdownByRole: { key: string; totalUsd: number }[];
    }>('GET', `/api/v1/organisations/${SEED_ORGANISATION_ID}/cost-report`);
    expect(orgCost.status).toBe(200);
    expect(orgCost.body.data!.totalUsd).toBeGreaterThanOrEqual(8.0);
    const rolesOrg = Object.fromEntries(
      orgCost.body.data!.breakdownByRole.map((row) => [row.key, row.totalUsd]),
    );
    expect(rolesOrg.DEVELOPER).toBeGreaterThanOrEqual(6.5);
    expect(rolesOrg.PLANNER).toBeGreaterThanOrEqual(1.5);

    // A non-member's request to either new route 404s, matching every
    // other project/organisation-scoped route's own established convention.
    const nonMember = createApiClient(baseUrl, `devos-150-151-non-member-${Date.now()}`);
    const denied = await nonMember('GET', `/api/v1/projects/${projectA.id}/cost`);
    expect(denied.status).toBe(404);
  }, 30_000);
});
