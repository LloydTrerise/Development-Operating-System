import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Artifact, ArtifactVersion, Membership, Project } from '@devos/domain';
import {
  createArtifactRepository,
  createArtifactVersionRepository,
  createDatabaseClient,
  createMembershipRepository,
  createProjectRepository,
  SEED_ORGANISATION_ID,
  SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
  type DatabaseClient,
} from '@devos/database';

/**
 * DEVOS-175 — the real end-to-end pilot for Sprint 22 (E25 Agent Platform,
 * part 1): a real agent's `DRAFT` v2 (DEVOS-172) is published; real
 * `CODE_CHANGE`/`REVIEW_EVIDENCE` fixtures attribute two real, distinct
 * review outcomes to v1 and v2; `GET /agents/:agentId/quality` (DEVOS-174)
 * returns the correct, distinct real pass rate per version. Mirrors this
 * codebase's own established real-process pilot convention.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://devos:devos@localhost:5432/devos';
const PNPM_CMD = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const TSX_CLI = fileURLToPath(import.meta.resolve('tsx/cli'));
const ACTOR_ID = `devos-175-e2e-${Date.now()}`;

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
    body?: unknown,
  ): Promise<{ status: number; body: ApiEnvelope<T> }> {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${bearerToken}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = (await response.json()) as ApiEnvelope<T>;
    return { status: response.status, body: parsed };
  };
}

async function createEvidenceArtifact(
  projectId: Project['id'],
  artifactType: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const now = new Date().toISOString();
  const artifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId,
    artifactType,
    name: `${artifactType} pilot fixture`,
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

describe('DEVOS-175 real E2E pilot — two real published agent versions, two real quality outcomes', () => {
  let apiProcess: ManagedProcess;
  const apiPort = 3924;
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

  it('shows two real, distinct pass rates for two real published agent versions', async () => {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID() as Project['id'],
      organisationId: SEED_ORGANISATION_ID as Project['organisationId'],
      projectTypeId: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID as Project['projectTypeId'],
      name: `Agent Versioning Pilot ${randomUUID()}`,
      slug: `agent-versioning-pilot-${randomUUID()}`,
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

    // Real agent, v1 published.
    const createResult = await api<{
      id: string;
      version: { id: string; version: number; status: string };
    }>('POST', `/api/v1/projects/${project.id}/agents`, {
      key: `pilot-agent-${randomUUID()}`,
      name: 'Pilot Agent',
      configuration: {
        role: 'DEVELOPMENT',
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        allowedCapabilities: [],
      },
    });
    expect(createResult.status).toBe(200);
    const agentId = createResult.body.data!.id;
    const v1Id = createResult.body.data!.version.id;

    const publishV1 = await api('POST', `/api/v1/agents/${agentId}/publish`);
    expect(publishV1.status).toBe(200);

    // Real CODE_CHANGE + REVIEW_EVIDENCE (PASS) attributed to v1.
    const codeChangeV1 = await createEvidenceArtifact(project.id, 'CODE_CHANGE', {
      agentVersionId: v1Id,
      commitSha: 'v1-abc',
      generatedAt: now,
    });
    await createEvidenceArtifact(project.id, 'REVIEW_EVIDENCE', {
      decision: 'PASS',
      derivedFromArtifactId: codeChangeV1,
    });

    // Draft and publish v2.
    const draftV2 = await api<{ id: string; version: number; status: string }>(
      'POST',
      `/api/v1/agents/${agentId}/versions`,
    );
    expect(draftV2.status).toBe(200);
    expect(draftV2.body.data!.version).toBe(2);
    const v2Id = draftV2.body.data!.id;

    const publishV2 = await api('POST', `/api/v1/agents/${agentId}/publish`);
    expect(publishV2.status).toBe(200);

    // Real CODE_CHANGE + REVIEW_EVIDENCE (CHANGES_REQUIRED) attributed to v2.
    const codeChangeV2 = await createEvidenceArtifact(project.id, 'CODE_CHANGE', {
      agentVersionId: v2Id,
      commitSha: 'v2-def',
      generatedAt: now,
    });
    await createEvidenceArtifact(project.id, 'REVIEW_EVIDENCE', {
      decision: 'CHANGES_REQUIRED',
      derivedFromArtifactId: codeChangeV2,
    });

    // Real quality figures, confirmed via the real running apps/api.
    const quality = await api<
      { agentVersionId: string; reviewCount: number; passCount: number; passRate: number }[]
    >('GET', `/api/v1/agents/${agentId}/quality`);
    expect(quality.status).toBe(200);
    const byVersionId = new Map(quality.body.data!.map((row) => [row.agentVersionId, row]));
    expect(byVersionId.get(v1Id)?.passRate).toBe(1);
    expect(byVersionId.get(v2Id)?.passRate).toBe(0);

    // Independent cross-check via a direct Postgres query.
    const directRows = await database.db
      .selectFrom('artifact_versions')
      .innerJoin('artifacts', 'artifacts.id', 'artifact_versions.artifact_id')
      .select(['artifacts.artifact_type as type', 'artifact_versions.metadata as metadata'])
      .where('artifacts.project_id', '=', project.id)
      .where('artifacts.artifact_type', '=', 'REVIEW_EVIDENCE')
      .execute();
    expect(directRows).toHaveLength(2);

    // Cleanup.
    await database.db
      .deleteFrom('artifact_versions')
      .where(
        'artifact_id',
        'in',
        database.db.selectFrom('artifacts').select('id').where('project_id', '=', project.id),
      )
      .execute();
    await database.db.deleteFrom('artifacts').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('agent_versions').where('agent_id', '=', agentId).execute();
    await database.db.deleteFrom('agents').where('id', '=', agentId).execute();
    // `agent_version.drafted`/`agent_version.published` audit records both
    // carry a real `project_id` FK — must be cleared before the project row.
    await database.db.deleteFrom('audit_records').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('outbox_events').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('memberships').where('project_id', '=', project.id).execute();
    await database.db.deleteFrom('projects').where('id', '=', project.id).execute();

    const remainingProject = await createProjectRepository(database.db).getById(project.id);
    expect(remainingProject).toBeNull();
  }, 30_000);
});
