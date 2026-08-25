import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDatabaseClient,
  createIntegrationRepository,
  SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID,
  SEED_PLANNING_PATH_WORKFLOW_VERSION_ID,
  SEED_PROJECT_ID,
  SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID,
  SEED_RELEASE_PATH_WORKFLOW_VERSION_ID,
} from '@devos/database';
import type { Integration } from '@devos/domain';
import { runGit } from '@devos/integrations';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-081 — the last task in Sprint 6, and the last task of the reference
 * Software Change Workflow's own POC Acceptance Scenario (specs/workflows/
 * software-change-workflow.md §37). Extends this repository's established
 * real-process E2E pattern one final hop past DEVOS-071 (which stopped at a
 * real "ready to release" verdict): through release approval, a real
 * deployment, post-release validation, release evidence, and closure.
 *
 * Two scenarios, each spawning its own real api+worker pair (fixture
 * sequences are fixed per worker process, mirroring DEVOS-071's own
 * two-`describe`-block precedent):
 *
 * - **"happy path, including a rework cycle, through to release and
 *   closure"**: reuses DEVOS-071's exact rework mechanism (a real
 *   CHANGES_REQUIRED review, a real reworked development attempt, a real
 *   PASS review) — satisfying both "the complete happy path" and "at least
 *   one rework cycle" in one continuous real scenario — then continues
 *   through a real release-approval gate, a real local staging deployment,
 *   a real passing health check, real release evidence, and real closure.
 * - **"a release failure is handled through the bounded, non-retryable
 *   failure path"**: a real failing health check produces `passed: false`
 *   release evidence; closure then correctly refuses to close the work
 *   item (DEVOS-078's own precondition) and — because `runClosureTask`
 *   converts that into `NonRetryableTaskError` (DEVOS-077) — the run fails
 *   immediately, on the very first attempt, rather than retrying
 *   pointlessly or silently succeeding.
 *
 * Requires a running Postgres reachable at DATABASE_URL. Carries forward
 * this sprint's own scoping decision unchanged: the deployment target is
 * real-but-local (a real git clone into a real local staging directory),
 * never a real external provider.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const BEARER_TOKEN = 'seed-user';

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

async function waitForWorkerReady(managed: ManagedProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (managed.output.some((line) => line.includes('DevOS worker ready'))) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Worker did not report ready within ${timeoutMs}ms:\n${managed.output.join('')}`);
}

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
  meta: { requestId: string };
}

function createApiClient(baseUrl: string) {
  return async function api<T>(
    method: string,
    pathname: string,
    body?: unknown,
  ): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${BEARER_TOKEN}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

async function pollRunStatus(
  api: ReturnType<typeof createApiClient>,
  runId: string,
  acceptStatuses: string[],
  timeoutMs: number,
): Promise<{ status: string; errorMessage?: string } | undefined> {
  let run: { status: string; errorMessage?: string } | undefined;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await api<{ status: string; errorMessage?: string }>(
      'GET',
      `/api/v1/runs/${runId}`,
    );
    run = result.body.data;
    if (run && acceptStatuses.includes(run.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return run;
}

async function setUpGitIntegration(
  repositoryPath: string,
  stagingRoot: string,
  healthCheckCommand: string,
): Promise<void> {
  const { db, close } = createDatabaseClient({ connectionString: DATABASE_URL });

  // Same recurring cross-task verification-data pollution pattern DEVOS-061
  // documented and fixed: disable any stray ACTIVE Git integrations and the
  // stray DEVOS-044 blanket-deny policy left over from earlier manual
  // verification sessions against this same seeded project.
  await db
    .updateTable('integrations')
    .set({ status: 'DISABLED', updated_at: new Date().toISOString() })
    .where('project_id', '=', SEED_PROJECT_ID)
    .where('type', '=', 'Git')
    .where('status', '=', 'ACTIVE')
    .execute();
  await db
    .updateTable('policies')
    .set({ status: 'DRAFT' })
    .where('project_id', '=', SEED_PROJECT_ID)
    .where('key', '=', 'devos044-verify-release-approval')
    .where('status', '=', 'PUBLISHED')
    .execute();

  const now = new Date().toISOString();
  const gitIntegration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId: SEED_PROJECT_ID as Integration['projectId'],
    type: 'Git',
    provider: 'local',
    name: `DEVOS-081 e2e repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'DEVOS081_E2E_TEST_CREDENTIAL',
    configuration: {
      repositoryPath,
      buildCommand: 'node -e "console.log(\'build ok\')"',
      testCommand: 'node -e "console.log(\'tests ok\')"',
      releaseEnvironment: 'staging',
      stagingRoot,
      healthCheckCommand,
    },
    createdAt: now,
    updatedAt: now,
  };
  await createIntegrationRepository(db).create(gitIntegration);
  await close();
}

async function createRealRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-full-workflow-repo-'));
  await runGit(['init'], repositoryPath);
  await runGit(['config', 'user.email', 'devos-e2e@example.com'], repositoryPath);
  await runGit(['config', 'user.name', 'DevOS E2E'], repositoryPath);
  await writeFile(path.join(repositoryPath, 'README.md'), '# e2e repo\n', 'utf8');
  await runGit(['add', 'README.md'], repositoryPath);
  await runGit(['commit', '-m', 'initial commit'], repositoryPath);
  return repositoryPath;
}

async function runMigrateAndSeed(): Promise<void> {
  const migrate = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'migrate'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (migrate.status !== 0) {
    throw new Error(`Migration failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }
  const seed = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'seed'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (seed.status !== 0) {
    throw new Error(`Seed failed:\n${seed.stdout}\n${seed.stderr}`);
  }
}

async function approvePlanningRun(
  api: ReturnType<typeof createApiClient>,
  workItemTitle: string,
): Promise<string> {
  const workItem = await api<{ id: string }>(
    'POST',
    `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
    {
      title: workItemTitle,
      description:
        'The repository has no top-level status document. Add a short STATUS.md at the repository root stating the project is under active development.',
    },
  );
  expect(workItem.status).toBe(200);
  const workItemId = workItem.body.data!.id;

  const planningRun = await api<{ id: string }>(
    'POST',
    `/api/v1/workflow-versions/${SEED_PLANNING_PATH_WORKFLOW_VERSION_ID}/runs`,
    { workItemId, idempotencyKey: `${workItemTitle}-planning-run` },
  );
  expect(planningRun.status).toBe(200);
  const planningRunId = planningRun.body.data!.id;

  const planningResult = await pollRunStatus(
    api,
    planningRunId,
    ['AWAITING_APPROVAL', 'FAILED'],
    60_000,
  );
  expect(planningResult?.status).toBe('AWAITING_APPROVAL');

  const approvals = await api<{ id: string; evidenceReference: { scopeHash: string } }[]>(
    'GET',
    `/api/v1/runs/${planningRunId}/approvals`,
  );
  const approval = approvals.body.data![0]!;
  const decision = await api<{ status: string }>(
    'POST',
    `/api/v1/approvals/${approval.id}/approve`,
    {
      scopeHash: approval.evidenceReference.scopeHash,
      comment: 'Planning approved (DEVOS-081 e2e).',
    },
  );
  expect(decision.body.data!.status).toBe('APPROVED');

  const afterApproval = await api<{ status: string }>('GET', `/api/v1/runs/${planningRunId}`);
  expect(afterApproval.body.data!.status).toBe('COMPLETED');

  return workItemId;
}

/** Starts a release-path v1 run (readiness check -> gate), decides its
 * RELEASE approval, and confirms the run reaches the expected terminal
 * state — the same generalized approve/reject flow `approvePlanningRun`
 * already exercises for `PLANNING`, now exercising `RELEASE` (DEVOS-073). */
async function decideReleaseApproval(
  api: ReturnType<typeof createApiClient>,
  workItemId: string,
  idempotencyKey: string,
  decision: 'approve' | 'reject',
): Promise<{ v1RunId: string; v1Status: string }> {
  const v1Run = await api<{ id: string }>(
    'POST',
    `/api/v1/workflow-versions/${SEED_RELEASE_PATH_WORKFLOW_VERSION_ID}/runs`,
    { workItemId, idempotencyKey },
  );
  expect(v1Run.status).toBe(200);
  const v1RunId = v1Run.body.data!.id;

  const readinessResult = await pollRunStatus(
    api,
    v1RunId,
    ['AWAITING_APPROVAL', 'FAILED'],
    60_000,
  );
  expect(readinessResult?.status).toBe('AWAITING_APPROVAL');

  const approvals = await api<
    { id: string; approvalType: string; evidenceReference: { scopeHash: string } }[]
  >('GET', `/api/v1/runs/${v1RunId}/approvals`);
  const releaseApproval = approvals.body.data!.find((a) => a.approvalType === 'RELEASE')!;
  expect(releaseApproval).toBeDefined();

  const decided = await api<{ status: string }>(
    'POST',
    `/api/v1/approvals/${releaseApproval.id}/${decision}`,
    {
      scopeHash: releaseApproval.evidenceReference.scopeHash,
      comment: `Release ${decision}d (DEVOS-081 e2e).`,
    },
  );
  expect(decided.body.data!.status).toBe(decision === 'approve' ? 'APPROVED' : 'REJECTED');

  const afterDecision = await api<{ status: string }>('GET', `/api/v1/runs/${v1RunId}`);
  return { v1RunId, v1Status: afterDecision.body.data!.status };
}

describe('Sprint 6 full happy path E2E (DEVOS-081) — rework, release, and closure', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  let storageDir: string;
  let repositoryPath: string;
  let stagingRoot: string;
  const apiPort = 3908;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-full-workflow-happy-'));
    repositoryPath = await createRealRepository();
    stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-e2e-full-workflow-happy-staging-'));

    await runMigrateAndSeed();
    await setUpGitIntegration(
      repositoryPath,
      stagingRoot,
      process.platform === 'win32' ? 'cd' : 'pwd',
    );

    const sharedEnv = {
      ...process.env,
      DATABASE_URL,
      ARTIFACT_STORAGE_DIR: storageDir,
      AGENT_MODEL_ADAPTER: 'fixture',
      // Same DEVOS-071 rework sequence: a real CHANGES_REQUIRED review, a
      // real reworked development attempt that actually addresses the
      // findings, then a real PASS review.
      DEVELOPMENT_FIXTURE_SEQUENCE: 'developer-v1,developer-reworked-v1',
      REVIEW_FIXTURE_SEQUENCE: 'review-changes-required-v1,review-v1',
    };
    apiProcess = spawnApp('apps/api', { ...sharedEnv, PORT: String(apiPort) });
    workerProcess = spawnApp('apps/worker', sharedEnv);

    try {
      await Promise.all([
        waitForHealth(baseUrl, 20_000),
        waitForWorkerReady(workerProcess, 20_000),
      ]);
    } catch (error) {
      throw new Error(
        `${(error as Error).message}\n--- api ---\n${apiProcess.output.join('')}\n--- worker ---\n${workerProcess.output.join('')}`,
        { cause: error },
      );
    }
  }, 60_000);

  afterAll(async () => {
    apiProcess?.child.kill();
    workerProcess?.child.kill();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
    if (repositoryPath) await rm(repositoryPath, { recursive: true, force: true });
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
  });

  it('goes work item -> planning approval -> development (with a real rework cycle) -> release approval -> release -> closure', async () => {
    const unique = `e2e-full-workflow-happy-${Date.now()}`;
    await approvePlanningRun(api, `Add a STATUS.md file documenting project status (${unique})`);

    const developmentWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      { title: `Implement (${unique})`, description: 'Development stage for the approved plan.' },
    );
    const workItemId = developmentWorkItem.body.data!.id;

    const firstRun = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId, idempotencyKey: `${unique}-development-run-1` },
    );
    expect(firstRun.status).toBe(200);
    const firstRunId = firstRun.body.data!.id;

    const firstResult = await pollRunStatus(api, firstRunId, ['COMPLETED', 'FAILED'], 90_000);
    expect(firstResult?.status).toBe('COMPLETED');

    // DEVOS-080: closes the exact gap DEVOS-071's own scratch DB query
    // worked around — the work item's runs are now a real, documented API.
    let reworkRunId: string | undefined;
    const reworkDeadline = Date.now() + 20_000;
    while (Date.now() < reworkDeadline && !reworkRunId) {
      const runsForWorkItem = await api<{ id: string }[]>(
        'GET',
        `/api/v1/work-items/${workItemId}/workflow-runs`,
      );
      const other = runsForWorkItem.body.data!.find((r) => r.id !== firstRunId);
      if (other) reworkRunId = other.id;
      else await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(reworkRunId).toBeDefined();

    const reworkResult = await pollRunStatus(api, reworkRunId!, ['COMPLETED', 'FAILED'], 90_000);
    expect(reworkResult?.status).toBe('COMPLETED');

    const reworkReviewVersion = await (async () => {
      const artifacts = await api<
        { id: string; type: string; provenance: { workflowRunId?: string } }[]
      >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
      const reviewArtifact = artifacts.body.data!.find(
        (a) => a.provenance.workflowRunId === reworkRunId && a.type === 'REVIEW_EVIDENCE',
      )!;
      return api<{ metadata: { decision?: string } }>(
        'GET',
        `/api/v1/artifacts/${reviewArtifact.id}/versions/1`,
      );
    })();
    expect(reworkReviewVersion.body.data!.metadata.decision).toBe('PASS');

    // --- Release approval, real deployment, closure ---
    const { v1RunId, v1Status } = await decideReleaseApproval(
      api,
      workItemId,
      `${unique}-release-v1`,
      'approve',
    );
    expect(v1Status).toBe('COMPLETED');

    const v2Run = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId, idempotencyKey: `${unique}-release-v2` },
    );
    expect(v2Run.status).toBe(200);
    const v2RunId = v2Run.body.data!.id;

    const v2Result = await pollRunStatus(api, v2RunId, ['COMPLETED', 'FAILED'], 60_000);
    expect(v2Result?.status).toBe('COMPLETED');

    const v2Tasks = await api<{ nodeId: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${v2RunId}/tasks`,
    );
    expect(v2Tasks.body.data!.map((t) => t.nodeId)).toEqual(['release', 'closure']);
    expect(v2Tasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    const releaseEvidence = await (async () => {
      const artifacts = await api<
        { id: string; type: string; provenance: { workflowRunId?: string } }[]
      >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
      const artifact = artifacts.body.data!.find(
        (a) => a.provenance.workflowRunId === v2RunId && a.type === 'RELEASE_EVIDENCE',
      )!;
      return api<{ metadata: { passed?: boolean; revision?: string } }>(
        'GET',
        `/api/v1/artifacts/${artifact.id}/versions/1`,
      );
    })();
    expect(releaseEvidence.body.data!.metadata.passed).toBe(true);

    const finalWorkItem = await api<{ status: string }>('GET', `/api/v1/work-items/${workItemId}`);
    expect(finalWorkItem.body.data!.status).toBe('CLOSED');

    const runsForWorkItem = await api<{ id: string }[]>(
      'GET',
      `/api/v1/work-items/${workItemId}/workflow-runs`,
    );
    expect(runsForWorkItem.body.data!.map((r) => r.id)).toEqual(
      expect.arrayContaining([firstRunId, reworkRunId, v1RunId, v2RunId]),
    );
  }, 180_000);
});

describe('Sprint 6 release failure E2E (DEVOS-081) — bounded, non-retryable failure path', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  let storageDir: string;
  let repositoryPath: string;
  let stagingRoot: string;
  const apiPort = 3909;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-full-workflow-failure-'));
    repositoryPath = await createRealRepository();
    stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-e2e-full-workflow-failure-staging-'));

    await runMigrateAndSeed();
    // A real command that always fails — the real post-release health
    // check for this scenario genuinely does not pass.
    await setUpGitIntegration(
      repositoryPath,
      stagingRoot,
      'node -e "console.error(\'unhealthy\'); process.exit(1)"',
    );

    const sharedEnv = {
      ...process.env,
      DATABASE_URL,
      ARTIFACT_STORAGE_DIR: storageDir,
      AGENT_MODEL_ADAPTER: 'fixture',
    };
    apiProcess = spawnApp('apps/api', { ...sharedEnv, PORT: String(apiPort) });
    workerProcess = spawnApp('apps/worker', sharedEnv);

    try {
      await Promise.all([
        waitForHealth(baseUrl, 20_000),
        waitForWorkerReady(workerProcess, 20_000),
      ]);
    } catch (error) {
      throw new Error(
        `${(error as Error).message}\n--- api ---\n${apiProcess.output.join('')}\n--- worker ---\n${workerProcess.output.join('')}`,
        { cause: error },
      );
    }
  }, 60_000);

  afterAll(async () => {
    apiProcess?.child.kill();
    workerProcess?.child.kill();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
    if (repositoryPath) await rm(repositoryPath, { recursive: true, force: true });
    if (stagingRoot) await rm(stagingRoot, { recursive: true, force: true });
  });

  it('a failing post-release health check stops closure and fails the run on the first attempt, without retrying or silently succeeding', async () => {
    const unique = `e2e-full-workflow-failure-${Date.now()}`;
    await approvePlanningRun(api, `Add a STATUS.md file documenting project status (${unique})`);

    const developmentWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      { title: `Implement (${unique})`, description: 'Development stage for the approved plan.' },
    );
    const workItemId = developmentWorkItem.body.data!.id;

    const developmentRun = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId, idempotencyKey: `${unique}-development-run` },
    );
    const developmentResult = await pollRunStatus(
      api,
      developmentRun.body.data!.id,
      ['COMPLETED', 'FAILED'],
      90_000,
    );
    expect(developmentResult?.status).toBe('COMPLETED');

    const { v1Status } = await decideReleaseApproval(
      api,
      workItemId,
      `${unique}-release-v1`,
      'approve',
    );
    expect(v1Status).toBe('COMPLETED');

    const v2Run = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_RELEASE_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId, idempotencyKey: `${unique}-release-v2` },
    );
    expect(v2Run.status).toBe(200);
    const v2RunId = v2Run.body.data!.id;

    // The failure surfaces quickly (a non-retryable task failure is never
    // retried) — a much shorter timeout than the happy path's own would
    // itself be evidence of a bug if this ever legitimately took as long.
    const v2Result = await pollRunStatus(api, v2RunId, ['COMPLETED', 'FAILED'], 30_000);
    expect(v2Result?.status).toBe('FAILED');

    const v2Tasks = await api<
      { nodeId: string; status: string; attempt: number; error: string | null }[]
    >('GET', `/api/v1/runs/${v2RunId}/tasks`);
    const releaseTask = v2Tasks.body.data!.find((t) => t.nodeId === 'release')!;
    const closureTask = v2Tasks.body.data!.find((t) => t.nodeId === 'closure')!;
    expect(releaseTask.status).toBe('SUCCEEDED');
    expect(closureTask.status).toBe('FAILED');
    // DEVOS-077: NonRetryableTaskError means the dispatcher never retries
    // — exactly one attempt, not the generic MAX_TASK_ATTEMPTS (3).
    expect(closureTask.attempt).toBe(1);

    const releaseEvidence = await (async () => {
      const artifacts = await api<
        { id: string; type: string; provenance: { workflowRunId?: string } }[]
      >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
      const artifact = artifacts.body.data!.find(
        (a) => a.provenance.workflowRunId === v2RunId && a.type === 'RELEASE_EVIDENCE',
      )!;
      return api<{ metadata: { passed?: boolean } }>(
        'GET',
        `/api/v1/artifacts/${artifact.id}/versions/1`,
      );
    })();
    expect(releaseEvidence.body.data!.metadata.passed).toBe(false);

    // The work item must never have been silently marked complete.
    const finalWorkItem = await api<{ status: string }>('GET', `/api/v1/work-items/${workItemId}`);
    expect(finalWorkItem.body.data!.status).not.toBe('CLOSED');
  }, 150_000);
});
