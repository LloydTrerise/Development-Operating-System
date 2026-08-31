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
  SEED_RELEASE_PATH_WORKFLOW_V3_VERSION_ID,
} from '@devos/database';
import type { Integration } from '@devos/domain';
import { runGit } from '@devos/integrations';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-071 — the last task in Sprint 5. Extends this repository's
 * established real-process E2E pattern (`tests/e2e/planning-path.test.ts`,
 * `tests/e2e/development-path.test.ts`) with the two scenarios the source
 * backlog names explicitly:
 *
 * - a straight-through **pass path**: development -> validation (real
 *   build/test commands) -> review, all real, all succeeding, ending in a
 *   real "ready to release" verdict;
 * - a **rework path**: review returns `CHANGES_REQUIRED` (a real recorded
 *   Gemini fixture, `review-changes-required-v1` — DEVOS-071's own, since
 *   the review agent's decision is entirely fixture-determined and can't
 *   react to input), DEVOS-067's automatic rework trigger starts a new
 *   development-path run for the same work item, and that run's own
 *   review — a second fixture in the same sequence, `review-v1` — passes,
 *   proving the rework loop actually *closes*, not just that it triggers
 *   once. This also live-verifies DEVOS-067's `createBranch` fix (the
 *   reworked attempt reuses the same branch name the fixture always
 *   proposes, which failed to push before that fix).
 *
 * Two separate `describe` blocks, each spawning its own real api+worker
 * pair (the review agent's fixture sequence is fixed per worker process,
 * so the two scenarios can't share one). Carries forward Sprint 4's
 * scoping decision unchanged: build/test commands run for real, locally;
 * git/PR operations remain against the fake/local provider and a real
 * local repository, no real GitHub API calls.
 *
 * Requires a running Postgres reachable at DATABASE_URL.
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
  buildCommand: string,
  testCommand: string,
  // DEVOS-113: a real, always-passing command — this file's own scope
  // (build/test/review, DEVOS-071) never exercises a genuinely failing scan.
  securityScanCommand = 'node -e "console.log(\'scan ok\')"',
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
    name: `DEVOS-071 e2e build/test/review repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'DEVOS071_E2E_TEST_CREDENTIAL',
    configuration: { repositoryPath, buildCommand, testCommand, securityScanCommand },
    createdAt: now,
    updatedAt: now,
  };
  await createIntegrationRepository(db).create(gitIntegration);
  await close();
}

async function createRealRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-build-test-review-repo-'));
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

/**
 * DEVOS-113: `evaluateReleaseReadiness` now also requires real
 * `SECURITY_SCAN_EVIDENCE`, which only the release-path v3 graph's
 * `security-scan` node produces. This file's own release-readiness
 * assertions (below) predate that stage, so each now runs a real v3 run
 * first — genuinely executing `runSecurityScanTask` against the same real
 * repository/Git integration this file already sets up — before checking
 * the project-scoped `/release-readiness` endpoint.
 */
async function runSecurityScan(
  api: ReturnType<typeof createApiClient>,
  workItemId: string,
  idempotencyKey: string,
): Promise<void> {
  const run = await api<{ id: string }>(
    'POST',
    `/api/v1/workflow-versions/${SEED_RELEASE_PATH_WORKFLOW_V3_VERSION_ID}/runs`,
    { workItemId, idempotencyKey },
  );
  expect(run.status).toBe(200);
  const runId = run.body.data!.id;

  const result = await pollRunStatus(api, runId, ['AWAITING_APPROVAL', 'FAILED'], 60_000);
  expect(result?.status).toBe('AWAITING_APPROVAL');
}

async function approvePlanningRun(
  api: ReturnType<typeof createApiClient>,
  workItemTitle: string,
): Promise<void> {
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
      comment: 'Planning approved (DEVOS-071 e2e).',
    },
  );
  expect(decision.body.data!.status).toBe('APPROVED');

  const afterApproval = await api<{ status: string }>('GET', `/api/v1/runs/${planningRunId}`);
  expect(afterApproval.body.data!.status).toBe('COMPLETED');
}

describe('Sprint 5 build/test/review end-to-end (DEVOS-071) — pass path', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  let storageDir: string;
  let repositoryPath: string;
  const apiPort = 3904;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-build-test-review-pass-'));
    repositoryPath = await createRealRepository();

    await runMigrateAndSeed();

    await setUpGitIntegration(
      repositoryPath,
      'node -e "console.log(\'build ok\')"',
      'node -e "console.log(\'tests ok\')"',
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
  });

  it('runs development -> validation -> review, all passing, ending in a real ready-to-release verdict', async () => {
    const unique = `e2e-build-test-review-pass-${Date.now()}`;
    await approvePlanningRun(api, `Add a STATUS.md file documenting project status (${unique})`);

    const developmentWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      { title: `Implement (${unique})`, description: 'Development stage for the approved plan.' },
    );
    const developmentWorkItemId = developmentWorkItem.body.data!.id;

    const developmentRun = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId: developmentWorkItemId, idempotencyKey: `${unique}-development-run` },
    );
    expect(developmentRun.status).toBe(200);
    const runId = developmentRun.body.data!.id;

    const result = await pollRunStatus(api, runId, ['COMPLETED', 'FAILED'], 90_000);
    expect(result?.status).toBe('COMPLETED');

    const tasks = await api<{ nodeId: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${runId}/tasks`,
    );
    expect(tasks.body.data!.map((t) => t.nodeId)).toEqual(['development', 'validation', 'review']);
    expect(tasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    const summaries = await api<{ capabilityKey: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${runId}/tool-invocation-summaries`,
    );
    expect(summaries.body.data!.every((s) => s.status === 'SUCCEEDED')).toBe(true);
    expect(summaries.body.data!.map((s) => s.capabilityKey)).toEqual(
      expect.arrayContaining([
        'repo-write',
        'git-commit',
        'pull-request-create',
        'build-run',
        'test-run',
      ]),
    );

    const artifacts = await api<
      { id: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
    const runArtifacts = artifacts.body.data!.filter((a) => a.provenance.workflowRunId === runId);

    const testEvidenceArtifact = runArtifacts.find((a) => a.type === 'TEST_EVIDENCE')!;
    expect(testEvidenceArtifact).toBeDefined();
    const testEvidenceVersion = await api<{ metadata: { passed?: boolean } }>(
      'GET',
      `/api/v1/artifacts/${testEvidenceArtifact.id}/versions/1`,
    );
    expect(testEvidenceVersion.body.data!.metadata.passed).toBe(true);

    const reviewEvidenceArtifact = runArtifacts.find((a) => a.type === 'REVIEW_EVIDENCE')!;
    expect(reviewEvidenceArtifact).toBeDefined();
    const reviewEvidenceVersion = await api<{ metadata: { decision?: string } }>(
      'GET',
      `/api/v1/artifacts/${reviewEvidenceArtifact.id}/versions/1`,
    );
    expect(reviewEvidenceVersion.body.data!.metadata.decision).toBe('PASS');

    await runSecurityScan(api, developmentWorkItemId, `${unique}-security-scan`);

    const readiness = await api<{ ready: boolean; reasons: string[] }>(
      'GET',
      `/api/v1/projects/${SEED_PROJECT_ID}/release-readiness`,
    );
    expect(readiness.body.data).toMatchObject({ ready: true, reasons: [] });
  }, 120_000);
});

describe('Sprint 5 build/test/review end-to-end (DEVOS-071) — rework path', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  let storageDir: string;
  let repositoryPath: string;
  const apiPort = 3905;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-build-test-review-rework-'));
    repositoryPath = await createRealRepository();

    await runMigrateAndSeed();

    await setUpGitIntegration(
      repositoryPath,
      'node -e "console.log(\'build ok\')"',
      'node -e "console.log(\'tests ok\')"',
    );

    const sharedEnv = {
      ...process.env,
      DATABASE_URL,
      ARTIFACT_STORAGE_DIR: storageDir,
      AGENT_MODEL_ADAPTER: 'fixture',
      // The first review consumes 'review-changes-required-v1' (a real
      // recorded CHANGES_REQUIRED decision); the reworked attempt's review
      // consumes 'review-v1' (PASS) — see main.ts's own doc comment. The
      // reworked development attempt must also use a *different* fixture
      // ('developer-reworked-v1', a real recorded response that actually
      // addresses the findings with non-empty content) — the original
      // 'developer-v1' fixture proposes an empty STATUS.md, and proposing
      // the exact same (empty) content again on the resumed branch would
      // leave nothing for `git commit` to commit.
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
  });

  it('a CHANGES_REQUIRED review automatically starts a new development cycle, which then passes', async () => {
    const unique = `e2e-build-test-review-rework-${Date.now()}`;
    await approvePlanningRun(api, `Add a STATUS.md file documenting project status (${unique})`);

    const developmentWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      { title: `Implement (${unique})`, description: 'Development stage for the approved plan.' },
    );
    const developmentWorkItemId = developmentWorkItem.body.data!.id;

    const firstRun = await api<{ id: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_DEVELOPMENT_PATH_WORKFLOW_V2_VERSION_ID}/runs`,
      { workItemId: developmentWorkItemId, idempotencyKey: `${unique}-development-run-1` },
    );
    expect(firstRun.status).toBe(200);
    const firstRunId = firstRun.body.data!.id;

    const firstResult = await pollRunStatus(api, firstRunId, ['COMPLETED', 'FAILED'], 90_000);
    expect(firstResult?.status).toBe('COMPLETED');

    const firstArtifacts = await api<
      { id: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
    const firstRunReview = firstArtifacts.body.data!.find(
      (a) => a.provenance.workflowRunId === firstRunId && a.type === 'REVIEW_EVIDENCE',
    )!;
    expect(firstRunReview).toBeDefined();
    const firstReviewVersion = await api<{
      metadata: { decision?: string; findings?: { severity: string }[] };
    }>('GET', `/api/v1/artifacts/${firstRunReview.id}/versions/1`);
    expect(firstReviewVersion.body.data!.metadata.decision).toBe('CHANGES_REQUIRED');
    expect(
      firstReviewVersion.body.data!.metadata.findings!.some((f) => f.severity === 'BLOCKER'),
    ).toBe(true);

    // DEVOS-067: no API exists to list a work item's runs — the review
    // task's own return value (`reworkRunId`) isn't exposed over HTTP
    // either (workflow_tasks.output has no read route). A direct query is
    // the only way to find the automatically-created rework run.
    const { db, close } = createDatabaseClient({ connectionString: DATABASE_URL });
    let reworkRunId: string | undefined;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && !reworkRunId) {
      const runs = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('work_item_id', '=', developmentWorkItemId)
        .where('id', '!=', firstRunId)
        .execute();
      if (runs.length > 0) reworkRunId = runs[0]!.id;
      else await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await close();
    expect(reworkRunId).toBeDefined();

    const reworkResult = await pollRunStatus(api, reworkRunId!, ['COMPLETED', 'FAILED'], 90_000);
    expect(reworkResult?.status).toBe('COMPLETED');

    const reworkTasks = await api<{ nodeId: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${reworkRunId}/tasks`,
    );
    expect(reworkTasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    const reworkArtifacts = await api<
      { id: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
    const reworkReview = reworkArtifacts.body.data!.find(
      (a) => a.provenance.workflowRunId === reworkRunId && a.type === 'REVIEW_EVIDENCE',
    )!;
    expect(reworkReview).toBeDefined();
    const reworkReviewVersion = await api<{ metadata: { decision?: string } }>(
      'GET',
      `/api/v1/artifacts/${reworkReview.id}/versions/1`,
    );
    expect(reworkReviewVersion.body.data!.metadata.decision).toBe('PASS');

    await runSecurityScan(api, developmentWorkItemId, `${unique}-security-scan`);

    // The evaluator is project-scoped and picks the *latest* evidence —
    // by now that's the reworked (passing) cycle's, not the first
    // (rejected) one.
    const readiness = await api<{ ready: boolean }>(
      'GET',
      `/api/v1/projects/${SEED_PROJECT_ID}/release-readiness`,
    );
    expect(readiness.body.data!.ready).toBe(true);

    // Well under the configured 2-automatic-rework-cycle limit — the work
    // item must not have been escalated.
    const workItem = await api<{ status: string }>(
      'GET',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
    );
    const thisWorkItem = workItem.body.data
      ? (workItem.body.data as unknown as { id: string; status: string }[]).find(
          (w) => w.id === developmentWorkItemId,
        )
      : undefined;
    expect(thisWorkItem?.status).not.toBe('REWORK_LIMIT_REACHED');
  }, 150_000);
});
