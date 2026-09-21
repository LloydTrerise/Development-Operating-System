import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  Artifact,
  ArtifactVersion,
  Membership,
  Policy,
  Project,
  WorkflowRun,
  WorkflowTask,
  WorkflowVersion,
  WorkItem,
} from '@devos/domain';
import {
  createAgent,
  publishAgentVersion,
  runApprovalTask,
  type AgentUseCaseDeps,
  type ApprovalTaskHandlerDeps,
} from '@devos/application';
import {
  createAgentDraftCreator,
  createAgentRepository,
  createAgentVersionRepository,
  createApprovalRepository,
  createArtifactRepository,
  createArtifactVersionRepository,
  createAuditRecordRepository,
  createDatabaseClient,
  createMembershipRepository,
  createPolicyRepository,
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
 * DEVOS-201 — a real, live proof that a genuinely demonstrated reliability
 * threshold (DEVOS-198), not a decorative one, changes a real `Approval`'s
 * `requiredApprovers` (DEVOS-199), and that an agent version which has *not*
 * crossed it changes nothing. Mirrors this codebase's own established
 * real-process pilot convention (`approval-node.test.ts`'s direct-repository
 * workflow-run harness; `agent-platform-versioning-pilot.test.ts`'s real
 * agent-creation + spawned-`apps/api` pattern for DEVOS-175, the pilot this
 * task's own spec explicitly says to reuse).
 *
 * Real deviation, disclosed here as this codebase's own established
 * convention requires: DEVOS-201's own pilot procedure step 5 asks for
 * confirmation "in GovernancePage.tsx" — this repository has no browser
 * DOM-rendering test harness anywhere (`apps/web` ships zero
 * `@testing-library/react`/jsdom dependency, confirmed by direct inspection
 * before writing this pilot), so "visible in GovernancePage.tsx" is
 * confirmed via the exact real HTTP route and DTO shape
 * (`GET /projects/:id/approvals` → `toApprovalDto`) that `GovernancePage.tsx`
 * itself actually fetches and renders from (`listApprovalsForProject`,
 * `apps/web/src/api-client.ts`) — the closest real, independently-verifiable
 * proxy available, not a synthetic component-render assertion.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-201-e2e-${Date.now()}`;
const POLICY_ACTION_NODE = 'gate';
const APPROVAL_TYPE = 'devos-201-pilot';

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
  return async function api<T>(method: string, pathname: string): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

function buildAgentUseCaseDeps(): AgentUseCaseDeps {
  return {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    agents: createAgentRepository(database.db),
    agentVersions: createAgentVersionRepository(database.db),
    createDraft: createAgentDraftCreator(database.db),
    auditRecords: createAuditRecordRepository(database.db),
    artifacts: createArtifactRepository(database.db),
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
    name: `${artifactType} DEVOS-201 pilot fixture`,
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

/** Real REVIEW_EVIDENCE/CODE_CHANGE pairs, real-attributed to a real, published AgentVersion. */
async function accumulateReviewOutcomes(
  projectId: Project['id'],
  agentVersionId: string,
  decisions: Array<'PASS' | 'CHANGES_REQUIRED'>,
): Promise<void> {
  for (const decision of decisions) {
    const codeChangeId = await createEvidenceArtifact(projectId, 'CODE_CHANGE', {
      agentVersionId,
      commitSha: randomUUID(),
      generatedAt: new Date().toISOString(),
    });
    await createEvidenceArtifact(projectId, 'REVIEW_EVIDENCE', {
      decision,
      derivedFromArtifactId: codeChangeId,
    });
  }
}

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Approval Reliability Pilot Project ${randomUUID()}`,
    slug: `approval-reliability-pilot-${randomUUID()}`,
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

/** A real published organisation policy: R3 requires 2 approvers for this pilot's own approvalType. */
async function createOrganisationPolicyFixture(): Promise<Policy> {
  const now = new Date().toISOString();
  const policy: Policy = {
    id: randomUUID() as Policy['id'],
    organisationId: SEED_ORGANISATION_ID as Policy['organisationId'],
    key: `devos-201-pilot-risk-tier-${randomUUID()}`,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      rules: [
        {
          action: `${APPROVAL_TYPE}:${POLICY_ACTION_NODE}`,
          effect: 'REQUIRE_APPROVAL',
          condition: { riskClass: 'R3' },
          requiredApprovers: 2,
          enforceSeparationOfDuties: false,
        },
      ],
    },
    createdBy: ACTOR_ID,
    publishedAt: now,
    createdAt: now,
  };
  await createPolicyRepository(database.db).create(policy);
  return policy;
}

async function createGateWorkflowVersion(
  project: Project,
  agentVersionId: string,
): Promise<WorkflowVersion> {
  const now = new Date().toISOString();
  const definitionId = randomUUID() as WorkflowVersion['workflowDefinitionId'];

  await createWorkflowDefinitionRepository(database.db).create({
    id: definitionId,
    projectId: project.id,
    key: `approval-reliability-pilot-${randomUUID()}`,
    name: 'Approval Reliability Pilot Workflow',
    createdAt: now,
    updatedAt: now,
  });

  const version: WorkflowVersion = {
    id: randomUUID() as WorkflowVersion['id'],
    workflowDefinitionId: definitionId,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Approval Reliability Pilot Workflow',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [
        {
          id: POLICY_ACTION_NODE,
          type: 'APPROVAL',
          config: {
            approvalType: APPROVAL_TYPE,
            riskClass: 'R3',
            pollIntervalSeconds: 0.2,
            reliabilityReduction: {
              agentVersionId,
              minPassRate: 0.8,
              minSampleSize: 3,
              reducedRequiredApprovers: 1,
            },
          },
        },
      ],
      edges: [],
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
    title: 'Approval reliability pilot work item',
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

async function startRunFixture(
  project: Project,
  version: WorkflowVersion,
  workItem: WorkItem,
): Promise<WorkflowRun> {
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
  const tasks: WorkflowTask[] = version.definition.nodes.map((node) => ({
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: node.id,
    taskType: node.type,
    status: 'PENDING' as const,
    attempt: 0,
    input: {},
    createdAt: now,
    updatedAt: now,
  }));

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
    projects: createProjectRepository(database.db),
    policies: createPolicyRepository(database.db),
    artifacts: createArtifactRepository(database.db),
  };
  const queue = createPostgresTaskQueue(database.db);
  const dispatcher = createTaskDispatcher(queue, { pollIntervalMs: 20, reclaimIntervalMs: 100 });
  dispatcher.registerHandler('APPROVAL', (task) => runApprovalTask(approvalDeps, task));
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

describe('DEVOS-201: real reliability-conditioned approval-requirement reduction', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3925;
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

  it(
    'reduces requiredApprovers only for the agent version that genuinely crosses the threshold, leaving the other run\'s requirement unchanged, both independently confirmed in Postgres and via the real GovernancePage.tsx data source',
    async () => {
      const project = await createProjectFixture();
      const policy = await createOrganisationPolicyFixture();
      const agentDeps = buildAgentUseCaseDeps();

      // A real MET agent version: 3 real PASS reviews at minSampleSize:3, 100% >= minPassRate:0.8.
      const { agent: metAgent, version: metDraft } = await createAgent(
        agentDeps,
        ACTOR_ID,
        project.id,
        {
          key: `devos-201-met-agent-${randomUUID()}`,
          name: 'DEVOS-201 MET Agent',
          configuration: {
            role: 'DEVELOPMENT',
            provider: 'gemini',
            modelRef: 'gemini-3.6-flash',
            allowedCapabilities: [],
          },
        },
      );
      await publishAgentVersion(agentDeps, ACTOR_ID, metAgent.id);
      await accumulateReviewOutcomes(project.id, metDraft.id, ['PASS', 'PASS', 'PASS']);

      // A real UNMET agent version: real evidence, real sample size, but a
      // real pass rate (33%) below the 0.8 minimum — proves the mechanism is
      // conditional, not decorative.
      const { agent: unmetAgent, version: unmetDraft } = await createAgent(
        agentDeps,
        ACTOR_ID,
        project.id,
        {
          key: `devos-201-unmet-agent-${randomUUID()}`,
          name: 'DEVOS-201 UNMET Agent',
          configuration: {
            role: 'DEVELOPMENT',
            provider: 'gemini',
            modelRef: 'gemini-3.6-flash',
            allowedCapabilities: [],
          },
        },
      );
      await publishAgentVersion(agentDeps, ACTOR_ID, unmetAgent.id);
      await accumulateReviewOutcomes(project.id, unmetDraft.id, [
        'PASS',
        'CHANGES_REQUIRED',
        'CHANGES_REQUIRED',
      ]);

      const metVersion = await createGateWorkflowVersion(project, metDraft.id);
      const unmetVersion = await createGateWorkflowVersion(project, unmetDraft.id);
      const workItem = await createWorkItemFixture(project);
      const metRun = await startRunFixture(project, metVersion, workItem);
      const unmetRun = await startRunFixture(project, unmetVersion, workItem);

      const dispatcher = startDispatcher();
      const approvals = createApprovalRepository(database.db);

      const metPending = await vi.waitFor(
        async () => {
          const found = await approvals.getPendingForRunAndType(
            metRun.id,
            `${APPROVAL_TYPE}:${POLICY_ACTION_NODE}`,
          );
          expect(found).not.toBeNull();
          return found!;
        },
        { timeout: 5000 },
      );
      const unmetPending = await vi.waitFor(
        async () => {
          const found = await approvals.getPendingForRunAndType(
            unmetRun.id,
            `${APPROVAL_TYPE}:${POLICY_ACTION_NODE}`,
          );
          expect(found).not.toBeNull();
          return found!;
        },
        { timeout: 5000 },
      );
      await dispatcher.stop();

      // Independent confirmation via a direct Postgres query, not the
      // application layer's own read path.
      const rows = await database.db
        .selectFrom('approvals')
        .select(['id', 'required_approvers', 'reliability_evidence'])
        .where('id', 'in', [metPending.id, unmetPending.id])
        .execute();
      const byId = new Map(rows.map((row) => [row.id, row]));

      const metRow = byId.get(metPending.id)!;
      expect(metRow.required_approvers).toBe(1);
      expect(metRow.reliability_evidence).toMatchObject({
        agentVersionId: metDraft.id,
        signal: 'MET',
        appliedReducedRequiredApprovers: 1,
      });

      const unmetRow = byId.get(unmetPending.id)!;
      expect(unmetRow.required_approvers).toBe(2);
      expect(unmetRow.reliability_evidence).toMatchObject({
        agentVersionId: unmetDraft.id,
        signal: 'UNMET',
      });

      // Real governance visibility: the exact route/DTO GovernancePage.tsx
      // itself fetches from (apps/web/src/api-client.ts's
      // listApprovalsForProject → GET /projects/:id/approvals).
      const listed = await api<
        Array<{ id: string; requiredApprovers: number; reliabilityEvidence?: unknown }>
      >('GET', `/api/v1/projects/${project.id}/approvals`);
      expect(listed.status).toBe(200);
      const listedById = new Map(listed.body.data!.map((row) => [row.id, row]));
      expect(listedById.get(metPending.id)).toMatchObject({
        requiredApprovers: 1,
        reliabilityEvidence: { agentVersionId: metDraft.id, signal: 'MET' },
      });
      expect(listedById.get(unmetPending.id)).toMatchObject({
        requiredApprovers: 2,
        reliabilityEvidence: { agentVersionId: unmetDraft.id, signal: 'UNMET' },
      });

      // Cleanup — mirrors this codebase's own established pilot convention
      // (engineering-intelligence-pilot.test.ts et al.), extended with
      // approvals/agents/policy rows this pilot's own fixtures added.
      await database.db.deleteFrom('approvals').where('workflow_run_id', 'in', [metRun.id, unmetRun.id]).execute();
      await database.db
        .deleteFrom('workflow_tasks')
        .where('workflow_run_id', 'in', [metRun.id, unmetRun.id])
        .execute();
      await database.db.deleteFrom('workflow_runs').where('id', 'in', [metRun.id, unmetRun.id]).execute();
      await database.db
        .deleteFrom('workflow_versions')
        .where('id', 'in', [metVersion.id, unmetVersion.id])
        .execute();
      await database.db
        .deleteFrom('workflow_definitions')
        .where('id', 'in', [metVersion.workflowDefinitionId, unmetVersion.workflowDefinitionId])
        .execute();
      await database.db.deleteFrom('work_items').where('id', '=', workItem.id).execute();
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
        .deleteFrom('agent_versions')
        .where('agent_id', 'in', [metAgent.id, unmetAgent.id])
        .execute();
      await database.db.deleteFrom('agents').where('id', 'in', [metAgent.id, unmetAgent.id]).execute();
      await database.db.deleteFrom('policies').where('id', '=', policy.id).execute();
      await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
      await database.db.deleteFrom('projects').where('id', '=', project.id).execute();

      const remainingApprovals = await database.db
        .selectFrom('approvals')
        .select('id')
        .where('id', 'in', [metPending.id, unmetPending.id])
        .execute();
      expect(remainingApprovals).toHaveLength(0);
      const remainingProject = await createProjectRepository(database.db).getById(project.id);
      expect(remainingProject).toBeNull();
    },
    30_000,
  );
});
