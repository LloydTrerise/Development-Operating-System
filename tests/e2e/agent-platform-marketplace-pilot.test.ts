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
 * DEVOS-180 — the real end-to-end pilot for Sprint 23 (E25 Agent Platform,
 * part 2): two real scenarios, driven through a real spawned `apps/api`
 * and `apps/worker` process pair (`AGENT_MODEL_ADAPTER=fixture`,
 * mirroring DEVOS-161's own established precedent for avoiding a live
 * Gemini dependency this pilot doesn't need).
 *
 * Scenario 1: a real agent is shared from project A, installed for real
 * into project B (same organisation), and a real workflow run in project B
 * dispatches to the installed agent successfully.
 * Scenario 2: two real DISCOVERY-role candidate agents exist in one
 * project with genuinely different real review pass rates (DEVOS-174); a
 * real role-targeted workflow run confirms `selectAgentForTask`'s real
 * quality-aware tie-break (DEVOS-179) picks the real higher-pass-rate
 * candidate, not the lexicographically-earlier key.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-180-e2e-${Date.now()}`;

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

/** A single-node (AGENT_TASK) workflow run, started for real and left for the real worker to claim. */
async function startSingleAgentTaskRun(
  project: Project,
  taskInput: Record<string, unknown>,
): Promise<{ run: WorkflowRun; task: WorkflowTask }> {
  const now = new Date().toISOString();
  const workflowDefinitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  const workflowName = `Marketplace Pilot Workflow ${randomUUID()}`;
  await createWorkflowDefinitionRepository(database.db).create({
    id: workflowDefinitionId,
    projectId: project.id,
    key: `marketplace-pilot-${randomUUID()}`,
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
    title: `Marketplace pilot work item ${randomUUID()}`,
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

describe('DEVOS-180 real E2E pilot — agent marketplace share/install and quality-aware dispatch', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  const apiPort = 3925;
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
    // Give the worker's own poll loop a moment to be actively running.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, 40_000);

  afterAll(() => {
    apiProcess?.child.kill();
    workerProcess?.child.kill();
  });

  it('scenario 1: shares a real agent, installs it into a real same-organisation project, and dispatches a real run to it', async () => {
    const projectA = await createProjectFixture('Marketplace Source Project');
    const projectB = await createProjectFixture('Marketplace Target Project');

    const createResult = await api<{ id: string; version: { id: string; version: number } }>(
      'POST',
      `/api/v1/projects/${projectA.id}/agents`,
      {
        key: `shareable-agent-${randomUUID()}`,
        name: 'Shareable Agent',
        configuration: {
          role: 'DISCOVERY',
          provider: 'gemini',
          modelRef: 'gemini-3.6-flash',
          allowedCapabilities: [],
        },
      },
    );
    expect(createResult.status).toBe(200);
    const sourceAgentId = createResult.body.data!.id;
    const sourceVersion = createResult.body.data!.version;

    const publishResult = await api('POST', `/api/v1/agents/${sourceAgentId}/publish`);
    expect(publishResult.status).toBe(200);

    const shareResult = await api(
      'POST',
      `/api/v1/agents/${sourceAgentId}/versions/${sourceVersion.version}/share`,
      { shared: true },
    );
    expect(shareResult.status).toBe(200);

    const sharedList = await api<{ id: string; agentKey: string }[]>(
      'GET',
      `/api/v1/organisations/${SEED_ORGANISATION_ID}/shared-agents`,
    );
    expect(sharedList.status).toBe(200);
    const sharedRow = sharedList.body.data!.find((row) => row.id === sourceVersion.id);
    expect(sharedRow).toBeDefined();

    const installResult = await api<{ id: string; key: string }>(
      'POST',
      `/api/v1/organisations/${SEED_ORGANISATION_ID}/shared-agents/${sourceVersion.id}/install`,
      { targetProjectId: projectB.id },
    );
    expect(installResult.status).toBe(200);
    const installedAgentKey = installResult.body.data!.key;

    // Real workflow run in project B, dispatching by literal agentRef to
    // the newly installed real agent.
    const { run } = await startSingleAgentTaskRun(projectB, { agentRef: installedAgentKey });
    await waitForRunCompleted(run.id, 20_000);

    // Cleanup (scenario 1's own real rows) — `context_manifests` carries
    // real FKs to `agent_executions`/`workflow_tasks`/`projects`, and
    // `agent_executions` carries one to `agent_versions`; both must be
    // cleared before their referenced rows (the same ordering lesson
    // DEVOS-171/175's own pilots already found for `audit_records`/
    // `outbox_events` and `project_id`).
    await database.db
      .deleteFrom('context_manifests')
      .where('project_id', 'in', [projectA.id, projectB.id])
      .execute();
    await database.db
      .deleteFrom('agent_executions')
      .where(
        'workflow_task_id',
        'in',
        database.db.selectFrom('workflow_tasks').select('id').where('workflow_run_id', '=', run.id),
      )
      .execute();
    await database.db.deleteFrom('agent_versions').where('agent_id', '=', sourceAgentId).execute();
    await database.db.deleteFrom('agents').where('id', '=', sourceAgentId).execute();
    await database.db
      .deleteFrom('agent_versions')
      .where('agent_id', '=', installResult.body.data!.id)
      .execute();
    await database.db.deleteFrom('agents').where('id', '=', installResult.body.data!.id).execute();
    for (const project of [projectA, projectB]) {
      // The real dispatched task (project B) publishes a real
      // `DISCOVERY_REPORT` artifact — carries a real FK to
      // `workflow_task_id`, must be cleared before the task row.
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
          database.db
            .selectFrom('workflow_definitions')
            .select('id')
            .where('project_id', '=', project.id),
        )
        .execute();
      await database.db
        .deleteFrom('workflow_definitions')
        .where('project_id', '=', project.id)
        .execute();
      await database.db.deleteFrom('work_items').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('projects').where('id', '=', project.id).execute();
    }
  }, 30_000);

  it('scenario 2: a real role-targeted run dispatches to the real higher-pass-rate candidate, not the lexicographically-earlier key', async () => {
    const project = await createProjectFixture('Quality Selection Project');

    async function createPublishedDiscoveryAgent(key: string): Promise<{
      agentId: string;
      versionId: string;
    }> {
      const createResult = await api<{ id: string; version: { id: string } }>(
        'POST',
        `/api/v1/projects/${project.id}/agents`,
        {
          key,
          name: key,
          configuration: {
            role: 'DISCOVERY',
            provider: 'gemini',
            modelRef: 'gemini-3.6-flash',
            allowedCapabilities: [],
          },
        },
      );
      const agentId = createResult.body.data!.id;
      await api('POST', `/api/v1/agents/${agentId}/publish`);
      return { agentId, versionId: createResult.body.data!.version.id };
    }

    // "aaa-" sorts before "zzz-" — today's plain ascending-key tie-break
    // would pick this one; its own real quality is deliberately worse.
    const lowerKeyAgent = await createPublishedDiscoveryAgent(`aaa-discovery-${randomUUID()}`);
    const higherKeyAgent = await createPublishedDiscoveryAgent(`zzz-discovery-${randomUUID()}`);

    const codeChangeLow = await createEvidenceArtifact(project.id, 'CODE_CHANGE', {
      agentVersionId: lowerKeyAgent.versionId,
    });
    const codeChangeHigh = await createEvidenceArtifact(project.id, 'CODE_CHANGE', {
      agentVersionId: higherKeyAgent.versionId,
    });
    await createEvidenceArtifact(project.id, 'REVIEW_EVIDENCE', {
      decision: 'CHANGES_REQUIRED',
      derivedFromArtifactId: codeChangeLow,
    });
    await createEvidenceArtifact(project.id, 'REVIEW_EVIDENCE', {
      decision: 'PASS',
      derivedFromArtifactId: codeChangeHigh,
    });

    const { run, task } = await startSingleAgentTaskRun(project, {
      requiredRole: 'DISCOVERY',
      requiredCapabilities: [],
    });
    await waitForRunCompleted(run.id, 20_000);

    const executionRow = await database.db
      .selectFrom('agent_executions')
      .innerJoin('workflow_tasks', 'workflow_tasks.id', 'agent_executions.workflow_task_id')
      .select(['agent_executions.agent_version_id as agent_version_id'])
      .where('workflow_tasks.id', '=', task.id)
      .executeTakeFirst();
    expect(executionRow?.agent_version_id).toBe(higherKeyAgent.versionId);

    // Cleanup.
    await database.db
      .deleteFrom('artifact_versions')
      .where(
        'artifact_id',
        'in',
        database.db.selectFrom('artifacts').select('id').where('project_id', '=', project.id),
      )
      .execute();
    await database.db.deleteFrom('artifacts').where('project_id', '=', project.id).execute();
    // `context_manifests` carries real FKs to `agent_executions`/
    // `workflow_tasks`/`projects`, and `agent_executions` carries one to
    // `agent_versions` — both must be cleared before their referenced rows.
    await database.db
      .deleteFrom('context_manifests')
      .where('project_id', '=', project.id)
      .execute();
    await database.db
      .deleteFrom('agent_executions')
      .where(
        'workflow_task_id',
        'in',
        database.db.selectFrom('workflow_tasks').select('id').where('workflow_run_id', '=', run.id),
      )
      .execute();
    await database.db
      .deleteFrom('agent_versions')
      .where('agent_id', 'in', [lowerKeyAgent.agentId, higherKeyAgent.agentId])
      .execute();
    await database.db
      .deleteFrom('agents')
      .where('id', 'in', [lowerKeyAgent.agentId, higherKeyAgent.agentId])
      .execute();
    await database.db.deleteFrom('workflow_tasks').where('workflow_run_id', '=', run.id).execute();
    await database.db.deleteFrom('workflow_runs').where('id', '=', run.id).execute();
    await database.db
      .deleteFrom('workflow_versions')
      .where('id', '=', run.workflowVersionId)
      .execute();
    await database.db
      .deleteFrom('workflow_definitions')
      .where('project_id', '=', project.id)
      .execute();
    await database.db.deleteFrom('work_items').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('projects').where('id', '=', project.id).execute();
  }, 30_000);
});
