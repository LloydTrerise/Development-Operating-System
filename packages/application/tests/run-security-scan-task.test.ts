import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
import type { CredentialResolver } from '@devos/integrations';
import { runGit } from '@devos/integrations';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ToolTaskHandlerDeps } from '../src/tasks/deps.js';
import { runSecurityScanTask } from '../src/tasks/run-security-scan-task.js';

const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

// Mirrors run-validation-task.test.ts's exact scenario-building pattern —
// this task's own shape is deliberately a copy of runValidationTask's.
async function buildScenario(
  repositoryPath: string,
  branchName: string,
  overrides: Record<string, unknown>,
) {
  const organisationId = randomUUID() as OrganisationId;
  const now = new Date(0).toISOString();

  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId,
    name: 'Test Project',
    slug: 'test-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId: project.id,
    title: 'Add a status field',
    description: 'Users need a status field on the record.',
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
    taskKey: 'security-scan',
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
    metadata: { branchName, commitSha: 'deadbeef' },
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
    credentialReference: 'DEVOS113_TEST_CREDENTIAL',
    configuration: { repositoryPath, ...overrides },
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

  const securityScanCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'security-scan',
    name: 'Run Security Scan',
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
  const capabilities = [securityScanCapability];
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
  const integrations: IntegrationRepository = {
    getById: async (id) => (id === gitIntegration.id ? gitIntegration : null),
    listForProject: async () => [gitIntegration],
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

describe('runSecurityScanTask (DEVOS-113, real local git repository, real shell commands)', () => {
  let storageDir: string;
  let repositoryPath: string;
  const branchName = 'devos/add-status-md';

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-security-scan-task-storage-'));
    repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-run-security-scan-task-repo-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFile(path.join(repositoryPath, 'README.md'), '# test repo\n', 'utf8');
    await runGit(['add', 'README.md'], repositoryPath);
    await runGit(['commit', '-m', 'initial commit'], repositoryPath);
    await runGit(['checkout', '-b', branchName], repositoryPath);
    await writeFile(path.join(repositoryPath, 'STATUS.md'), '# status\n', 'utf8');
    await runGit(['add', 'STATUS.md'], repositoryPath);
    await runGit(['commit', '-m', 'Add STATUS.md'], repositoryPath);
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('runs a real passing scan and publishes a passed SECURITY_SCAN_EVIDENCE artifact', async () => {
    const scenario = await buildScenario(repositoryPath, branchName, {
      securityScanCommand: 'node -e "console.log(\'scan ok\')"',
    });
    const storage = createLocalFilesystemStorage(storageDir);

    let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
    const deps: ToolTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async (artifact, version) => {
        published = { artifact, version };
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
    };

    const output = await runSecurityScanTask(deps, scenario.task);

    expect(output.status).toBe('SUCCEEDED');
    expect(output.passed).toBe(true);
    expect(output.scanExitCode).toBe(0);
    expect(published?.artifact.artifactType).toBe('SECURITY_SCAN_EVIDENCE');
    const metadata = published?.version.metadata as Record<string, unknown>;
    expect(metadata.passed).toBe(true);
    expect(metadata.derivedFromArtifactId).toBe(scenario.codeChangeArtifact.id);
    expect((metadata.scan as Record<string, unknown>).exitCode).toBe(0);
    expect(String((metadata.scan as Record<string, unknown>).stdout)).toContain('scan ok');

    expect(scenario.toolInvocations.filter((i) => i.status === 'SUCCEEDED')).toHaveLength(1);
  }, 30_000);

  it('runs a real genuinely failing scan and publishes a not-passed SECURITY_SCAN_EVIDENCE artifact without throwing', async () => {
    const scenario = await buildScenario(repositoryPath, branchName, {
      securityScanCommand: 'node -e "console.error(\'vulnerability found\'); process.exit(1)"',
    });
    const storage = createLocalFilesystemStorage(storageDir);

    let published: { artifact: Artifact; version: ArtifactVersion } | undefined;
    const deps: ToolTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async (artifact, version) => {
        published = { artifact, version };
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
    };

    const output = await runSecurityScanTask(deps, scenario.task);

    expect(output.status).toBe('SUCCEEDED');
    expect(output.passed).toBe(false);
    expect(output.scanExitCode).toBe(1);
    const metadata = published?.version.metadata as Record<string, unknown>;
    expect(metadata.passed).toBe(false);
    expect(String((metadata.scan as Record<string, unknown>).stderr)).toContain(
      'vulnerability found',
    );
  }, 30_000);

  it('throws when no configured securityScanCommand exists', async () => {
    const scenario = await buildScenario(repositoryPath, branchName, {
      securityScanCommand: '',
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const deps: ToolTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      integrations: scenario.integrations,
    };

    await expect(runSecurityScanTask(deps, scenario.task)).rejects.toThrow(
      'no configured "securityScanCommand"',
    );
  });

  it('throws when a real GitHub target is configured but no credentialResolver is available', async () => {
    const scenario = await buildScenario(repositoryPath, branchName, {
      securityScanCommand: 'node -e "console.log(\'scan ok\')"',
      github: { owner: 'devos-org', repo: 'devos-pilot' },
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const deps: ToolTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      integrations: scenario.integrations,
      // credentialResolver intentionally omitted.
    };

    await expect(runSecurityScanTask(deps, scenario.task)).rejects.toThrow(
      'no credentialResolver is available',
    );
  }, 30_000);

  it('resolves the real credential when a real GitHub target is configured', async () => {
    const scenario = await buildScenario(repositoryPath, branchName, {
      securityScanCommand: 'node -e "console.log(\'scan ok\')"',
      github: { owner: 'devos-org', repo: 'devos-pilot' },
    });
    const storage = createLocalFilesystemStorage(storageDir);
    const resolvedReferences: string[] = [];
    const credentialResolver: CredentialResolver = {
      resolve: async (reference) => {
        resolvedReferences.push(reference);
        return 'ghp_test_token';
      },
    };

    const deps: ToolTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      storage,
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      integrations: scenario.integrations,
      credentialResolver,
    };

    const output = await runSecurityScanTask(deps, scenario.task);

    expect(output.status).toBe('SUCCEEDED');
    expect(resolvedReferences).toEqual([scenario.gitIntegration.credentialReference]);
  }, 30_000);
});
