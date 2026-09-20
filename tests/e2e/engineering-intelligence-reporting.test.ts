import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Artifact, ArtifactVersion, Membership, Project, WorkItem } from '@devos/domain';
import {
  createArtifactRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createMembershipRepository,
  createProjectRepository,
  createWorkItemRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-163/DEVOS-164 — real, end-to-end verification that the new
 * cross-project/organisation evidence query layer (DEVOS-163) and the new
 * `GET /projects/:projectId/engineering-report` /
 * `GET /organisations/:organisationId/engineering-report` routes
 * (DEVOS-164) return correct, real data: two real projects in the same
 * seeded organisation, each with real `REVIEW_EVIDENCE`/`TEST_EVIDENCE`/
 * `SECURITY_SCAN_EVIDENCE`/`RELEASE_EVIDENCE` artifacts and a real
 * rework-cycle work item, aggregated correctly both at project scope and
 * across the organisation. Mirrors `cost-reporting.test.ts`'s real-spawned-
 * `apps/api` harness exactly.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-163-164-e2e-${Date.now()}`;

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
  return async function api<T>(
    method: string,
    pathname: string,
  ): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

async function createProjectFixture(): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
    projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
    name: `Engineering Intelligence Test Project ${randomUUID()}`,
    slug: `engineering-intelligence-${randomUUID()}`,
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

async function createEvidenceArtifact(
  project: Project,
  artifactType: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: project.id,
    artifactType,
    name: `${artifactType} fixture`,
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

async function createReworkedWorkItem(project: Project, reworkCount: number): Promise<void> {
  const now = new Date().toISOString();
  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: `Engineering intelligence rework fixture ${randomUUID()}`,
    type: 'GENERAL',
    status: 'OPEN',
    priority: 'MEDIUM',
    metadata: { reworkCount },
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };
  await createWorkItemRepository(database.db).create(workItem);
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

describe('DEVOS-163/164 real E2E — cross-project/organisation engineering-intelligence reports', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3922;
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

  it('aggregates real evidence correctly at project scope and across the organisation, via real Postgres and the real new routes', async () => {
    const projectA = await createProjectFixture();
    const projectB = await createProjectFixture();

    // DEVOS-168: a real CODE_CHANGE, committed 1 hour before a real passed
    // release links back to it via `derivedFromArtifactId` — proving the
    // real one-hop lead-time match this sprint's own corrected grounding
    // established (see aggregate-evidence.ts's own doc comment).
    const codeChangeGeneratedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const codeChangeArtifactId = await createEvidenceArtifact(projectA, 'CODE_CHANGE', {
      commitSha: 'abc123',
      generatedAt: codeChangeGeneratedAt,
    });

    await createEvidenceArtifact(projectA, 'REVIEW_EVIDENCE', { decision: 'PASS' });
    await createEvidenceArtifact(projectA, 'REVIEW_EVIDENCE', { decision: 'CHANGES_REQUIRED' });
    await createEvidenceArtifact(projectA, 'TEST_EVIDENCE', { passed: true });
    await createEvidenceArtifact(projectA, 'SECURITY_SCAN_EVIDENCE', { passed: true });
    await createEvidenceArtifact(projectA, 'RELEASE_EVIDENCE', {
      action: 'deploy',
      passed: true,
      completedAt: new Date().toISOString(),
      derivedFromArtifactId: codeChangeArtifactId,
    });
    await createEvidenceArtifact(projectA, 'RELEASE_EVIDENCE', {
      action: 'rollback',
      passed: false,
    });
    await createReworkedWorkItem(projectA, 1);

    await createEvidenceArtifact(projectB, 'RELEASE_EVIDENCE', { action: 'deploy', passed: true });

    // Project A: real pass rate, real deploy/rollback counts, real rework,
    // real DORA deployment/change-failure figures, and a real lead-time sample.
    const projectAReport = await api<{
      reviewCount: number;
      reviewPassRate: number;
      testCount: number;
      testPassRate: number;
      securityScanCount: number;
      deployCount: number;
      rollbackCount: number;
      reworkCycleCount: number;
      dora: { deploymentCount: number; changeFailureCount: number; changeFailureRate: number };
      leadTime: { sampleCount: number; leadTimeMsP50: number };
    }>('GET', `/api/v1/projects/${projectA.id}/engineering-report`);
    expect(projectAReport.status).toBe(200);
    expect(projectAReport.body.data!.reviewCount).toBe(2);
    expect(projectAReport.body.data!.reviewPassRate).toBeCloseTo(0.5, 6);
    expect(projectAReport.body.data!.testCount).toBe(1);
    expect(projectAReport.body.data!.testPassRate).toBe(1);
    expect(projectAReport.body.data!.securityScanCount).toBe(1);
    expect(projectAReport.body.data!.deployCount).toBe(1);
    expect(projectAReport.body.data!.rollbackCount).toBe(1);
    expect(projectAReport.body.data!.reworkCycleCount).toBe(1);
    expect(projectAReport.body.data!.dora.deploymentCount).toBe(1);
    expect(projectAReport.body.data!.dora.changeFailureCount).toBe(1);
    expect(projectAReport.body.data!.dora.changeFailureRate).toBeCloseTo(1, 6);
    expect(projectAReport.body.data!.leadTime.sampleCount).toBe(1);
    expect(projectAReport.body.data!.leadTime.leadTimeMsP50).toBeGreaterThan(0);

    // Project B: independent from project A.
    const projectBReport = await api<{ deployCount: number; reviewCount: number }>(
      'GET',
      `/api/v1/projects/${projectB.id}/engineering-report`,
    );
    expect(projectBReport.status).toBe(200);
    expect(projectBReport.body.data!.deployCount).toBe(1);
    expect(projectBReport.body.data!.reviewCount).toBe(0);

    // Organisation: real rollup spanning both real projects (DEVOS-163's
    // own real-join precedent, not a client-side loop).
    const orgReport = await api<{
      projectCount: number;
      deployCount: number;
      rollbackCount: number;
      reviewCount: number;
    }>('GET', `/api/v1/organisations/${SEED_ORGANISATION_ID}/engineering-report`);
    expect(orgReport.status).toBe(200);
    expect(orgReport.body.data!.deployCount).toBeGreaterThanOrEqual(2);
    expect(orgReport.body.data!.rollbackCount).toBeGreaterThanOrEqual(1);
    expect(orgReport.body.data!.reviewCount).toBeGreaterThanOrEqual(2);

    // A non-member's request to either new route 404s, matching every
    // other project/organisation-scoped route's own established convention.
    const nonMember = createApiClient(baseUrl, `devos-163-164-non-member-${Date.now()}`);
    const denied = await nonMember('GET', `/api/v1/projects/${projectA.id}/engineering-report`);
    expect(denied.status).toBe(404);
  }, 30_000);
});
