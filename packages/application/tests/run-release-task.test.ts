import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProjectTypeId } from '@devos/contracts';
import type {
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  AuditRecord,
  AuditRecordRepository,
  Integration,
  IntegrationRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Policy,
  PolicyRepository,
  Project,
  ProjectRepository,
  ToolCapability,
  ToolCapabilityRepository,
  ToolInvocation,
  ToolInvocationRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { NonRetryableTaskError } from '@devos/domain';
import type { CredentialResolver } from '@devos/integrations';
import { runGit } from '@devos/integrations';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolTaskHandlerDeps } from '../src/tasks/deps.js';
import { runReleaseRollbackTask, runReleaseTask } from '../src/tasks/run-release-task.js';

const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

async function buildScenario(
  repositoryPath: string,
  stagingRoot: string,
  commitSha: string,
  overrides: { releaseEnvironment: string; healthCheckCommand: string },
  extraIntegrationsFactory?: (projectId: Project['id']) => Integration[],
) {
  const organisationId = randomUUID() as OrganisationId;
  const now = new Date(0).toISOString();

  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId,
    projectTypeId: randomUUID() as ProjectTypeId,
    name: 'Test Project',
    slug: 'test-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Release a status page',
    description: 'Users need a status page.',
    type: 'GENERAL',
    status: 'OPEN',
    priority: 'MEDIUM',
    metadata: {},
    createdBy: 'alice',
    createdAt: now,
    updatedAt: now,
  };

  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: workItem.id,
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'release',
    taskType: 'TOOL_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const codeChangeArtifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: project.id,
    artifactType: 'CODE_CHANGE',
    name: `Code Change — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: randomUUID() as Artifact['workflowRunId'],
    workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };
  const codeChangeVersion: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: codeChangeArtifact.id,
    version: 1,
    contentType: 'application/json',
    contentUri: 'file:///code-change.json',
    contentHash: 'a'.repeat(64),
    metadata: { branchName: 'devos/status-page', commitSha },
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: now,
  };

  const gitIntegration: Integration = {
    id: randomUUID() as Integration['id'],
    projectId: project.id,
    type: 'Git',
    provider: 'local',
    name: 'Test repository',
    status: 'ACTIVE',
    credentialReference: 'DEVOS076_TEST_CREDENTIAL',
    configuration: { repositoryPath, stagingRoot, ...overrides },
    createdAt: now,
    updatedAt: now,
  };

  const ownerMembership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId: project.id,
    principalId: 'alice',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  const systemActorMembership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId: project.id,
    principalId: SYSTEM_ACTOR_ID,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const deployCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'deploy',
    name: 'Deploy to Environment',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: { revision: { type: 'string' } },
      required: ['revision'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: now,
  };
  const healthCheckCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'health-check',
    name: 'Run Post-Release Health Check',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: now,
  };

  const projects: ProjectRepository = {
    getById: async (id) => (id === project.id ? project : null),
    listForOrganisation: async () => [project],
    create: async () => {},
    update: async () => {},
  };
  const memberships: MembershipRepository = {
    getById: async () => null,
    getForPrincipalAndProject: async (principalId, projectId) =>
      [ownerMembership, systemActorMembership].find(
        (m) => m.principalId === principalId && m.projectId === projectId,
      ) ?? null,
    listForPrincipal: async () => [],
    listForProject: async () => [ownerMembership, systemActorMembership],
    create: async () => {},
    updateRole: async () => {},
    remove: async () => {},
  };
  const policies: PolicyRepository = {
    getById: async () => null,
    getByProjectAndKeyAndVersion: async () => null,
    getLatestForProjectAndKey: async () => null,
    listForProject: async () => [] as Policy[],
    create: async () => {},
    publish: async () => {},
  };
  const capabilities = [deployCapability, healthCheckCapability];
  const toolCapabilities: ToolCapabilityRepository = {
    getById: async (id) => capabilities.find((c) => c.id === id) ?? null,
    getByProjectAndKey: async (projectId, key) =>
      capabilities.find((c) => c.projectId === projectId && c.key === key) ?? null,
    listForProject: async () => capabilities,
    create: async () => {},
  };
  const toolInvocations: ToolInvocation[] = [];
  const toolInvocationRepository: ToolInvocationRepository = {
    getById: async (id) => toolInvocations.find((i) => i.id === id) ?? null,
    getByCapabilityAndIdempotencyKey: async (toolCapabilityId, idempotencyKey) =>
      toolInvocations.find(
        (i) => i.toolCapabilityId === toolCapabilityId && i.idempotencyKey === idempotencyKey,
      ) ?? null,
    listForTask: async (workflowTaskId) =>
      toolInvocations.filter((i) => i.workflowTaskId === workflowTaskId),
    create: async (invocation) => {
      toolInvocations.push(invocation);
    },
  };
  const auditRecordsList: AuditRecord[] = [];
  const auditRecordRepository: AuditRecordRepository = {
    create: async (record) => {
      auditRecordsList.push(record);
    },
    listForProject: async (projectId) => auditRecordsList.filter((r) => r.projectId === projectId),
  };
  const extraIntegrations = extraIntegrationsFactory?.(project.id) ?? [];
  const allIntegrations = [gitIntegration, ...extraIntegrations];
  const integrations: IntegrationRepository = {
    getById: async (id) => allIntegrations.find((i) => i.id === id) ?? null,
    listForProject: async () => allIntegrations,
    create: async () => {},
  };

  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    create: async () => {},
  };
  const workItems: WorkItemRepository = {
    getById: async (id) => (id === workItem.id ? workItem : null),
    listForProject: async () => [],
    create: async () => {},
    update: async () => {},
  };

  const artifacts: ArtifactRepository = {
    getById: async (id) => (id === codeChangeArtifact.id ? codeChangeArtifact : null),
    listForProject: async () => [codeChangeArtifact],
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => (id === codeChangeVersion.id ? codeChangeVersion : null),
    listForArtifact: async (artifactId) =>
      artifactId === codeChangeArtifact.id ? [codeChangeVersion] : [],
    create: async () => {},
  };

  return {
    project,
    workItem,
    run,
    task,
    codeChangeArtifact,
    codeChangeVersion,
    gitIntegration,
    workflowRuns,
    workItems,
    artifacts,
    artifactVersions,
    projects,
    memberships,
    policies,
    toolCapabilities,
    toolInvocations,
    toolInvocationRepository,
    auditRecordRepository,
    integrations,
  };
}

describe('runReleaseTask (real local git repository, real local staging deployment, real shell health checks)', () => {
  let storageDir: string;
  let repositoryPath: string;
  let stagingRoot: string;
  let commitSha: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-release-task-storage-'));
    repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-run-release-task-repo-'));
    stagingRoot = await mkdtemp(path.join(tmpdir(), 'devos-run-release-task-staging-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFile(path.join(repositoryPath, 'index.html'), '<h1>status: ok</h1>\n', 'utf8');
    await runGit(['add', 'index.html'], repositoryPath);
    await runGit(['commit', '-m', 'Add status page'], repositoryPath);
    const { stdout } = await runGit(['rev-parse', 'HEAD'], repositoryPath);
    commitSha = stdout.trim();
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
    await rm(repositoryPath, { recursive: true, force: true });
    await rm(stagingRoot, { recursive: true, force: true });
  });

  function buildDeps(
    scenario: Awaited<ReturnType<typeof buildScenario>>,
    storage: ReturnType<typeof createLocalFilesystemStorage>,
    onPublish: (artifact: Artifact, version: ArtifactVersion) => void,
    credentialResolver?: ToolTaskHandlerDeps['credentialResolver'],
  ): ToolTaskHandlerDeps {
    return {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async (artifact, version) => {
        onPublish(artifact, version);
      },
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      integrations: scenario.integrations,
      ...(credentialResolver !== undefined ? { credentialResolver } : {}),
    };
  }

  it('deploys the real revision, runs a real passing health check, and publishes a passed RELEASE_EVIDENCE artifact', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'staging',
      healthCheckCommand:
        process.platform === 'win32'
          ? "node -e \"if (!require('fs').existsSync('index.html')) process.exit(1)\""
          : 'test -f index.html',
    });
    const storage = createLocalFilesystemStorage(storageDir);

    let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
    const deps = buildDeps(scenario, storage, (artifact, version) => {
      published = { artifact, version };
    });

    const output = await runReleaseTask(deps, scenario.task);

    expect(output.status).toBe('SUCCEEDED');
    expect(output.passed).toBe(true);
    expect(output.revision).toBe(commitSha);
    expect(published?.artifact.artifactType).toBe('RELEASE_EVIDENCE');
    const metadata = published?.version.metadata as Record<string, unknown>;
    expect(metadata.passed).toBe(true);
    expect(metadata.revision).toBe(commitSha);
    expect(metadata.derivedFromArtifactId).toBe(scenario.codeChangeArtifact.id);
    expect((metadata.deployment as Record<string, unknown>).deployedPath).toBe(
      String(output.deployedPath),
    );
    expect((metadata.healthCheck as Record<string, unknown>).exitCode).toBe(0);

    expect(scenario.toolInvocations.filter((i) => i.status === 'SUCCEEDED')).toHaveLength(2);
  }, 30_000);

  it('records a real failing health check as a not-passed RELEASE_EVIDENCE artifact without throwing', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'staging',
      healthCheckCommand: 'node -e "console.error(\'unhealthy\'); process.exit(1)"',
    });
    const storage = createLocalFilesystemStorage(storageDir);

    let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
    const deps = buildDeps(scenario, storage, (artifact, version) => {
      published = { artifact, version };
    });

    const output = await runReleaseTask(deps, scenario.task);

    expect(output.status).toBe('SUCCEEDED');
    expect(output.passed).toBe(false);
    const metadata = published?.version.metadata as Record<string, unknown>;
    expect(metadata.passed).toBe(false);
    expect((metadata.healthCheck as Record<string, unknown>).exitCode).toBe(1);
  });

  it('throws when no release configuration exists on the Git integration', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: '',
      healthCheckCommand: '',
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const deps = buildDeps(scenario, storage, () => {});

    await expect(runReleaseTask(deps, scenario.task)).rejects.toThrow(
      'no configured "releaseEnvironment"',
    );
  });

  it('throws when the code change artifact has no recorded commitSha', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'staging',
      healthCheckCommand: 'test -f index.html',
    });
    scenario.codeChangeVersion.metadata = { branchName: 'devos/status-page' };
    const storage = createLocalFilesystemStorage(storageDir);
    const deps = buildDeps(scenario, storage, () => {});

    await expect(runReleaseTask(deps, scenario.task)).rejects.toThrow('no recorded commitSha');
  });

  it('DEVOS-077: throws NonRetryableTaskError (not a plain Error) when the deploy is rejected by policy — a permission denial must not be retried', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'production',
      healthCheckCommand: 'test -f index.html',
    });
    const denyPolicy: Policy = {
      id: randomUUID() as Policy['id'],
      organisationId: randomUUID() as OrganisationId,
      projectId: scenario.project.id,
      key: 'release-policy',
      version: 1,
      status: 'PUBLISHED',
      definition: {
        rules: [{ action: 'deploy', effect: 'DENY', condition: { environment: 'production' } }],
      },
      createdBy: 'alice',
      publishedAt: new Date(0).toISOString(),
      createdAt: new Date(0).toISOString(),
    };
    scenario.policies = {
      getById: async () => null,
      getByProjectAndKeyAndVersion: async () => null,
      getLatestForProjectAndKey: async () => null,
      listForProject: async () => [denyPolicy],
      create: async () => {},
      publish: async () => {},
    };
    const storage = createLocalFilesystemStorage(storageDir);
    const deps = buildDeps(scenario, storage, () => {});

    await expect(runReleaseTask(deps, scenario.task)).rejects.toThrow(NonRetryableTaskError);
  });

  it('DEVOS-077: throws a plain (retryable) Error, not NonRetryableTaskError, when the deploy adapter itself fails', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, 'not-a-real-revision', {
      releaseEnvironment: 'staging',
      healthCheckCommand: 'test -f index.html',
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const deps = buildDeps(scenario, storage, () => {});

    let caught: unknown;
    try {
      await runReleaseTask(deps, scenario.task);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(NonRetryableTaskError);
  });

  it('DEVOS-077: an authorised rollback deploys the explicit revision and publishes its own RELEASE_EVIDENCE with action "rollback"', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'staging',
      healthCheckCommand: 'test -f index.html',
    });
    const storage = createLocalFilesystemStorage(storageDir);

    let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
    const deps = buildDeps(scenario, storage, (artifact, version) => {
      published = { artifact, version };
    });
    const rollbackTask: WorkflowTask = {
      ...scenario.task,
      input: { rollbackToRevision: commitSha },
    };

    const output = await runReleaseRollbackTask(deps, rollbackTask);

    expect(output.status).toBe('SUCCEEDED');
    expect(output.action).toBe('rollback');
    expect(output.revision).toBe(commitSha);
    const metadata = published?.version.metadata as Record<string, unknown>;
    expect(metadata.action).toBe('rollback');
    expect(metadata.derivedFromArtifactId).toBeUndefined();
  });

  it('DEVOS-077: an authorised rollback without an explicit rollbackToRevision throws — rollback is never automatic', async () => {
    const scenario = await buildScenario(repositoryPath, stagingRoot, commitSha, {
      releaseEnvironment: 'staging',
      healthCheckCommand: 'test -f index.html',
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const deps = buildDeps(scenario, storage, () => {});

    await expect(runReleaseRollbackTask(deps, scenario.task)).rejects.toThrow(
      'rollbackToRevision is required',
    );
  });

  describe('DEVOS-105: real Render deployment target selection', () => {
    function renderIntegrationFactory(projectId: Project['id']): Integration[] {
      const now = new Date(0).toISOString();
      return [
        {
          id: randomUUID() as Integration['id'],
          projectId,
          type: 'Deployment',
          provider: 'render',
          name: 'Render (production)',
          status: 'ACTIVE',
          credentialReference: 'DEVOS105_TEST_RENDER_API_KEY',
          configuration: { serviceId: 'srv-devos-pilot', environment: 'production' },
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    it('throws when a real Deployment integration is configured but no credentialResolver is available', async () => {
      const scenario = await buildScenario(
        repositoryPath,
        stagingRoot,
        commitSha,
        { releaseEnvironment: 'staging', healthCheckCommand: 'test -f index.html' },
        renderIntegrationFactory,
      );
      const storage = createLocalFilesystemStorage(storageDir);
      const deps = buildDeps(scenario, storage, () => {});

      await expect(runReleaseTask(deps, scenario.task)).rejects.toThrow(
        'no credentialResolver is available',
      );
    });

    it('throws when the configured credential reference cannot be resolved', async () => {
      const scenario = await buildScenario(
        repositoryPath,
        stagingRoot,
        commitSha,
        { releaseEnvironment: 'staging', healthCheckCommand: 'test -f index.html' },
        renderIntegrationFactory,
      );
      const storage = createLocalFilesystemStorage(storageDir);
      const credentialResolver: CredentialResolver = { resolve: async () => null };
      const deps = buildDeps(scenario, storage, () => {}, credentialResolver);

      await expect(runReleaseTask(deps, scenario.task)).rejects.toThrow(
        'Could not resolve a credential for reference "DEVOS105_TEST_RENDER_API_KEY"',
      );
    });

    it('deploys through the real Render API and health-checks over real HTTP when a Deployment integration and credential are configured', async () => {
      const scenario = await buildScenario(
        repositoryPath,
        stagingRoot,
        commitSha,
        { releaseEnvironment: 'staging', healthCheckCommand: 'test -f index.html' },
        renderIntegrationFactory,
      );
      const storage = createLocalFilesystemStorage(storageDir);
      const credentialResolver: CredentialResolver = { resolve: async () => 'render-test-key' };

      function jsonResponse(status: number, body: unknown): Response {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });
      }

      const fetchImpl = vi
        .fn()
        // POST trigger deploy
        .mockResolvedValueOnce(jsonResponse(201, { id: 'dep-1', status: 'live' }))
        // GET deploy status (poll)
        .mockResolvedValueOnce(jsonResponse(200, { id: 'dep-1', status: 'live' }))
        // GET service (resolve URL)
        .mockResolvedValueOnce(
          jsonResponse(200, {
            id: 'srv-devos-pilot',
            serviceDetails: { url: 'https://devos-pilot.onrender.com' },
          }),
        )
        // GET health check (real HTTP request to the deployed URL)
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));
      vi.stubGlobal('fetch', fetchImpl);

      let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
      const deps = buildDeps(
        scenario,
        storage,
        (artifact, version) => {
          published = { artifact, version };
        },
        credentialResolver,
      );

      try {
        const output = await runReleaseTask(deps, scenario.task);

        expect(output.status).toBe('SUCCEEDED');
        expect(output.passed).toBe(true);
        expect((output as { url?: string }).url).toBe('https://devos-pilot.onrender.com');
        const metadata = published?.version.metadata as Record<string, unknown>;
        expect((metadata.deployment as Record<string, unknown>).url).toBe(
          'https://devos-pilot.onrender.com',
        );

        const deployTriggerCall = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(deployTriggerCall[0]).toBe(
          'https://api.render.com/v1/services/srv-devos-pilot/deploys',
        );
        expect((deployTriggerCall[1].headers as Record<string, string>).authorization).toBe(
          'Bearer render-test-key',
        );
        const healthCheckCall = fetchImpl.mock.calls[3] as [string, RequestInit];
        expect(healthCheckCall[0]).toBe('https://devos-pilot.onrender.com');
      } finally {
        vi.unstubAllGlobals();
      }
    }, 30_000);
  });
});
