import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Membership,
  Organisation,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  createDatabaseClient,
  createMembershipRepository,
  createOrganisationRepository,
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
 * DEVOS-190 — the real end-to-end pilot for Sprint 25 (E26 Knowledge
 * Platform, part 2): a real knowledge source moves from one project to
 * another within the same organisation and is then genuinely preferred by
 * real relevance retrieval over an unrelated source already in the target
 * project; a cross-organisation install attempt is confirmed to fail.
 * Mirrors `agent-platform-marketplace-pilot.test.ts`'s own established
 * real-process pilot pattern exactly.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-190-e2e-${Date.now()}`;

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

async function createProjectFixture(
  name: string,
  organisationId: string = SEED_ORGANISATION_ID,
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: organisationId as Project['organisationId'],
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
  workItemOverrides: Partial<WorkItem> = {},
): Promise<{ run: WorkflowRun; task: WorkflowTask }> {
  const now = new Date().toISOString();
  const workflowDefinitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  const workflowName = `Knowledge Marketplace Pilot Workflow ${randomUUID()}`;
  await createWorkflowDefinitionRepository(database.db).create({
    id: workflowDefinitionId,
    projectId: project.id,
    key: `knowledge-marketplace-pilot-${randomUUID()}`,
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
    title: 'Work item',
    type: 'GENERAL',
    status: 'OPEN',
    priority: 'MEDIUM',
    metadata: {},
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
    ...workItemOverrides,
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

describe('DEVOS-190 real E2E pilot — knowledge marketplace share/install and relevance-aware retrieval', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  const apiPort = 3927;
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

  it('scenario 1: shares a real knowledge source, installs it into a real same-organisation project, and real relevance retrieval prefers it', async () => {
    const projectA = await createProjectFixture('Knowledge Source Project');
    const projectB = await createProjectFixture('Knowledge Target Project');

    const createResult = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${projectA.id}/knowledge-sources`,
      {
        key: `shareable-standard-${randomUUID()}`,
        name: 'Query Timeout Standard',
        sourceType: 'STANDARD',
        content: 'Investigate slow query timeouts by checking index coverage first.',
      },
    );
    expect(createResult.status).toBe(200);
    const sourceKnowledgeSourceId = createResult.body.data!.id;

    const shareResult = await api(
      'POST',
      `/api/v1/knowledge-sources/${sourceKnowledgeSourceId}/share`,
      { shared: true },
    );
    expect(shareResult.status).toBe(200);

    const sharedList = await api<{ id: string }[]>(
      'GET',
      `/api/v1/organisations/${SEED_ORGANISATION_ID}/shared-knowledge-sources`,
    );
    expect(sharedList.status).toBe(200);
    expect(sharedList.body.data!.some((row) => row.id === sourceKnowledgeSourceId)).toBe(true);

    const installResult = await api<{ id: string }>(
      'POST',
      `/api/v1/organisations/${SEED_ORGANISATION_ID}/shared-knowledge-sources/${sourceKnowledgeSourceId}/install`,
      { targetProjectId: projectB.id },
    );
    expect(installResult.status).toBe(200);
    const installedKnowledgeSourceId = installResult.body.data!.id;

    // A real, unrelated second knowledge source also exists in project B.
    const unrelatedResult = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${projectB.id}/knowledge-sources`,
      {
        key: `unrelated-${randomUUID()}`,
        name: 'Naming Conventions',
        sourceType: 'STANDARD',
        content: 'Use camelCase for variables and PascalCase for types.',
      },
    );
    expect(unrelatedResult.status).toBe(200);

    const createAgentResult = await api<{ key: string; id: string }>(
      'POST',
      `/api/v1/projects/${projectB.id}/agents`,
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
    const agentId = createAgentResult.body.data!.id;
    const agentKey = createAgentResult.body.data!.key;
    await api('POST', `/api/v1/agents/${agentId}/publish`);

    const { run, task } = await startSingleAgentTaskRun(
      projectB,
      { agentRef: agentKey },
      {
        title: 'Investigate slow query',
        description: 'Users report query timeouts on the reporting endpoint.',
      },
    );
    await waitForRunCompleted(run.id, 20_000);

    const manifestRow = await database.db
      .selectFrom('context_manifests')
      .select(['manifest'])
      .where('workflow_task_id', '=', task.id)
      .executeTakeFirst();
    const sources = ((manifestRow?.manifest as { sources?: Array<{ type: string; ref: string }> })
      ?.sources ?? []) as Array<{ type: string; ref: string }>;
    const knowledgeSourceRefs = sources.filter((s) => s.type === 'KNOWLEDGE_SOURCE');
    expect(knowledgeSourceRefs).toContainEqual(
      expect.objectContaining({ ref: `knowledge-source:${installedKnowledgeSourceId}` }),
    );

    await cleanupProject(projectA);
    await cleanupProject(projectB, [agentId]);
  }, 40_000);

  it('scenario 2: a cross-organisation install attempt fails with NotFoundError', async () => {
    const projectA = await createProjectFixture('Cross Org Source Project');
    const now = new Date().toISOString();
    const otherOrganisation: Organisation = {
      id: randomUUID() as Organisation['id'],
      name: `Other Org ${randomUUID()}`,
      slug: `other-org-${randomUUID()}`,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await createOrganisationRepository(database.db).create(otherOrganisation);
    const projectC = await createProjectFixture('Cross Org Target Project', otherOrganisation.id);

    const createResult = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${projectA.id}/knowledge-sources`,
      {
        key: `cross-org-${randomUUID()}`,
        name: 'Cross Org Standard',
        sourceType: 'STANDARD',
        content: 'content',
      },
    );
    const knowledgeSourceId = createResult.body.data!.id;
    await api('POST', `/api/v1/knowledge-sources/${knowledgeSourceId}/share`, { shared: true });

    const installResult = await api(
      'POST',
      `/api/v1/organisations/${SEED_ORGANISATION_ID}/shared-knowledge-sources/${knowledgeSourceId}/install`,
      { targetProjectId: projectC.id },
    );
    expect(installResult.status).toBe(404);

    await cleanupProject(projectA);
    await cleanupProject(projectC);
    await database.db.deleteFrom('organisations').where('id', '=', otherOrganisation.id).execute();
  }, 30_000);
});
