import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-115 — real, end-to-end verification (real Postgres, a real spawned
 * `apps/api` process, real HTTP calls) that each of the operations this
 * task extends audit coverage to actually produces a real audit record,
 * read back through the existing, unchanged `GET /projects/:id/audit`
 * route (`listAuditRecordsForProject`) — exactly this task's own
 * acceptance criterion. No `apps/worker` process is needed: none of these
 * five operations (project create/update, work-item create/update,
 * workflow definition/version create, knowledge-source create) go through
 * the workflow engine.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
// The local dev AuthProvider trusts the bearer token's value as the
// principal id directly — a fresh, unique value here means this test
// creates and owns a brand-new project, with no dependency on
// `SEED_PROJECT_ID` or any other e2e file's own state.
const BEARER_TOKEN = `devos-115-e2e-${Date.now()}`;

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

interface AuditRecordDto {
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
}

describe('DEVOS-115 real E2E — every extended operation produces a real, readable audit record', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3911;
  const baseUrl = `http://localhost:${apiPort}`;
  const api = createApiClient(baseUrl);

  beforeAll(async () => {
    await runMigrateAndSeed();

    apiProcess = spawnApp('apps/api', {
      ...process.env,
      DATABASE_URL,
      PORT: String(apiPort),
    });

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

  it('project creation, project update, work-item creation, work-item update, workflow definition/version creation, and knowledge-source creation each produce a real audit record with the established shape', async () => {
    const unique = `e2e-audit-coverage-${Date.now()}`;

    // 1. Project creation.
    const project = await api<{ id: string; name: string }>('POST', '/api/v1/projects', {
      name: `Audit coverage test (${unique})`,
      slug: `audit-coverage-${unique}`,
    });
    expect(project.status).toBe(200);
    const projectId = project.body.data!.id;

    // 2. Project update.
    const updated = await api<{ id: string }>('PATCH', `/api/v1/projects/${projectId}`, {
      name: `Renamed (${unique})`,
    });
    expect(updated.status).toBe(200);

    // 3. Work-item creation.
    const workItem = await api<{ id: string }>('POST', `/api/v1/projects/${projectId}/work-items`, {
      title: `Work item (${unique})`,
      description: 'Exercises DEVOS-115 audit coverage.',
    });
    expect(workItem.status).toBe(200);
    const workItemId = workItem.body.data!.id;

    // 4. Work-item update.
    const workItemUpdated = await api<{ id: string }>('PATCH', `/api/v1/work-items/${workItemId}`, {
      title: `Renamed work item (${unique})`,
    });
    expect(workItemUpdated.status).toBe(200);

    // 5. Workflow definition/version creation.
    const workflow = await api<{ id: string }>('POST', `/api/v1/projects/${projectId}/workflows`, {
      key: `audit-coverage-${unique}`,
      name: `Audit coverage workflow (${unique})`,
      definition: {
        name: 'Audit coverage workflow',
        trigger: { type: 'WORK_ITEM_MANUAL' },
        inputs: [{ name: 'workItemId', type: 'WORK_ITEM', required: true }],
        nodes: [{ id: 'noop', type: 'TOOL_TASK', name: 'No-op' }],
        edges: [],
        policies: [],
        outputs: [],
      },
    });
    expect(workflow.status).toBe(200);
    const workflowId = workflow.body.data!.id;

    // 6. Knowledge-source creation.
    const knowledgeSource = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${projectId}/knowledge-sources`,
      {
        key: `standards-${unique}`,
        name: `Coding standards (${unique})`,
        sourceType: 'STANDARD',
        content: 'Prefer explicit types over inference at public boundaries.',
      },
    );
    expect(knowledgeSource.status).toBe(200);
    const knowledgeSourceId = knowledgeSource.body.data!.id;

    // The real, unchanged read path this task's own acceptance criterion
    // names — no new endpoint, no direct repository query.
    const audit = await api<AuditRecordDto[]>('GET', `/api/v1/projects/${projectId}/audit`);
    expect(audit.status).toBe(200);
    const records = audit.body.data!;

    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'project.created',
        targetType: 'Project',
        targetId: projectId,
        outcome: 'SUCCESS',
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'project.updated',
        targetType: 'Project',
        targetId: projectId,
        outcome: 'SUCCESS',
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'work-item.created',
        targetType: 'WorkItem',
        targetId: workItemId,
        outcome: 'SUCCESS',
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'work-item.updated',
        targetType: 'WorkItem',
        targetId: workItemId,
        outcome: 'SUCCESS',
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'workflow.created',
        targetType: 'WorkflowDefinition',
        targetId: workflowId,
        outcome: 'SUCCESS',
      }),
    );
    expect(records).toContainEqual(
      expect.objectContaining({
        action: 'knowledge-source.created',
        targetType: 'KnowledgeSource',
        targetId: knowledgeSourceId,
        outcome: 'SUCCESS',
      }),
    );
  }, 30_000);
});
