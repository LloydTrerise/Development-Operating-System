import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-118 — this task's own literal acceptance criterion: two real
 * `apps/api` processes sharing one real Redis instance correctly enforce
 * one *combined* rate limit, not a separate 60-per-process limit each.
 * Real spawned processes (not two `createApp()` calls in one process, and
 * not a mocked Redis client) — `REDIS_URL` set on both, pointing at the
 * real `redis` docker-compose service.
 *
 * `apps/api`'s own real mutation limit is 60 requests / 10s per principal
 * (`app.ts`, DEVOS-091's own choice, unchanged by this task). Proving
 * "shared, not per-process" means driving more than 60 real requests
 * across the two processes combined, for the *same* principal, and
 * confirming the 61st is rejected regardless of which process happens to
 * receive it — if each process enforced its own separate in-memory limit,
 * both would happily accept 60 each (120 total) instead.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
// A fresh principal per run — this test's own real requests must never
// share a rate-limit window with any other e2e file's own real HTTP calls
// against a real Redis instance that persists across test files.
const BEARER_TOKEN = `devos-118-e2e-${Date.now()}`;

interface ManagedProcess {
  child: ChildProcess;
  output: string[];
}

function spawnApi(port: number): ManagedProcess {
  const child = spawn(process.execPath, [TSX_CLI, 'src/main.ts'], {
    cwd: path.join(REPO_ROOT, 'apps/api'),
    env: { ...process.env, DATABASE_URL, REDIS_URL, PORT: String(port) },
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

async function createProject(baseUrl: string, slug: string): Promise<number> {
  const response = await fetch(`${baseUrl}/api/v1/projects`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${BEARER_TOKEN}`,
    },
    body: JSON.stringify({ name: `Rate limit test ${slug}`, slug }),
  });
  return response.status;
}

describe('DEVOS-118 real E2E — two real apps/api processes share one combined rate limit through real Redis', () => {
  let apiA: ManagedProcess;
  let apiB: ManagedProcess;
  const portA = 3930;
  const portB = 3931;
  const baseUrlA = `http://localhost:${portA}`;
  const baseUrlB = `http://localhost:${portB}`;

  beforeAll(async () => {
    await runMigrateAndSeed();

    apiA = spawnApi(portA);
    apiB = spawnApi(portB);

    try {
      await Promise.all([waitForHealth(baseUrlA, 20_000), waitForHealth(baseUrlB, 20_000)]);
    } catch (error) {
      throw new Error(
        `${(error as Error).message}\n--- api A ---\n${apiA.output.join('')}\n--- api B ---\n${apiB.output.join('')}`,
        { cause: error },
      );
    }
  }, 30_000);

  afterAll(() => {
    apiA?.child.kill();
    apiB?.child.kill();
  });

  it('a combined stream of 61 mutating requests across two processes gets rejected on the 61st, not allowed 60 per process', async () => {
    const unique = `e2e-rate-limit-redis-${Date.now()}`;

    // Alternate real requests between the two real processes — 61 total,
    // for the same real principal, sharing the real 60-per-10s limit
    // apps/api itself sets (DEVOS-091). If the limit were not truly shared,
    // both processes would independently allow all 60 of their own
    // requests (up to 120 combined) instead of rejecting the 61st.
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const baseUrl = i % 2 === 0 ? baseUrlA : baseUrlB;
      const status = await createProject(baseUrl, `${unique}-${i}`);
      statuses.push(status);
    }

    const allowed = statuses.filter((status) => status === 200).length;
    const rejected = statuses.filter((status) => status === 429).length;

    expect(allowed).toBe(60);
    expect(rejected).toBe(1);
    // The 61st real request (index 60) is the one real rejection, no
    // matter which of the two processes happens to receive it — that's
    // exactly the "shared, not per-process" behavior under test.
    expect(statuses[60]).toBe(429);
  }, 60_000);
});
