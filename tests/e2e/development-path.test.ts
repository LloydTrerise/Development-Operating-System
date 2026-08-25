import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDatabaseClient,
  createIntegrationRepository,
  SEED_DEVELOPMENT_PATH_WORKFLOW_VERSION_ID,
  SEED_PLANNING_PATH_WORKFLOW_VERSION_ID,
  SEED_PROJECT_ID,
} from '@devos/database';
import type { Integration } from '@devos/domain';
import { runGit } from '@devos/integrations';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-061: the development-path analogue of planning-path.test.ts's
 * proof — a work item runs through the real four-stage planning pipeline
 * to an approved plan (reusing DEVOS-050's own proof mechanics), then a
 * second, separate run against the newly seeded "development-path"
 * workflow (see seed-constants.ts's doc comment on
 * SEED_DEVELOPMENT_PATH_WORKFLOW_GRAPH for why this is a distinct
 * workflow/run rather than a fifth planning-path node) consumes that
 * approved plan via a project-scoped artifact lookup, applies it through
 * the Tool Gateway against a real local git repository, and opens a
 * (fake/local, per this sprint's user-authorized scoping decision) pull
 * request — proving repo-write, git-commit, and pull-request-create all
 * work end to end through the real HTTP API and a real spawned worker.
 *
 * The seeded project (SEED_PROJECT_ID) accumulates stray `Git` integration
 * rows from earlier manual live-verification sessions (DEVOS-053,
 * DEVOS-057) — `run-development-agent-task.ts` picks the first
 * `status: 'ACTIVE'` one it finds, so this test first disables any
 * pre-existing active Git integrations for the project (a real, reversible
 * fix for a real ambiguity, not just test hygiene) before registering its
 * own, pointing at a freshly created throwaway repository.
 *
 * Requires a running Postgres reachable at DATABASE_URL, matching every
 * other live-verification step in this repository's history.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const API_PORT = 3903;
const API_BASE_URL = `http://localhost:${API_PORT}`;
const BEARER_TOKEN = 'seed-user';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));

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

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
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

async function api<T>(
  method: string,
  pathname: string,
  body?: unknown,
  authenticated = true,
): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(authenticated ? { authorization: `Bearer ${BEARER_TOKEN}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const parsed = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body: parsed };
}

async function pollRunStatus(
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

let apiProcess: ManagedProcess;
let workerProcess: ManagedProcess;
let storageDir: string;
let repositoryPath: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-development-path-'));
  repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-development-path-repo-'));
  await runGit(['init'], repositoryPath);
  await runGit(['config', 'user.email', 'devos-e2e@example.com'], repositoryPath);
  await runGit(['config', 'user.name', 'DevOS E2E'], repositoryPath);
  await writeFile(path.join(repositoryPath, 'README.md'), '# e2e repo\n', 'utf8');
  await runGit(['add', 'README.md'], repositoryPath);
  await runGit(['commit', '-m', 'initial commit'], repositoryPath);

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

  // Disable any stray `ACTIVE` Git integrations left behind by earlier
  // manual live-verification sessions against this same seeded project —
  // see this file's top doc comment.
  const { db, close } = createDatabaseClient({ connectionString: DATABASE_URL });
  await db
    .updateTable('integrations')
    .set({ status: 'DISABLED', updated_at: new Date().toISOString() })
    .where('project_id', '=', SEED_PROJECT_ID)
    .where('type', '=', 'Git')
    .where('status', '=', 'ACTIVE')
    .execute();

  // DEVOS-044's own live-verification left a published policy
  // (`devos044-verify-release-approval`) with `defaultEffect: 'DENY'` and
  // no rule addressing repo-write/git-commit/pull-request-create —
  // `evaluatePolicies` (packages/policy) falls through to that blanket
  // default for any action no policy explicitly addresses, silently
  // denying every tool capability this test needs. A third instance of
  // this repository's recurring "cross-task verification-data pollution"
  // pattern (see DEVOS-SPRINT4-DECISIONS.md) — un-publishing it (not
  // deleting) keeps the row for history while removing it from active
  // evaluation.
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
    name: `DEVOS-061 e2e development-path repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'DEVOS061_E2E_TEST_CREDENTIAL',
    configuration: { repositoryPath },
    createdAt: now,
    updatedAt: now,
  };
  await createIntegrationRepository(db).create(gitIntegration);
  await close();

  const sharedEnv = {
    ...process.env,
    DATABASE_URL,
    ARTIFACT_STORAGE_DIR: storageDir,
    AGENT_MODEL_ADAPTER: 'fixture',
  };

  apiProcess = spawnApp('apps/api', { ...sharedEnv, PORT: String(API_PORT) });
  workerProcess = spawnApp('apps/worker', sharedEnv);

  try {
    await Promise.all([waitForHealth(20_000), waitForWorkerReady(workerProcess, 20_000)]);
  } catch (error) {
    throw new Error(
      `${(error as Error).message}\n--- api output ---\n${apiProcess.output.join('')}\n--- worker output ---\n${workerProcess.output.join('')}`,
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

describe('Sprint 4 development-path end-to-end (DEVOS-061)', () => {
  it('implements an approved plan through the Tool Gateway and opens a pull request', async () => {
    const unique = `e2e-development-path-${Date.now()}`;

    // Stage 1: run the real planning pipeline through to an approved plan
    // (DEVOS-038/050's exact mechanics), since the development agent
    // requires one to exist for the project.
    const planningWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      {
        title: `Add a STATUS.md file documenting project status (${unique})`,
        description:
          'The repository has no top-level status document. Add a short STATUS.md at the repository root stating the project is under active development.',
      },
    );
    expect(planningWorkItem.status).toBe(200);
    const planningWorkItemId = planningWorkItem.body.data!.id;

    const planningRun = await api<{ id: string; status: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_PLANNING_PATH_WORKFLOW_VERSION_ID}/runs`,
      { workItemId: planningWorkItemId, idempotencyKey: `${unique}-planning-run` },
    );
    expect(planningRun.status).toBe(200);
    const planningRunId = planningRun.body.data!.id;

    const planningRunResult = await pollRunStatus(
      planningRunId,
      ['AWAITING_APPROVAL', 'FAILED'],
      60_000,
    );
    expect(planningRunResult?.status).toBe('AWAITING_APPROVAL');

    const approvals = await api<
      { id: string; status: string; evidenceReference: { scopeHash: string } }[]
    >('GET', `/api/v1/runs/${planningRunId}/approvals`);
    expect(approvals.status).toBe(200);
    const approval = approvals.body.data![0]!;

    const decision = await api<{ status: string }>(
      'POST',
      `/api/v1/approvals/${approval.id}/approve`,
      { scopeHash: approval.evidenceReference.scopeHash, comment: 'Planning approved (e2e).' },
    );
    expect(decision.status).toBe(200);
    expect(decision.body.data!.status).toBe('APPROVED');

    const afterApproval = await api<{ status: string }>('GET', `/api/v1/runs/${planningRunId}`);
    expect(afterApproval.body.data!.status).toBe('COMPLETED');

    // Stage 2: a separate run against the seeded "development-path"
    // workflow, consuming the plan just approved above via a
    // project-scoped lookup (run-development-agent-task.ts), not a
    // run-scoped one — this run has no relationship to planningRunId
    // beyond sharing the same project.
    const developmentWorkItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      {
        title: `Implement: Add a STATUS.md file documenting project status (${unique})`,
        description: 'Development stage for the approved plan above.',
      },
    );
    expect(developmentWorkItem.status).toBe(200);
    const developmentWorkItemId = developmentWorkItem.body.data!.id;

    const developmentRun = await api<{ id: string; status: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_DEVELOPMENT_PATH_WORKFLOW_VERSION_ID}/runs`,
      { workItemId: developmentWorkItemId, idempotencyKey: `${unique}-development-run` },
    );
    expect(developmentRun.status).toBe(200);
    const developmentRunId = developmentRun.body.data!.id;

    const developmentRunResult = await pollRunStatus(
      developmentRunId,
      ['COMPLETED', 'FAILED'],
      60_000,
    );
    expect(developmentRunResult?.status).toBe('COMPLETED');

    // The single 'development' task succeeded.
    const tasks = await api<{ nodeId: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${developmentRunId}/tasks`,
    );
    expect(tasks.status).toBe(200);
    expect(tasks.body.data!.map((t) => t.nodeId)).toEqual(['development']);
    expect(tasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    // Tool invocations: repo-write, git-commit, and pull-request-create
    // all succeeded through the real Tool Gateway (DEVOS-052/059).
    const summaries = await api<
      { taskId: string; invocationId: string; capabilityKey: string; status: string }[]
    >('GET', `/api/v1/runs/${developmentRunId}/tool-invocation-summaries`);
    expect(summaries.status).toBe(200);
    const invocations = summaries.body.data!;
    expect(invocations.every((i) => i.status === 'SUCCEEDED')).toBe(true);
    expect(invocations.map((i) => i.capabilityKey)).toEqual(
      expect.arrayContaining(['repo-write', 'git-commit', 'pull-request-create']),
    );

    // The CODE_CHANGE artifact carries commit and pull-request evidence.
    const artifacts = await api<
      { id: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
    expect(artifacts.status).toBe(200);
    const codeChangeArtifact = artifacts.body.data!.find(
      (a) => a.provenance.workflowRunId === developmentRunId && a.type === 'CODE_CHANGE',
    );
    expect(codeChangeArtifact).toBeDefined();

    const version = await api<{ metadata: { commitSha?: string; pullRequestReference?: string } }>(
      'GET',
      `/api/v1/artifacts/${codeChangeArtifact!.id}/versions/1`,
    );
    expect(version.status).toBe(200);
    expect(typeof version.body.data!.metadata.commitSha).toBe('string');
    expect(version.body.data!.metadata.commitSha!.length).toBeGreaterThan(0);
    expect(typeof version.body.data!.metadata.pullRequestReference).toBe('string');
    expect(version.body.data!.metadata.pullRequestReference!.length).toBeGreaterThan(0);

    // Every tool invocation is independently audited (DEVOS-028's
    // universal audit requirement, extended to tool invocations by
    // DEVOS-059).
    const audit = await api<{ targetType: string; targetId: string; outcome: string }[]>(
      'GET',
      `/api/v1/projects/${SEED_PROJECT_ID}/audit`,
    );
    expect(audit.status).toBe(200);
    const invocationIds = new Set(invocations.map((i) => i.invocationId));
    const invocationRecords = audit.body.data!.filter(
      (r) => r.targetType === 'ToolInvocation' && invocationIds.has(r.targetId),
    );
    expect(invocationRecords.length).toBeGreaterThanOrEqual(invocations.length);
    expect(invocationRecords.every((r) => r.outcome === 'SUCCESS')).toBe(true);
  }, 120_000);
});
