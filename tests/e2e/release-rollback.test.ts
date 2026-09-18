import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDatabaseClient,
  createIntegrationRepository,
  SEED_PROJECT_ID,
  SEED_RELEASE_ROLLBACK_WORKFLOW_DEFINITION_ID,
} from '@devos/database';
import type { Integration } from '@devos/domain';
import { runGit } from '@devos/integrations';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-114 — real, end-to-end verification of the trigger this task wires:
 * a real `POST /api/v1/workflows/:id/runs` call against the real seeded
 * `release-rollback` workflow (`SEED_RELEASE_ROLLBACK_WORKFLOW_DEFINITION_ID`)
 * reaches the real `apps/worker` task dispatcher, which routes the real
 * `rollback` TOOL_TASK to `runReleaseRollbackTask` — the same real path
 * `apps/web`'s "Roll back" UI action (`RunsPage.tsx`) now drives, not a
 * direct function call or test-only invocation, matching this task's own
 * acceptance criterion.
 *
 * Deliberately self-contained (no planning/development/review stages, no
 * Gemini dependency): a rollback's own real mechanics only need a
 * `Deployment`-target-capable Git integration and a real prior revision to
 * roll back to, both set up directly here — `performRelease`'s rollback
 * branch (`packages/application/src/tasks/run-release-task.ts`) never reads
 * a `CODE_CHANGE` artifact at all, unlike a fresh release.
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

async function setUpDeploymentGitIntegration(
  repositoryPath: string,
  stagingRoot: string,
): Promise<void> {
  const { db, close } = createDatabaseClient({ connectionString: DATABASE_URL });

  // Same recurring cross-task verification-data pollution pattern earlier
  // e2e files already document and fix.
  await db
    .updateTable('integrations')
    .set({ status: 'DISABLED', updated_at: new Date().toISOString() })
    .where('project_id', '=', SEED_PROJECT_ID)
    .where('type', '=', 'Git')
    .where('status', '=', 'ACTIVE')
    .execute();

  const now = new Date().toISOString();
  const gitIntegration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId: SEED_PROJECT_ID as Integration['projectId'],
    type: 'Git',
    provider: 'local',
    name: `DEVOS-114 e2e repository (${Date.now()})`,
    status: 'ACTIVE',
    credentialReference: 'DEVOS114_E2E_TEST_CREDENTIAL',
    configuration: {
      repositoryPath,
      releaseEnvironment: 'staging',
      stagingRoot,
      healthCheckCommand: process.platform === 'win32' ? 'cd' : 'pwd',
    },
    createdAt: now,
    updatedAt: now,
  };
  await createIntegrationRepository(db).create(gitIntegration);
  await close();
}

/** Two real commits, so there's a real, earlier revision to roll back to. */
async function createRealRepositoryWithTwoCommits(): Promise<{
  repositoryPath: string;
  firstRevision: string;
  secondRevision: string;
}> {
  const repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-e2e-release-rollback-repo-'));
  await runGit(['init'], repositoryPath);
  await runGit(['config', 'user.email', 'devos-e2e@example.com'], repositoryPath);
  await runGit(['config', 'user.name', 'DevOS E2E'], repositoryPath);
  await writeFile(path.join(repositoryPath, 'STATUS.md'), '# v1\n', 'utf8');
  await runGit(['add', 'STATUS.md'], repositoryPath);
  await runGit(['commit', '-m', 'v1'], repositoryPath);
  const first = await runGit(['rev-parse', 'HEAD'], repositoryPath);

  await writeFile(path.join(repositoryPath, 'STATUS.md'), '# v2 (broken)\n', 'utf8');
  await runGit(['add', 'STATUS.md'], repositoryPath);
  await runGit(['commit', '-m', 'v2'], repositoryPath);
  const second = await runGit(['rev-parse', 'HEAD'], repositoryPath);

  return {
    repositoryPath,
    firstRevision: first.stdout.trim(),
    secondRevision: second.stdout.trim(),
  };
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

describe('DEVOS-114 real E2E — a real rollback reachable through the real workflow-run trigger', () => {
  let apiProcess: ManagedProcess;
  let workerProcess: ManagedProcess;
  let storageDir: string;
  let repositoryPath: string;
  let stagingRoot: string;
  let firstRevision: string;
  let secondRevision: string;
  const apiPort = 3910;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-release-rollback-'));
    stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-e2e-release-rollback-staging-'));
    const repo = await createRealRepositoryWithTwoCommits();
    repositoryPath = repo.repositoryPath;
    firstRevision = repo.firstRevision;
    secondRevision = repo.secondRevision;

    await runMigrateAndSeed();
    await setUpDeploymentGitIntegration(repositoryPath, stagingRoot);

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

  it('a real, authorized rollback deploys the requested earlier revision and records real RELEASE_EVIDENCE (action: rollback)', async () => {
    const unique = `e2e-release-rollback-${Date.now()}`;

    const workItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      {
        title: `Rollback test (${unique})`,
        description: 'A real deploy went out broken; roll it back to the prior revision.',
      },
    );
    expect(workItem.status).toBe(200);
    const workItemId = workItem.body.data!.id;

    // The real trigger this task wires: POST /workflows/:id/runs against
    // the real seeded `release-rollback` workflow — exactly what
    // `apps/web`'s "Roll back" UI action now calls, not a direct function
    // call or test-only invocation of `runReleaseRollbackTask` itself.
    const run = await api<{ id: string }>(
      'POST',
      `/api/v1/workflows/${SEED_RELEASE_ROLLBACK_WORKFLOW_DEFINITION_ID}/runs`,
      {
        workItemId,
        inputs: { rollbackToRevision: firstRevision },
        idempotencyKey: `${unique}-rollback`,
      },
    );
    expect(run.status).toBe(200);
    const runId = run.body.data!.id;

    const result = await pollRunStatus(api, runId, ['COMPLETED', 'FAILED'], 60_000);
    expect(result?.status).toBe('COMPLETED');

    const tasks = await api<{ nodeId: string; status: string }[]>(
      'GET',
      `/api/v1/runs/${runId}/tasks`,
    );
    expect(tasks.body.data!.map((t) => t.nodeId)).toEqual(['rollback']);
    expect(tasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    const releaseEvidence = await (async () => {
      const artifacts = await api<
        { id: string; type: string; provenance: { workflowRunId?: string } }[]
      >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
      const artifact = artifacts.body.data!.find(
        (a) => a.provenance.workflowRunId === runId && a.type === 'RELEASE_EVIDENCE',
      )!;
      return api<{ metadata: { action?: string; revision?: string; passed?: boolean } }>(
        'GET',
        `/api/v1/artifacts/${artifact.id}/versions/1`,
      );
    })();
    expect(releaseEvidence.body.data!.metadata.action).toBe('rollback');
    expect(releaseEvidence.body.data!.metadata.revision).toBe(firstRevision);
    expect(releaseEvidence.body.data!.metadata.passed).toBe(true);

    // Real confirmation, not assumed: the real staging directory's own HEAD
    // is genuinely checked out at the earlier revision, not the broken one.
    const deployedHead = await runGit(['rev-parse', 'HEAD'], path.join(stagingRoot, 'staging'));
    expect(deployedHead.stdout.trim()).toBe(firstRevision);
    expect(deployedHead.stdout.trim()).not.toBe(secondRevision);
    const statusContent = await readFile(path.join(stagingRoot, 'staging', 'STATUS.md'), 'utf8');
    expect(statusContent).toContain('v1');
  }, 90_000);
});
