import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-021 — automated proof that the entire Sprint 1 control loop works
 * against real infrastructure: real Postgres, a real (spawned) API process,
 * a real (spawned) worker process, driven purely through the public HTTP
 * API (no reaching into package internals), covering every noun in the
 * task's acceptance scope: user (bearer principal + auth enforcement),
 * project, work item, workflow run, worker execution, artifact, task
 * completion, and audit events.
 *
 * Requires a running Postgres reachable at DATABASE_URL (see
 * infrastructure/docker/docker-compose.yml) — this test does not start
 * Postgres itself, matching every other live-verification step in this
 * repository's history.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const API_PORT = 3901;
const API_BASE_URL = `http://localhost:${API_PORT}`;
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const BEARER_TOKEN = 'seed-user';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));

const WORKFLOW_GRAPH = {
  name: 'E2E Vertical Slice',
  description: 'DEVOS-021 automated proof workflow: a single deterministic discovery task.',
  trigger: { type: 'WORK_ITEM_MANUAL' },
  inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
  nodes: [{ id: 'discovery', type: 'TASK', name: 'Discovery' }],
  edges: [],
  policies: [],
  outputs: [],
};

interface ManagedProcess {
  child: ChildProcess;
  output: string[];
}

function spawnApp(appDir: string, env: NodeJS.ProcessEnv): ManagedProcess {
  // Invoke tsx directly via `node <tsx-cli>` rather than through `pnpm dev`/a
  // shell — spawning .cmd shims via child_process on Windows requires
  // shell:true, which wraps the child in a cmd.exe process that child.kill()
  // does not reliably tear down (a real zombie-process risk this repo has
  // hit before with tsx watch processes). This keeps the spawned process
  // directly killable and avoids depending on a shell at all.
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

let apiProcess: ManagedProcess;
let workerProcess: ManagedProcess;
let storageDir: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-artifacts-'));

  const migrate = spawnSync(PNPM_CMD, ['--filter', '@devos/database', 'run', 'migrate'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (migrate.status !== 0) {
    throw new Error(`Migration failed:\n${migrate.stdout}\n${migrate.stderr}`);
  }

  const sharedEnv = { ...process.env, DATABASE_URL, ARTIFACT_STORAGE_DIR: storageDir };

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
}, 30_000);

afterAll(async () => {
  apiProcess?.child.kill();
  workerProcess?.child.kill();
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

describe('Sprint 1 end-to-end control loop', () => {
  it('runs project → work item → workflow → run → worker → artifact → audit', async () => {
    const unique = `e2e-${Date.now()}`;

    // Unauthenticated access to a protected route is rejected — proves the
    // "user"/identity dimension is enforced, not just accepted.
    const unauthenticated = await api('GET', '/api/v1/projects', undefined, false);
    expect(unauthenticated.status).toBe(401);

    // Project
    const project = await api<{ id: string }>('POST', '/api/v1/projects', {
      name: `E2E Project ${unique}`,
      slug: unique,
    });
    expect(project.status).toBe(200);
    const projectId = project.body.data!.id;

    // Work item
    const workItem = await api<{ id: string }>('POST', `/api/v1/projects/${projectId}/work-items`, {
      title: 'E2E discovery target',
    });
    expect(workItem.status).toBe(200);
    const workItemId = workItem.body.data!.id;

    // Workflow: create draft, publish
    const workflow = await api<{ id: string }>('POST', `/api/v1/projects/${projectId}/workflows`, {
      key: unique,
      name: 'E2E Vertical Slice',
      definition: WORKFLOW_GRAPH,
    });
    expect(workflow.status).toBe(200);
    const workflowId = workflow.body.data!.id;

    const published = await api<{ status: string }>(
      'POST',
      `/api/v1/workflows/${workflowId}/publish`,
    );
    expect(published.status).toBe(200);
    expect(published.body.data!.status).toBe('PUBLISHED');

    // Run
    const started = await api<{ id: string; status: string }>(
      'POST',
      `/api/v1/workflows/${workflowId}/runs`,
      { workItemId, idempotencyKey: `${unique}-run` },
    );
    expect(started.status).toBe(200);
    const runId = started.body.data!.id;
    expect(started.body.data!.status).toBe('PENDING');

    // Worker execution — poll until terminal.
    let run: { status: string; errorMessage?: string } | undefined;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const result = await api<{ status: string; errorMessage?: string }>(
        'GET',
        `/api/v1/runs/${runId}`,
      );
      run = result.body.data;
      if (run && ['COMPLETED', 'FAILED'].includes(run.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(run?.status).toBe('COMPLETED');

    // Task completion
    const tasks = await api<{ status: string; type: string }[]>(
      'GET',
      `/api/v1/runs/${runId}/tasks`,
    );
    expect(tasks.status).toBe(200);
    expect(tasks.body.data).toHaveLength(1);
    expect(tasks.body.data![0]!.status).toBe('SUCCEEDED');

    // Artifact
    const artifacts = await api<
      { name: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${projectId}/artifacts`);
    expect(artifacts.status).toBe(200);
    const runArtifact = artifacts.body.data!.find((a) => a.provenance.workflowRunId === runId);
    expect(runArtifact).toBeDefined();
    expect(runArtifact!.type).toBe('DISCOVERY_REPORT');

    // Audit events
    const audit = await api<{ action: string; actorType: string; outcome: string }[]>(
      'GET',
      `/api/v1/projects/${projectId}/audit`,
    );
    expect(audit.status).toBe(200);
    const actions = audit.body.data!.map((record) => record.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'workflow_run.started',
        'workflow_task.completed',
        'artifact.created',
        'workflow_run.completed',
      ]),
    );
    expect(audit.body.data!.every((record) => record.outcome === 'SUCCESS')).toBe(true);
  }, 25_000);
});
