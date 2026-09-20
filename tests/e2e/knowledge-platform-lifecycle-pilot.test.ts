import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Membership,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
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
 * DEVOS-185 — the real end-to-end pilot for Sprint 24 (E26 Knowledge
 * Platform, part 1): a real knowledge source is authored through the real
 * API contract DEVOS-183's UI itself calls, used by a real workflow run, and
 * its use is durably, independently confirmed via a direct Postgres query —
 * then archived and confirmed excluded from the next run. Mirrors
 * `agent-platform-marketplace-pilot.test.ts`'s own established real-process
 * pilot pattern exactly.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-185-e2e-${Date.now()}`;

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
    body?: unknown,
  ): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${bearerToken}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

async function createProjectFixture(name: string): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `${name} ${randomUUID()}`,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${randomUUID()}`,
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

async function startSingleAgentTaskRun(
  project: Project,
  taskInput: Record<string, unknown>,
): Promise<{ run: WorkflowRun; task: WorkflowTask }> {
  const now = new Date().toISOString();
  const workflowDefinitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  const workflowName = `Knowledge Pilot Workflow ${randomUUID()}`;
  await createWorkflowDefinitionRepository(database.db).create({
    id: workflowDefinitionId,
    projectId: project.id,
    key: `knowledge-pilot-${randomUUID()}`,
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
      nodes: [{ id: 'discover', type: 'AGENT_TASK', name: 'Discover' }],
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
    title: 'Investigate slow query timeouts',
    description: 'Users report timeouts on the reporting endpoint.',
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
    taskType: 'AGENT_TASK',
    status: 'PENDING',
    attempt: 0,
    input: taskInput,
    createdAt: now,
    updatedAt: now,
  };
  await createWorkflowRunStarter(database.db)(run, [task], ACTOR_ID);
  return { run, task };
}

async function waitForRunCompleted(runId: WorkflowRun['id'], timeoutMs: number): Promise<void> {
  const workflowRuns = createWorkflowRunRepository(database.db);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await workflowRuns.getById(runId);
    if (current?.status === 'COMPLETED') return;
    if (current?.status === 'FAILED') {
      throw new Error(`Run ${runId} FAILED: ${current.errorMessage ?? '(no message)'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Run ${runId} did not reach COMPLETED within ${timeoutMs}ms`);
}

async function cleanupProject(project: Project, agentIds: string[] = []): Promise<void> {
  await database.db
    .deleteFrom('knowledge_references')
    .where('project_id', '=', project.id)
    .execute();
  await database.db.deleteFrom('knowledge_sources').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('context_manifests').where('project_id', '=', project.id).execute();
  await database.db
    .deleteFrom('agent_executions')
    .where(
      'workflow_task_id',
      'in',
      database.db.selectFrom('workflow_tasks').select('id').where(
        'workflow_run_id',
        'in',
        database.db.selectFrom('workflow_runs').select('id').where('project_id', '=', project.id),
      ),
    )
    .execute();
  if (agentIds.length > 0) {
    await database.db.deleteFrom('agent_versions').where('agent_id', 'in', agentIds).execute();
    await database.db.deleteFrom('agents').where('id', 'in', agentIds).execute();
  }
  await database.db
    .deleteFrom('artifact_versions')
    .where(
      'artifact_id',
      'in',
      database.db.selectFrom('artifacts').select('id').where('project_id', '=', project.id),
    )
    .execute();
  await database.db.deleteFrom('artifacts').where('project_id', '=', project.id).execute();
  await database.db
    .deleteFrom('workflow_tasks')
    .where(
      'workflow_run_id',
      'in',
      database.db.selectFrom('workflow_runs').select('id').where('project_id', '=', project.id),
    )
    .execute();
  await database.db.deleteFrom('workflow_runs').where('project_id', '=', project.id).execute();
  await database.db
    .deleteFrom('workflow_versions')
    .where(
      'workflow_definition_id',
      'in',
      database.db.selectFrom('workflow_definitions').select('id').where('project_id', '=', project.id),
    )
    .execute();
  await database.db.deleteFrom('workflow_definitions').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('work_items').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
  await database.db.deleteFrom('projects').where('id', '=', project.id).execute();
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

describe('DEVOS-185 real E2E pilot — a real knowledge source, authored, used, and traced', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  const apiPort = 3926;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl, ACTOR_ID);

  beforeAll(async () => {
    workerProcess = spawnApp('apps/worker', {
      ...process.env,
      DATABASE_URL,
      AGENT_MODEL_ADAPTER: 'fixture',
    });
    apiProcess = spawnApp('apps/api', { ...process.env, DATABASE_URL, PORT: String(apiPort) });
    try {
      await waitForHealth(`${baseUrl}/api/v1/health`, 20_000);
    } catch (error) {
      throw new Error(
        `${(error as Error).message}\n--- api ---\n${apiProcess.output.join('')}\n--- worker ---\n${workerProcess.output.join('')}`,
        { cause: error },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 40_000);

  afterAll(() => {
    apiProcess?.child.kill();
    workerProcess?.child.kill();
  });

  it('creates, uses, traces, and archives a real knowledge source', async () => {
    const project = await createProjectFixture('Knowledge Pilot Project');

    // A real agent for this pilot's own runs to dispatch to — this
    // fixture's project is created directly via the repository (not the
    // `createProject` use case), so the `ProjectTypeAgent` → `Agent`
    // clone-on-create never runs; mirrors
    // `agent-platform-marketplace-pilot.test.ts`'s own precedent of
    // creating a real agent explicitly through the API instead.
    const createAgentResult = await api<{ key: string; id: string }>(
      'POST',
      `/api/v1/projects/${project.id}/agents`,
      {
        key: `pilot-discovery-${randomUUID()}`,
        name: 'Pilot Discovery Agent',
        configuration: {
          role: 'DISCOVERY',
          provider: 'gemini',
          modelRef: 'gemini-3.6-flash',
          allowedCapabilities: [],
        },
      },
    );
    expect(createAgentResult.status).toBe(200);
    const agentKey = createAgentResult.body.data!.key;
    const agentId = createAgentResult.body.data!.id;
    const publishResult = await api('POST', `/api/v1/agents/${agentId}/publish`);
    expect(publishResult.status).toBe(200);

    const createResult = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${project.id}/knowledge-sources`,
      {
        key: `pilot-standard-${randomUUID()}`,
        name: 'Query Timeout Standard',
        sourceType: 'STANDARD',
        content: 'Investigate slow query timeouts by checking index coverage first.',
      },
    );
    expect(createResult.status).toBe(200);
    const knowledgeSourceId = createResult.body.data!.id;

    // Run 1: the real source is ACTIVE — confirm it's actually used.
    const { run: run1, task: task1 } = await startSingleAgentTaskRun(project, {
      agentRef: agentKey,
    });
    await waitForRunCompleted(run1.id, 20_000);

    const referenceRow = await database.db
      .selectFrom('knowledge_references')
      .selectAll()
      .where('knowledge_source_id', '=', knowledgeSourceId)
      .where('workflow_task_id', '=', task1.id)
      .executeTakeFirst();
    expect(referenceRow).toBeDefined();

    const referencesResult = await api<{ workflowTaskId: string }[]>(
      'GET',
      `/api/v1/knowledge-sources/${knowledgeSourceId}/references`,
    );
    expect(referencesResult.status).toBe(200);
    expect(referencesResult.body.data!.some((r) => r.workflowTaskId === task1.id)).toBe(true);

    // Archive it, then confirm a second real run's context manifest no
    // longer includes it.
    const archiveResult = await api('POST', `/api/v1/knowledge-sources/${knowledgeSourceId}/archive`);
    expect(archiveResult.status).toBe(200);

    const { run: run2, task: task2 } = await startSingleAgentTaskRun(project, {
      agentRef: agentKey,
    });
    await waitForRunCompleted(run2.id, 20_000);

    const manifestRow = await database.db
      .selectFrom('context_manifests')
      .select(['manifest'])
      .where('workflow_task_id', '=', task2.id)
      .executeTakeFirst();
    const sources = ((manifestRow?.manifest as { sources?: Array<{ type: string; ref: string }> })
      ?.sources ?? []) as Array<{ type: string; ref: string }>;
    expect(
      sources.some(
        (s) => s.type === 'KNOWLEDGE_SOURCE' && s.ref === `knowledge-source:${knowledgeSourceId}`,
      ),
    ).toBe(false);

    await cleanupProject(project, [agentId]);
  }, 40_000);
});
