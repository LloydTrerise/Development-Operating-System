import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentVersion,
  Membership,
  Organisation,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  estimateCostUsd,
  type AgentModelAdapter,
  type PromptRepository,
  type SchemaRepository,
} from '@devos/agents';
import { runAgentTask, type AgentTaskHandlerDeps } from '@devos/application';
import {
  createAgentExecutionRepository,
  createAgentRepository,
  createAgentVersionRepository,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createContextManifestRecorder,
  createDatabaseClient,
  createKnowledgeSourceRepository,
  createMembershipRepository,
  createOrganisationRepository,
  createProjectRepository,
  createWorkflowDefinitionRepository,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-157 — the real end-to-end pilot closing Sprint 18's own exit
 * criterion: a real organisation with two real projects genuinely crosses
 * a real warning threshold and then a real hard project-level threshold,
 * and the organisation's own independent rollup threshold, driven by real
 * `runAgentTask` executions against real Postgres (the same
 * "call the real application function directly against real repositories"
 * precedent `tests/e2e/approval-expiry.test.ts` already established for a
 * synchronous, non-dispatcher-dependent code path). A deterministic model
 * adapter stands in for a real Gemini call, mirroring DEVOS-089's own
 * disclosed fixture-adapter precedent — no `GEMINI_API_KEY` in this
 * session. Both real alerts are confirmed via a direct Postgres query and
 * via the real DEVOS-151 cost routes and DEVOS-147 compliance-export
 * route (a real running `apps/api`).
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-157-e2e-${Date.now()}`;

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

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};
const schemas: SchemaRepository = {
  resolve: async () => ({ name: 'noop', version: 1, fields: {} }),
};

// The real usage per execution this pilot drives — the same shape
// `estimateCostUsd` (DEVOS-149) already computes a real cost from.
const USAGE = { promptTokens: 1000, candidatesTokens: 1000, totalTokens: 2000 };
const modelAdapter: AgentModelAdapter = {
  invoke: async () => ({ status: 'SUCCEEDED', result: {}, usage: USAGE }),
};
const PER_EXECUTION_COST_USD = estimateCostUsd(USAGE);

async function createOrganisationFixture(budgetUsd: number): Promise<Organisation> {
  const now = new Date().toISOString();
  const organisation: Organisation = {
    id: randomUUID() as Organisation['id'],
    name: `Cost Budget Pilot Org ${randomUUID()}`,
    slug: `cost-budget-pilot-${randomUUID()}`,
    status: 'ACTIVE',
    budgetUsd,
    createdAt: now,
    updatedAt: now,
  };
  await createOrganisationRepository(database.db).create(organisation);
  return organisation;
}

async function createProjectFixture(
  organisation: Organisation,
  budgetUsd: number | undefined,
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: organisation.id,
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Cost Budget Pilot Project ${randomUUID()}`,
    slug: `cost-budget-pilot-${randomUUID()}`,
    status: 'ACTIVE',
    ...(budgetUsd !== undefined ? { budgetUsd } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await createProjectRepository(database.db).create(project);
  await createMembershipRepository(database.db).create({
    id: randomUUID() as Membership['id'],
    organisationId: organisation.id,
    projectId: project.id,
    principalId: ACTOR_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  return project;
}

async function createAgentFixture(project: Project): Promise<AgentVersion> {
  const now = new Date().toISOString();
  const agent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId: project.id,
    key: `cost-budget-pilot-${randomUUID()}`,
    name: 'Cost Budget Pilot Agent',
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
      role: 'DEVELOPER',
      provider: 'fixture',
      modelRef: 'fixture-model',
      allowedCapabilities: [],
    },
    createdBy: ACTOR_ID,
    publishedAt: now,
    createdAt: now,
  };
  await createAgentVersionRepository(database.db).create(version);
  return version;
}

async function cleanUpOrganisation(organisationId: string): Promise<void> {
  const projectIds = database.db
    .selectFrom('projects')
    .select('id')
    .where('organisation_id', '=', organisationId);
  await database.db
    .deleteFrom('audit_records')
    .where('organisation_id', '=', organisationId)
    .execute();
  await database.db.deleteFrom('context_manifests').where('project_id', 'in', projectIds).execute();
  await database.db
    .deleteFrom('agent_executions')
    .where(
      'workflow_task_id',
      'in',
      database.db
        .selectFrom('workflow_tasks')
        .innerJoin('workflow_runs', 'workflow_runs.id', 'workflow_tasks.workflow_run_id')
        .select('workflow_tasks.id')
        .where('workflow_runs.project_id', 'in', projectIds),
    )
    .execute();
  await database.db
    .deleteFrom('workflow_tasks')
    .where(
      'workflow_run_id',
      'in',
      database.db.selectFrom('workflow_runs').select('id').where('project_id', 'in', projectIds),
    )
    .execute();
  await database.db.deleteFrom('workflow_runs').where('project_id', 'in', projectIds).execute();
  await database.db
    .deleteFrom('workflow_versions')
    .where(
      'workflow_definition_id',
      'in',
      database.db
        .selectFrom('workflow_definitions')
        .select('id')
        .where('project_id', 'in', projectIds),
    )
    .execute();
  await database.db
    .deleteFrom('workflow_definitions')
    .where('project_id', 'in', projectIds)
    .execute();
  await database.db.deleteFrom('work_items').where('project_id', 'in', projectIds).execute();
  await database.db
    .deleteFrom('agent_versions')
    .where(
      'agent_id',
      'in',
      database.db.selectFrom('agents').select('id').where('project_id', 'in', projectIds),
    )
    .execute();
  await database.db.deleteFrom('agents').where('project_id', 'in', projectIds).execute();
  await database.db.deleteFrom('outbox_events').where('project_id', 'in', projectIds).execute();
  await database.db
    .deleteFrom('memberships')
    .where('organisation_id', '=', organisationId)
    .execute();
  await database.db.deleteFrom('projects').where('organisation_id', '=', organisationId).execute();
  await database.db.deleteFrom('organisations').where('id', '=', organisationId).execute();
}

async function createRunningTaskFixture(project: Project, agentKey: string): Promise<WorkflowTask> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `cost-budget-pilot-${randomUUID()}`,
    name: 'Cost Budget Pilot Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Cost Budget Pilot Workflow',
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

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Cost budget pilot work item',
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
    status: 'RUNNING',
    attempt: 1,
    input: { agentRef: agentKey },
    createdAt: now,
    updatedAt: now,
  };
  await createWorkflowRunStarter(database.db)(run, [task], ACTOR_ID);
  // The real starter leaves the task PENDING — runAgentTask itself doesn't
  // require RUNNING, but every real dispatch path transitions it there
  // first (task-dispatcher.ts's claimNext()); set it explicitly so this
  // pilot's own task rows match real production state exactly.
  await database.db
    .updateTable('workflow_tasks')
    .set({ status: 'RUNNING' })
    .where('id', '=', task.id)
    .execute();
  return task;
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

describe('DEVOS-157 real E2E pilot — multi-tier budgets, org rollup, dashboard, compliance export', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3931;
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

  it('fires real project warning/exceeded and organisation warning/exceeded alerts, visible via the real cost and compliance routes', async () => {
    // organisation.budgetUsd = 4.5x -> warning 3.6x, exceeded 4.5x.
    // projectX.budgetUsd = 3.5x -> warning 2.8x, exceeded 3.5x.
    // projectY has no configured budget (contributes to the org rollup only).
    const organisation = await createOrganisationFixture(PER_EXECUTION_COST_USD * 4.5);
    try {
      const projectX = await createProjectFixture(organisation, PER_EXECUTION_COST_USD * 3.5);
      const projectY = await createProjectFixture(organisation, undefined);
      const agentVersionX = await createAgentFixture(projectX);
      const agentVersionY = await createAgentFixture(projectY);

      const deps: AgentTaskHandlerDeps = {
        workflowRuns: createWorkflowRunRepository(database.db),
        workItems: createWorkItemRepository(database.db),
        agents: createAgentRepository(database.db),
        agentVersions: createAgentVersionRepository(database.db),
        agentExecutions: createAgentExecutionRepository(database.db),
        modelAdapter,
        prompts,
        schemas,
        recordContextManifest: createContextManifestRecorder(database.db),
        knowledgeSources: createKnowledgeSourceRepository(database.db),
        artifacts: createArtifactRepository(database.db),
        artifactVersions: createArtifactVersionRepository(database.db),
        projects: createProjectRepository(database.db),
        organisations: createOrganisationRepository(database.db),
        auditRecords: createAuditRecordRepository(database.db),
      };

      // Look up each agent's own real key (task.input.agentRef must match it).
      const agentX = (await createAgentRepository(database.db).getById(agentVersionX.agentId))!;
      const agentY = (await createAgentRepository(database.db).getById(agentVersionY.agentId))!;

      // Executions 1-4 on projectX: crosses its own warning (3rd) then
      // exceeded (4th) tier, and along the way the organisation's own
      // warning tier (4th, since org total reaches 4x >= 3.6x there too).
      for (let i = 0; i < 4; i++) {
        const task = await createRunningTaskFixture(projectX, agentX.key);
        await runAgentTask(deps, task);
      }
      // Execution 5 on projectY: pushes the organisation's own rollup total
      // past its hard 4.5x tier.
      const taskY = await createRunningTaskFixture(projectY, agentY.key);
      await runAgentTask(deps, taskY);

      // Confirm via a real, direct Postgres query — not just the API.
      const auditRows = await database.db
        .selectFrom('audit_records')
        .selectAll()
        .where('organisation_id', '=', organisation.id)
        .execute();
      const byAction = Object.fromEntries(auditRows.map((row) => [row.action, row]));
      expect(byAction['project.budget_warning']).toBeDefined();
      expect(byAction['project.budget_warning']!.project_id).toBe(projectX.id);
      expect(byAction['project.budget_exceeded']).toBeDefined();
      expect(byAction['project.budget_exceeded']!.project_id).toBe(projectX.id);
      expect(byAction['organisation.budget_warning']).toBeDefined();
      expect(byAction['organisation.budget_warning']!.project_id).toBeNull();
      expect(byAction['organisation.budget_exceeded']).toBeDefined();
      expect(byAction['organisation.budget_exceeded']!.project_id).toBeNull();
      // Exactly these four — each tier fired exactly once.
      expect(
        auditRows.filter((row) =>
          [
            'project.budget_warning',
            'project.budget_exceeded',
            'organisation.budget_warning',
            'organisation.budget_exceeded',
          ].includes(row.action),
        ),
      ).toHaveLength(4);

      // Confirm via the real DEVOS-151 cost routes.
      const projectXCost = await api<{ totalUsd: number; budgetUsd?: number }>(
        'GET',
        `/api/v1/projects/${projectX.id}/cost`,
      );
      expect(projectXCost.status).toBe(200);
      expect(projectXCost.body.data!.totalUsd).toBeCloseTo(PER_EXECUTION_COST_USD * 4, 6);

      const orgCost = await api<{ totalUsd: number; budgetUsd?: number }>(
        'GET',
        `/api/v1/organisations/${organisation.id}/cost-report`,
      );
      expect(orgCost.status).toBe(200);
      expect(orgCost.body.data!.totalUsd).toBeCloseTo(PER_EXECUTION_COST_USD * 5, 6);

      // Confirm via the real DEVOS-147 compliance-export route: the new
      // budget audit records are real AuditRecords, already scoped by this
      // organisation, and appear in the same real, unmodified endpoint
      // GovernancePage.tsx's own compliance-report section reads from.
      const complianceExport = await api<{ action: string; projectId?: string }[]>(
        'GET',
        `/api/v1/organisations/${organisation.id}/audit`,
      );
      expect(complianceExport.status).toBe(200);
      const complianceActions = complianceExport.body.data!.map((record) => record.action);
      expect(complianceActions).toContain('project.budget_warning');
      expect(complianceActions).toContain('project.budget_exceeded');
      expect(complianceActions).toContain('organisation.budget_warning');
      expect(complianceActions).toContain('organisation.budget_exceeded');
    } finally {
      // Clean up all test data regardless of assertion outcome, matching
      // this codebase's own established pilot-cleanup convention
      // (DEVOS-100/108/126/137/148).
      await cleanUpOrganisation(organisation.id);
    }

    const remainingProjects = await database.db
      .selectFrom('projects')
      .selectAll()
      .where('organisation_id', '=', organisation.id)
      .execute();
    const remainingOrg = await database.db
      .selectFrom('organisations')
      .selectAll()
      .where('id', '=', organisation.id)
      .execute();
    expect(remainingProjects).toHaveLength(0);
    expect(remainingOrg).toHaveLength(0);
  }, 60_000);
});
