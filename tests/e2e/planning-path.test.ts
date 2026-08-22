import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_PLANNING_PATH_WORKFLOW_VERSION_ID, SEED_PROJECT_ID } from '@devos/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * DEVOS-038 (Sprint 2) + DEVOS-050 (Sprint 3) — one test now serves both:
 * the Sprint 2 analogue of DEVOS-021's "entire control loop passes" proof,
 * extended through the full four-stage planning path AND the human
 * planning-approval gate. A work item, run through the real agent pipeline
 * (real Postgres, a real spawned API process, a real spawned worker
 * process, driven purely through the public HTTP API), produces a
 * discovery report, a PRD, a technical design, and an implementation plan,
 * in that order, with correct provenance/derivation chaining and context
 * manifests — then the run stops at `AWAITING_APPROVAL` (specs/workflows/software-change-workflow.md
 * §16/§45's exact acceptance scenario) until the auto-created approval,
 * bound to all four artifacts via a scope hash, is explicitly granted
 * through the real approval API, after which the run reaches `COMPLETED`.
 *
 * DEVOS-050 folds its acceptance criteria into this same test rather than
 * duplicating a near-identical second E2E file: context manifests'
 * provenance fields (DEVOS-042: `retrievedAt` on every source,
 * `authorityLevel: 8` on each consuming stage's `ARTIFACT` source), the
 * approval's evidence binding (exactly 4 artifact versions), and the
 * approval's own request/decision audit trail (`approval.requested`/
 * `approval.approved`, scoped to the approval's own target id) are all
 * asserted here, alongside DEVOS-038's original task/artifact/summary
 * checks.
 *
 * Runs against DEVOS-035's seeded "planning-path" workflow version and its
 * four seeded agents (discovery-agent/requirements-agent/technical-design-
 * agent/planning-agent) — built for exactly this proof — rather than
 * creating fresh ones: apps/worker's AGENT_TASK router resolves a handler
 * by matching the task's agentRef against those specific seeded keys (see
 * apps/worker/src/agent-task-router.ts), so a fresh, differently-keyed
 * agent has no route today. `pnpm db:seed` in beforeAll (matching
 * hardening.test.ts's own established pattern) guarantees they exist
 * regardless of prior manual steps.
 *
 * The worker is spawned with AGENT_MODEL_ADAPTER=fixture (DEVOS-037/038) —
 * DEVOS-037's recorded golden fixtures stand in for the real Gemini API,
 * exactly like DEVOS-016's deterministic stub always has for the 'TASK'
 * node type, so this test passes repeatably in CI with no live API call
 * and no GEMINI_API_KEY. Everything else (dispatcher, queue, routing,
 * schema validation, context manifests, artifact chaining, the planning-
 * approval gate) is real.
 *
 * Requires a running Postgres reachable at DATABASE_URL, matching every
 * other live-verification step in this repository's history.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const API_PORT = 3902;
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
  // See vertical-slice.test.ts's identical comment: invoking tsx directly
  // via `node <tsx-cli>` avoids the Windows .cmd-shim zombie-process risk
  // of spawning through a shell.
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
  storageDir = await mkdtemp(path.join(tmpdir(), 'devos-e2e-planning-path-'));

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
}, 40_000);

afterAll(async () => {
  apiProcess?.child.kill();
  workerProcess?.child.kill();
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

describe('Sprint 2/3 planning-path end-to-end (DEVOS-038, DEVOS-050)', () => {
  it('runs discovery -> requirements -> technical design -> planning -> human planning approval, with provenance and audit throughout', async () => {
    const unique = `e2e-planning-${Date.now()}`;

    const workItem = await api<{ id: string }>(
      'POST',
      `/api/v1/projects/${SEED_PROJECT_ID}/work-items`,
      {
        title: `Add CSV export to the reporting dashboard (${unique})`,
        description:
          'Users on the analytics team need to export the current reporting dashboard view as a CSV file for offline analysis.',
      },
    );
    expect(workItem.status).toBe(200);
    const workItemId = workItem.body.data!.id;

    const started = await api<{ id: string; status: string }>(
      'POST',
      `/api/v1/workflow-versions/${SEED_PLANNING_PATH_WORKFLOW_VERSION_ID}/runs`,
      { workItemId, idempotencyKey: `${unique}-run` },
    );
    expect(started.status).toBe(200);
    const runId = started.body.data!.id;

    // Worker execution — poll until the planning stages finish. The shared
    // dev queue may carry leftover backlog from other manual verification
    // sessions (claimNext() is global, not run-scoped, matching
    // production) — generous headroom lets this run's own tasks surface
    // after it, rather than assuming an empty queue.
    //
    // DEVOS-047: the seeded planning-path workflow now carries the
    // "planning-approval" gate marker, so once all four tasks succeed the
    // run stops at AWAITING_APPROVAL (not COMPLETED) and an approval
    // request is auto-created — it does not complete on its own.
    let run: { status: string; errorMessage?: string } | undefined;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const result = await api<{ status: string; errorMessage?: string }>(
        'GET',
        `/api/v1/runs/${runId}`,
      );
      run = result.body.data;
      if (run && ['AWAITING_APPROVAL', 'FAILED'].includes(run.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    expect(run?.status).toBe('AWAITING_APPROVAL');

    // Tasks: all four succeeded, in the correct stage order.
    const tasks = await api<{ nodeId: string; status: string; type: string }[]>(
      'GET',
      `/api/v1/runs/${runId}/tasks`,
    );
    expect(tasks.status).toBe(200);
    expect(tasks.body.data!.map((t) => t.nodeId)).toEqual([
      'discovery',
      'requirements',
      'technical-design',
      'planning',
    ]);
    expect(tasks.body.data!.every((t) => t.status === 'SUCCEEDED')).toBe(true);

    // Artifacts: all four planning-path types produced for this run, in
    // order — scoped to this run's provenance, since the seeded project is
    // shared across every manual verification session run today.
    const artifacts = await api<
      { id: string; name: string; type: string; provenance: { workflowRunId?: string } }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/artifacts`);
    expect(artifacts.status).toBe(200);
    const runArtifacts = artifacts.body.data!.filter((a) => a.provenance.workflowRunId === runId);
    expect(runArtifacts.map((a) => a.type)).toEqual([
      'DISCOVERY_REPORT',
      'PRD',
      'TECHNICAL_DESIGN',
      'IMPLEMENTATION_PLAN',
    ]);

    // Agent execution summaries (DEVOS-036): each task's role/prompt
    // version/output is queryable, tying this proof to that read API too.
    const summaries = await api<
      {
        taskId: string;
        status: string;
        role: string;
        promptReference?: string;
        contextManifest?: {
          sourceCount: number;
          sources: { type: string; ref: string; retrievedAt?: string; authorityLevel?: number }[];
        };
      }[]
    >('GET', `/api/v1/runs/${runId}/agent-execution-summaries`);
    expect(summaries.status).toBe(200);
    expect(summaries.body.data!.map((s) => s.role)).toEqual([
      'DISCOVERY',
      'REQUIREMENTS',
      'TECHNICAL_DESIGN',
      'PLANNING',
    ]);
    expect(summaries.body.data!.every((s) => s.status === 'SUCCEEDED')).toBe(true);

    // DEVOS-050: context manifests/provenance are recorded for every
    // stage (DEVOS-042) — every source carries a `retrievedAt`, and the
    // three consuming stages (requirements/technical-design/planning)
    // each carry an ARTIFACT source at authorityLevel 8 for the prior
    // stage's artifact they were derived from.
    for (const summary of summaries.body.data!) {
      expect(summary.contextManifest).toBeDefined();
      expect(summary.contextManifest!.sources.length).toBeGreaterThan(0);
      expect(summary.contextManifest!.sources.every((s) => typeof s.retrievedAt === 'string')).toBe(
        true,
      );
    }
    const consumingStages = summaries.body.data!.slice(1);
    for (const summary of consumingStages) {
      const artifactSource = summary.contextManifest!.sources.find((s) => s.type === 'ARTIFACT');
      expect(artifactSource).toBeDefined();
      expect(artifactSource!.authorityLevel).toBe(8);
    }

    // DEVOS-047/050: approve the auto-created planning-approval gate —
    // the run does not reach COMPLETED without an explicit human decision.
    // The approval is bound to exactly the four artifacts this run
    // produced (specs/api/poc-api-contracts.md §29–§30's evidence binding).
    const approvals = await api<
      {
        id: string;
        status: string;
        evidenceReference: { scopeHash: string; artifactVersionIds: string[] };
      }[]
    >('GET', `/api/v1/runs/${runId}/approvals`);
    expect(approvals.status).toBe(200);
    expect(approvals.body.data).toHaveLength(1);
    const approval = approvals.body.data![0]!;
    expect(approval.status).toBe('PENDING');
    expect(approval.evidenceReference.artifactVersionIds).toHaveLength(4);

    const decision = await api<{ status: string }>(
      'POST',
      `/api/v1/approvals/${approval.id}/approve`,
      { scopeHash: approval.evidenceReference.scopeHash, comment: 'Planning approved (e2e).' },
    );
    expect(decision.status).toBe(200);
    expect(decision.body.data!.status).toBe('APPROVED');

    const afterApproval = await api<{ status: string }>('GET', `/api/v1/runs/${runId}`);
    expect(afterApproval.body.data!.status).toBe('COMPLETED');

    // Audit events: this run's own lifecycle events succeeded, and each of
    // its four artifacts has a successful creation record — scoped to
    // specific target ids rather than the whole shared project's feed,
    // which carries an entire day's worth of other sessions' records too.
    const audit = await api<
      { action: string; targetType: string; targetId: string; outcome: string }[]
    >('GET', `/api/v1/projects/${SEED_PROJECT_ID}/audit`);
    expect(audit.status).toBe(200);
    const records = audit.body.data!;

    const runRecords = records.filter(
      (r) => r.targetType === 'WorkflowRun' && r.targetId === runId,
    );
    expect(runRecords.map((r) => r.action)).toEqual(
      expect.arrayContaining(['workflow_run.started', 'workflow_run.completed']),
    );
    expect(runRecords.every((r) => r.outcome === 'SUCCESS')).toBe(true);

    // DEVOS-050: the approval's own request/decision are independently
    // auditable (specs/database/poc-database-schema.md §16 — "material
    // security and workflow audit events"), scoped to the approval's own
    // target id, not just the run's.
    const approvalRecords = records.filter(
      (r) => r.targetType === 'Approval' && r.targetId === approval.id,
    );
    expect(approvalRecords.map((r) => r.action)).toEqual(
      expect.arrayContaining(['approval.requested', 'approval.approved']),
    );
    expect(approvalRecords.every((r) => r.outcome === 'SUCCESS')).toBe(true);

    for (const artifact of runArtifacts) {
      const artifactRecords = records.filter(
        (r) => r.targetType === 'Artifact' && r.targetId === artifact.id,
      );
      expect(artifactRecords).toHaveLength(1);
      expect(artifactRecords[0]!).toMatchObject({ action: 'artifact.created', outcome: 'SUCCESS' });
    }
  }, 70_000);
});
