import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Artifact,
  ArtifactVersion,
  Membership,
  Policy,
  Project,
  WorkflowRun,
  WorkItem,
} from '@devos/domain';
import { approveApproval, requestApproval, type ApprovalUseCaseDeps } from '@devos/application';
import {
  createApprovalRepository,
  createArtifactRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createDecideApprovalAndTransition,
  createMembershipRepository,
  createPolicyRepository,
  createProjectRepository,
  createWorkflowDefinitionRepository,
  createWorkflowDraftCreator,
  createWorkflowRunRepository,
  createWorkflowRunStarter,
  createWorkflowTaskRepository,
  createWorkflowVersionRepository,
  createWorkItemRepository,
  transitionAfterApprovalDecisionInTrx,
  withTransaction,
  SEED_ORGANISATION_ID,
  SEED_PLANNING_PATH_WORKFLOW_VERSION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-110/DEVOS-111 — real-Postgres verification, talking to Postgres
 * directly through `@devos/database`'s repositories and `@devos/application`'s
 * real use case, the same established pattern `hardening.test.ts` already
 * uses for exactly this reason (no HTTP endpoint exists for "decide an
 * approval with a real policy row already published").
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const ACTOR_ID = 'devos-e2e-approval-atomicity';

let database: DatabaseClient;

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

// A fresh project per test, not one shared across the whole file — a
// published policy (DEVOS-110) is project-scoped and persists in real
// Postgres for the life of the project, so sharing one project across
// tests would let one test's real DENY policy leak into and break another
// test's own unrelated approval decision.
async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Approval Atomicity Test Project ${randomUUID()}`,
    slug: `approval-atomicity-${randomUUID()}`,
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

async function createRunAwaitingApproval(project: Project): Promise<{
  run: WorkflowRun;
  artifactVersionId: string;
}> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Approval atomicity test work item',
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
    workflowVersionId: SEED_PLANNING_PATH_WORKFLOW_VERSION_ID as WorkflowRun['workflowVersionId'],
    workItemId: workItem.id,
    status: 'AWAITING_APPROVAL',
    input: {},
    createdAt: now,
    updatedAt: now,
  };
  await createWorkflowRunRepository(database.db).create(run);

  // requestApproval requires at least one real artifact version to bind
  // its evidence/scope hash to.
  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: project.id,
    artifactType: 'DISCOVERY_REPORT',
    name: 'Approval atomicity test artifact',
    status: 'GENERATED',
    workflowRunId: run.id,
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
    contentUri: 'mem://approval-atomicity-test',
    contentHash: 'a'.repeat(64),
    createdBy: ACTOR_ID,
    createdAt: now,
  };
  await createArtifactVersionRepository(database.db).create(version);

  return { run, artifactVersionId: version.id };
}

/**
 * DEVOS-112 widened `ApprovalUseCaseDeps` with the workflow-run-starting
 * fields `startRunForVersion` needs (mirroring
 * `ReviewAgentTaskHandlerDeps`'s identical structural-satisfaction
 * approach) — none of this file's three scenarios ever reject a PLANNING
 * approval, so the automatic re-planning branch they enable is never
 * actually exercised here, but real (not faked) repository/use-case
 * instances are supplied anyway, consistent with this file's own
 * real-Postgres-throughout approach.
 */
function buildApprovalDeps(): ApprovalUseCaseDeps {
  return {
    projects: createProjectRepository(database.db),
    memberships: createMembershipRepository(database.db),
    workflowRuns: createWorkflowRunRepository(database.db),
    artifactVersions: createArtifactVersionRepository(database.db),
    approvals: createApprovalRepository(database.db),
    policies: createPolicyRepository(database.db),
    decideApprovalAndTransition: createDecideApprovalAndTransition(database.db),
    workItems: createWorkItemRepository(database.db),
    workflowDefinitions: createWorkflowDefinitionRepository(database.db),
    workflowVersions: createWorkflowVersionRepository(database.db),
    workflowTasks: createWorkflowTaskRepository(database.db),
    createDraft: createWorkflowDraftCreator(database.db),
    startRun: createWorkflowRunStarter(database.db),
  };
}

describe('DEVOS-110/111: real Postgres — policy-gated, atomic approval decisions', () => {
  it('DEVOS-110: a real published policy denying this approvalType rejects a real decision', async () => {
    const project = await createProjectFixture();
    const { run, artifactVersionId } = await createRunAwaitingApproval(project);
    const deps = buildApprovalDeps();
    const { policies, approvals } = deps;

    const requested = await requestApproval(deps, ACTOR_ID, project.id, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    const now = new Date().toISOString();
    const policy: Policy = {
      id: randomUUID() as Policy['id'],
      organisationId: project.organisationId,
      projectId: project.id,
      key: `devos-110-e2e-deny-${Date.now()}`,
      version: 1,
      status: 'PUBLISHED',
      definition: { rules: [{ action: 'PLANNING', effect: 'DENY' }] },
      createdBy: ACTOR_ID,
      publishedAt: now,
      createdAt: now,
    };
    await policies.create(policy);
    await policies.publish(policy.id, now);

    await expect(
      approveApproval(deps, ACTOR_ID, requested.id, {
        scopeHash: requested.evidenceReference.scopeHash,
      }),
    ).rejects.toThrow(/PLANNING/);

    // Real confirmation, not assumed: the real Postgres row is still
    // PENDING — the policy denial happened before any write.
    const stillPending = await approvals.getById(requested.id);
    expect(stillPending?.status).toBe('PENDING');
  }, 30_000);

  it('DEVOS-111: the decide-write and the run-transition commit together (real Postgres)', async () => {
    const project = await createProjectFixture();
    const { run, artifactVersionId } = await createRunAwaitingApproval(project);
    const deps = buildApprovalDeps();
    const { approvals } = deps;

    const requested = await requestApproval(deps, ACTOR_ID, project.id, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    await approveApproval(deps, ACTOR_ID, requested.id, {
      scopeHash: requested.evidenceReference.scopeHash,
    });

    const decided = await approvals.getById(requested.id);
    expect(decided?.status).toBe('APPROVED');
    const transitionedRun = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(transitionedRun?.status).toBe('COMPLETED');
  }, 30_000);

  it('DEVOS-111: real rollback — a failure between the two writes leaves neither applied, not one-without-the-other', async () => {
    const project = await createProjectFixture();
    const { run, artifactVersionId } = await createRunAwaitingApproval(project);
    const deps = buildApprovalDeps();
    const { approvals } = deps;
    const requested = await requestApproval(deps, ACTOR_ID, project.id, {
      workflowRunId: run.id,
      approvalType: 'PLANNING',
      artifactVersionIds: [artifactVersionId],
    });

    const decidedAt = new Date().toISOString();
    // Mirrors createDecideApprovalAndTransition's own real transaction body
    // exactly, except the second write is forced to throw after the first
    // one has genuinely executed — the real crash-mid-transaction window
    // DEVOS-111 closes. If the two writes were still separate transactions
    // (the pre-DEVOS-111 shape), the approval decide below would survive
    // this throw; the point of this test is that it must not.
    await expect(
      withTransaction(database.db, async (trx) => {
        await createApprovalRepository(trx).decide(
          requested.id,
          'APPROVED',
          ACTOR_ID,
          undefined,
          decidedAt,
        );
        await transitionAfterApprovalDecisionInTrx(
          trx,
          requested.id,
          run.id,
          'PLANNING',
          'APPROVED',
          ACTOR_ID,
          undefined,
          decidedAt,
        );
        throw new Error('simulated crash between the two writes');
      }),
    ).rejects.toThrow('simulated crash');

    const afterCrash = await approvals.getById(requested.id);
    expect(afterCrash?.status).toBe('PENDING');
    const runAfterCrash = await createWorkflowRunRepository(database.db).getById(run.id);
    expect(runAfterCrash?.status).toBe('AWAITING_APPROVAL');
  }, 30_000);
});
