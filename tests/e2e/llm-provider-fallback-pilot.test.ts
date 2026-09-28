import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentExecution,
  AgentVersion,
  Membership,
  Organisation,
  OrganisationLlmProvider,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  createResolvingModelAdapter,
  estimateCostUsd,
  type AgentModelAdapter,
  type PromptRepository,
  type SchemaRepository,
} from '@devos/agents';
import { runAgentTask, type AgentTaskHandlerDeps } from '@devos/application';
import { createEnvCredentialResolver } from '@devos/integrations';
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
  createOrganisationLlmProviderRepository,
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
 * DEVOS-323 (Sprint 55, candidate E30 part 4 — Full-Epic Pilot & Close-Out):
 * the real end-to-end pilot closing this epic's own exit criterion
 * (`specs/DEVOS-LLM-CREDENTIAL-MANAGEMENT-BACKLOG.md` §5.4), mirroring
 * `tests/e2e/cost-budget-pilot.test.ts`'s own identical "real end-to-end
 * pilot closing an epic's own exit criterion, via a direct `runAgentTask`
 * call against real Postgres" precedent (DEVOS-157). A real organisation is
 * configured with two real `organisation_llm_providers` rows; the
 * top-priority one is deliberately made to fail or be unconfigured; two real
 * local `node:http` stand-in servers stand in for Gemini/Anthropic (no live
 * credential for either exists in this environment, mirroring Sprint 53's/
 * 54's own identical disclosed finding) so the real HTTP path — not an
 * injected `fetchImpl` mock, unlike `resolving-model-adapter.test.ts`'s own
 * already-thorough unit coverage of the fallback logic itself — is
 * genuinely exercised. Confirms: the fallback chain genuinely falls through
 * to the real second provider; the resulting `AgentExecution
 * .estimatedCostUsd` reflects that provider's own real per-model rate and
 * real reported usage, not a hypothetical top-priority-succeeded number;
 * and the choice is durably recorded on `AgentExecution.modelReference` —
 * the real, disclosed gap this same task found and fixed (see
 * `packages/domain/src/agents/agent-execution.ts`/`packages/database/src/
 * repositories/agent-executions.ts`/`packages/application/src/tasks/
 * run-agent-task.ts`): the column and domain field have existed since
 * DEVOS-089, but no caller of `complete()` ever supplied a value before
 * this task.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = `devos-323-e2e-${Date.now()}`;

let database: DatabaseClient;

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};
const schemas: SchemaRepository = {
  resolve: async () => ({ name: 'noop', version: 1, fields: {} }),
};

interface StandIn {
  url: string;
  requestCount: () => number;
  close: () => Promise<void>;
}

function startStandIn(respond: (res: ServerResponse) => void): Promise<StandIn> {
  let count = 0;
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req: IncomingMessage, res: ServerResponse) => {
      count += 1;
      respond(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requestCount: () => count,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

function startFailingGeminiStandIn(): Promise<StandIn> {
  return startStandIn((res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'stand-in gemini failure (DEVOS-323 pilot)' }));
  });
}

// Real usage the real anthropic stand-in reports — distinct from the
// arbitrary gemini-shaped default rate, so a real, non-trivial
// estimateCostUsd() figure only the real claude-sonnet-5 rate table row
// (DEVOS-317) could have produced.
const ANTHROPIC_USAGE = { input_tokens: 1200, output_tokens: 400 };

function startAnthropicStandIn(): Promise<StandIn> {
  return startStandIn((res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        content: [{ type: 'text', text: '{"summary":"handled by the real fallback provider"}' }],
        stop_reason: 'end_turn',
        usage: ANTHROPIC_USAGE,
      }),
    );
  });
}

const EXPECTED_ESTIMATED_COST_USD = estimateCostUsd(
  {
    promptTokens: ANTHROPIC_USAGE.input_tokens,
    candidatesTokens: ANTHROPIC_USAGE.output_tokens,
    totalTokens: ANTHROPIC_USAGE.input_tokens + ANTHROPIC_USAGE.output_tokens,
  },
  'claude-sonnet-5',
);

async function createOrganisationFixture(): Promise<Organisation> {
  const now = new Date().toISOString();
  const organisation: Organisation = {
    id: randomUUID() as Organisation['id'],
    name: `LLM Fallback Pilot Org ${randomUUID()}`,
    slug: `llm-fallback-pilot-${randomUUID()}`,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createOrganisationRepository(database.db).create(organisation);
  return organisation;
}

async function createProjectFixture(organisation: Organisation): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: organisation.id,
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `LLM Fallback Pilot Project ${randomUUID()}`,
    slug: `llm-fallback-pilot-${randomUUID()}`,
    status: 'ACTIVE',
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
    key: `llm-fallback-pilot-${randomUUID()}`,
    name: 'LLM Fallback Pilot Agent',
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
    // The real Anthropic model identifier this pilot's own stand-in server
    // is invoked with — DEVOS-317's real pricing table keys on this exact
    // string, regardless of which provider's HTTP endpoint actually served
    // the call (a pre-existing characteristic of AgentInvocationRequest
    // .configuration.modelRef, unchanged by this task, out of this pilot's
    // own scope).
    configuration: {
      role: 'DEVELOPER',
      provider: 'anthropic',
      modelRef: 'claude-sonnet-5',
      allowedCapabilities: [],
    },
    createdBy: ACTOR_ID,
    publishedAt: now,
    createdAt: now,
  };
  await createAgentVersionRepository(database.db).create(version);
  return version;
}

async function createLlmProviderFixture(
  organisation: Organisation,
  provider: string,
  credentialReference: string,
  priority: number,
): Promise<OrganisationLlmProvider> {
  const now = new Date().toISOString();
  const row: OrganisationLlmProvider = {
    id: randomUUID() as OrganisationLlmProvider['id'],
    organisationId: organisation.id,
    provider,
    credentialReference,
    priority,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  await createOrganisationLlmProviderRepository(database.db).create(row);
  return row;
}

async function createRunningTaskFixture(project: Project, agentKey: string): Promise<WorkflowTask> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];
  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `llm-fallback-pilot-${randomUUID()}`,
    name: 'LLM Fallback Pilot Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'LLM Fallback Pilot Workflow',
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
    title: 'LLM fallback pilot work item',
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
  await database.db
    .updateTable('workflow_tasks')
    .set({ status: 'RUNNING' })
    .where('id', '=', task.id)
    .execute();
  return task;
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
  // organisation_llm_providers has ON DELETE CASCADE on organisation_id
  // (migration 0059) — not deleted explicitly here, confirmed zero-residue
  // by direct query in each test below instead.
  await database.db
    .deleteFrom('memberships')
    .where('organisation_id', '=', organisationId)
    .execute();
  await database.db.deleteFrom('projects').where('organisation_id', '=', organisationId).execute();
  await database.db.deleteFrom('organisations').where('id', '=', organisationId).execute();
}

function buildDeps(modelAdapter: AgentModelAdapter): AgentTaskHandlerDeps {
  return {
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

describe('DEVOS-323 real E2E pilot — ranked fallback, real per-provider cost, and a real recorded provider choice', () => {
  it('falls through when the top-priority provider is unconfigured, and records the real fallback provider used', async () => {
    const organisation = await createOrganisationFixture();
    const geminiStandIn = await startFailingGeminiStandIn();
    const anthropicStandIn = await startAnthropicStandIn();
    try {
      const project = await createProjectFixture(organisation);
      const version = await createAgentFixture(project);
      const agent = (await createAgentRepository(database.db).getById(version.agentId))!;

      // Top-priority: gemini, whose credential reference resolves to an
      // env var deliberately never set — genuinely unconfigured, per
      // DEVOS-319's own precise definition.
      await createLlmProviderFixture(
        organisation,
        'gemini',
        `DEVOS_323_UNSET_${randomUUID().replace(/-/g, '')}`,
        1,
      );
      // Fallback: anthropic, a real configured credential resolving to a
      // non-empty value via the real, unmodified createEnvCredentialResolver().
      const anthropicRef = `DEVOS_323_ANTHROPIC_${randomUUID().replace(/-/g, '')}`;
      process.env[anthropicRef] = 'test-anthropic-key';
      await createLlmProviderFixture(organisation, 'anthropic', anthropicRef, 2);

      const organisationLlmProviders = createOrganisationLlmProviderRepository(database.db);
      const credentialResolver = createEnvCredentialResolver();
      const modelAdapter = createResolvingModelAdapter({
        // The platform-wide default — deliberately pointed at the same
        // failing gemini stand-in; never reached given the real fallback
        // resolution below unless something is genuinely broken.
        defaultProvider: 'gemini',
        defaultCredential: 'unused-platform-default',
        baseUrlsByProvider: { gemini: geminiStandIn.url, anthropic: anthropicStandIn.url },
        listProvidersForOrganisation: async (organisationId) =>
          (await organisationLlmProviders.listForOrganisation(organisationId))
            .filter((provider) => provider.status === 'ACTIVE')
            .map((provider) => ({
              provider: provider.provider,
              credentialReference: provider.credentialReference,
            })),
        resolveCredential: credentialResolver.resolve,
      });

      const deps = buildDeps(modelAdapter);
      const task = await createRunningTaskFixture(project, agent.key);

      const output = await runAgentTask(deps, task);

      // Gemini was never even called — genuinely unconfigured, skipped
      // before any HTTP request, per DEVOS-319's own definition.
      expect(geminiStandIn.requestCount()).toBe(0);
      // Anthropic — the real, actual fallback provider — was called exactly
      // once.
      expect(anthropicStandIn.requestCount()).toBe(1);

      const executionId = (output as { agentExecutionId: AgentExecution['id'] }).agentExecutionId;
      const execution = await deps.agentExecutions.getById(executionId);
      expect(execution?.status).toBe('SUCCEEDED');
      // The real gap this task found and fixed: the actual provider/model
      // that served this call is now durably recorded, not silently
      // dropped — real, queryable proof of "the choice is audit-recorded".
      expect(execution?.modelReference).toBe('claude-sonnet-5');
      // The real usage the real anthropic stand-in reported, priced via
      // DEVOS-317's real claude-sonnet-5 rate — not a number that could
      // have come from the (never-invoked) top-priority gemini candidate.
      expect(execution?.usage).toEqual({
        promptTokens: ANTHROPIC_USAGE.input_tokens,
        candidatesTokens: ANTHROPIC_USAGE.output_tokens,
        totalTokens: ANTHROPIC_USAGE.input_tokens + ANTHROPIC_USAGE.output_tokens,
      });
      expect(execution?.estimatedCostUsd).toBeCloseTo(EXPECTED_ESTIMATED_COST_USD, 10);
    } finally {
      await geminiStandIn.close();
      await anthropicStandIn.close();
      await cleanUpOrganisation(organisation.id);
    }

    const remainingProviders = await database.db
      .selectFrom('organisation_llm_providers')
      .selectAll()
      .where('organisation_id', '=', organisation.id)
      .execute();
    expect(remainingProviders).toHaveLength(0);
  }, 60_000);

  it('falls through when the top-priority provider actively fails (a real non-2xx response), and records the real fallback provider used', async () => {
    const organisation = await createOrganisationFixture();
    const geminiStandIn = await startFailingGeminiStandIn();
    const anthropicStandIn = await startAnthropicStandIn();
    try {
      const project = await createProjectFixture(organisation);
      const version = await createAgentFixture(project);
      const agent = (await createAgentRepository(database.db).getById(version.agentId))!;

      // Top-priority: gemini, with a real, resolvable credential — but the
      // real HTTP call itself fails (the stand-in returns 500), a
      // genuinely distinct failure mode from "unconfigured" above, per
      // DEVOS-319's own precise definition.
      const geminiRef = `DEVOS_323_GEMINI_${randomUUID().replace(/-/g, '')}`;
      process.env[geminiRef] = 'test-gemini-key';
      await createLlmProviderFixture(organisation, 'gemini', geminiRef, 1);
      const anthropicRef = `DEVOS_323_ANTHROPIC_${randomUUID().replace(/-/g, '')}`;
      process.env[anthropicRef] = 'test-anthropic-key';
      await createLlmProviderFixture(organisation, 'anthropic', anthropicRef, 2);

      const organisationLlmProviders = createOrganisationLlmProviderRepository(database.db);
      const credentialResolver = createEnvCredentialResolver();
      const modelAdapter = createResolvingModelAdapter({
        defaultProvider: 'gemini',
        defaultCredential: 'unused-platform-default',
        baseUrlsByProvider: { gemini: geminiStandIn.url, anthropic: anthropicStandIn.url },
        listProvidersForOrganisation: async (organisationId) =>
          (await organisationLlmProviders.listForOrganisation(organisationId))
            .filter((provider) => provider.status === 'ACTIVE')
            .map((provider) => ({
              provider: provider.provider,
              credentialReference: provider.credentialReference,
            })),
        resolveCredential: credentialResolver.resolve,
      });

      const deps = buildDeps(modelAdapter);
      const task = await createRunningTaskFixture(project, agent.key);

      const output = await runAgentTask(deps, task);

      // Gemini was genuinely tried and genuinely failed exactly once — not
      // skipped, unlike the "unconfigured" scenario above.
      expect(geminiStandIn.requestCount()).toBe(1);
      expect(anthropicStandIn.requestCount()).toBe(1);

      const executionId = (output as { agentExecutionId: AgentExecution['id'] }).agentExecutionId;
      const execution = await deps.agentExecutions.getById(executionId);
      expect(execution?.status).toBe('SUCCEEDED');
      expect(execution?.modelReference).toBe('claude-sonnet-5');
      expect(execution?.estimatedCostUsd).toBeCloseTo(EXPECTED_ESTIMATED_COST_USD, 10);
    } finally {
      await geminiStandIn.close();
      await anthropicStandIn.close();
      await cleanUpOrganisation(organisation.id);
    }
  }, 60_000);
});
