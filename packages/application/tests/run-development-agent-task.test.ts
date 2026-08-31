import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import type {
  Agent,
  AgentExecution,
  AgentExecutionRepository,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  Artifact,
  ArtifactRepository,
  ArtifactVersion,
  ArtifactVersionRepository,
  AuditRecord,
  AuditRecordRepository,
  ContextManifest,
  Integration,
  IntegrationRepository,
  KnowledgeSourceRepository,
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
import { createLocalPullRequestProvider, runGit } from '@devos/integrations';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevelopmentAgentTaskHandlerDeps } from '../src/tasks/deps.js';
import { runDevelopmentAgentTask } from '../src/tasks/run-development-agent-task.js';

const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

const CONFIGURATION = {
  role: 'DEVELOPMENT',
  provider: 'fake',
  modelRef: 'fake-model',
  outputSchemaRef: 'proposed-change-v1',
  // DEVOS-085: the three capabilities this task actually invokes on the
  // agent's behalf, now enforced by the Tool Gateway.
  allowedCapabilities: ['repo-write', 'git-commit', 'pull-request-create'],
};

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};

const schemas: SchemaRepository = {
  resolve: async () => ({
    name: 'proposed-change',
    version: 1,
    fields: {
      summary: { type: 'string' },
      branchName: { type: 'string' },
      commitMessage: { type: 'string' },
      files: { type: 'array' },
    },
  }),
};

async function buildScenario(
  repositoryPath: string,
  configuration = CONFIGURATION,
  gitIntegrationConfigurationOverrides: Record<string, unknown> = {},
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

  const agent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId: project.id,
    key: 'development-agent',
    name: 'Development Agent',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: agent.id,
    version: 1,
    status: 'PUBLISHED',
    configuration,
    promptReference: 'developer/v1',
    createdBy: 'alice',
    createdAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'development',
    taskType: 'AGENT_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: { agentRef: agent.key },
    createdAt: now,
    updatedAt: now,
  };

  const planArtifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId: project.id,
    artifactType: 'IMPLEMENTATION_PLAN',
    name: `Implementation Plan — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
    createdBy: SYSTEM_ACTOR_ID,
    createdAt: now,
    updatedAt: now,
  };
  const planVersion: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: planArtifact.id,
    version: 1,
    contentType: 'application/json',
    contentUri: 'file:///plan.json',
    contentHash: 'a'.repeat(64),
    metadata: {
      summary: 'Add a status field to the record and its API.',
      tasks: ['Add a status column.', 'Expose it in the API.'],
    },
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
    credentialReference: 'DEVOS057_TEST_CREDENTIAL',
    configuration: { repositoryPath, ...gitIntegrationConfigurationOverrides },
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

  const repoWriteCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'repo-write',
    name: 'Write Repository File',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
        branch: { type: 'string' },
      },
      required: ['path', 'content', 'branch'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: now,
  };
  const gitCommitCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'git-commit',
    name: 'Create Git Commit',
    riskClass: 'R2',
    inputSchema: {
      type: 'object',
      properties: { branch: { type: 'string' }, message: { type: 'string' } },
      required: ['branch', 'message'],
    },
    outputSchema: { type: 'object' },
    status: 'ACTIVE',
    createdAt: now,
  };
  const pullRequestCreateCapability: ToolCapability = {
    id: randomUUID() as ToolCapability['id'],
    projectId: project.id,
    key: 'pull-request-create',
    name: 'Create Pull Request',
    riskClass: 'R3',
    inputSchema: {
      type: 'object',
      properties: {
        sourceBranch: { type: 'string' },
        targetBranch: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['sourceBranch', 'targetBranch', 'title'],
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
  // DEVOS-109: runAgentTask now calls buildContext(), which needs this too.
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async () => null,
    listForProject: async () => [],
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
  const capabilities = [repoWriteCapability, gitCommitCapability, pullRequestCreateCapability];
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
  const agents: AgentRepository = {
    getById: async (id) => (id === agent.id ? agent : null),
    getByProjectAndKey: async (pid, key) =>
      pid === project.id && key === agent.key ? agent : null,
    listForProject: async () => [agent],
    create: async () => {},
  };
  const agentVersions: AgentVersionRepository = {
    getById: async (id) => (id === version.id ? version : null),
    getByAgentAndVersion: async () => null,
    getLatestForAgent: async () => version,
    listForAgent: async (agentId) => (agentId === agent.id ? [version] : []),
    create: async () => {},
    publish: async () => {},
  };

  const executions: AgentExecution[] = [];
  const agentExecutions: AgentExecutionRepository = {
    getById: async (id) => executions.find((e) => e.id === id) ?? null,
    listForTask: async (taskId) => executions.filter((e) => e.workflowTaskId === taskId),
    create: async (execution) => {
      executions.push(execution);
    },
    complete: async (id, output, uncertainty, completedAt) => {
      const index = executions.findIndex((e) => e.id === id);
      executions[index] = {
        ...executions[index]!,
        status: 'SUCCEEDED',
        output,
        ...(uncertainty !== undefined ? { uncertainty } : {}),
        completedAt,
      };
    },
    fail: async (id, errorCode, errorMessage, completedAt) => {
      const index = executions.findIndex((e) => e.id === id);
      executions[index] = {
        ...executions[index]!,
        status: 'FAILED',
        ...(errorCode !== undefined ? { errorCode } : {}),
        errorMessage,
        completedAt,
      };
    },
  };

  const contextManifests: ContextManifest[] = [];
  const recordContextManifest = async (manifest: ContextManifest): Promise<void> => {
    contextManifests.push(manifest);
  };

  const artifacts: ArtifactRepository = {
    getById: async (id) => (id === planArtifact.id ? planArtifact : null),
    listForProject: async () => [planArtifact],
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => (id === planVersion.id ? planVersion : null),
    listForArtifact: async (artifactId) => (artifactId === planArtifact.id ? [planVersion] : []),
    create: async () => {},
  };

  return {
    project,
    workItem,
    run,
    agent,
    version,
    task,
    planArtifact,
    planVersion,
    gitIntegration,
    workflowRuns,
    workItems,
    agents,
    agentVersions,
    agentExecutions,
    executions,
    contextManifests,
    recordContextManifest,
    artifacts,
    artifactVersions,
    projects,
    knowledgeSources,
    memberships,
    policies,
    toolCapabilities,
    toolInvocations,
    toolInvocationRepository,
    auditRecordRepository,
    integrations,
  };
}

describe('runDevelopmentAgentTask (real local git repository)', () => {
  let storageDir: string;
  let repositoryPath: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-development-agent-task-storage-'));
    repositoryPath = await mkdtemp(path.join(tmpdir(), 'devos-run-development-agent-task-repo-'));
    await runGit(['init'], repositoryPath);
    await runGit(['config', 'user.email', 'devos-test@example.com'], repositoryPath);
    await runGit(['config', 'user.name', 'DevOS Test'], repositoryPath);
    await writeFile(path.join(repositoryPath, 'README.md'), '# test repo\n', 'utf8');
    await runGit(['add', 'README.md'], repositoryPath);
    await runGit(['commit', '-m', 'initial commit'], repositoryPath);
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('applies the proposed change through the Tool Gateway and publishes a CODE_CHANGE artifact', async () => {
    const scenario = await buildScenario(repositoryPath);

    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Add a STATUS.md file documenting the new status field.',
          branchName: 'devos/add-status-field',
          commitMessage: 'Add status field documentation',
          files: [{ path: 'STATUS.md', content: 'status: planned\n' }],
        },
      }),
    };

    let publishedArtifact: Artifact | undefined;
    let publishedVersion: ArtifactVersion | undefined;

    const deps: DevelopmentAgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async (artifact, version) => {
        publishedArtifact = artifact;
        publishedVersion = version;
      },
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      pullRequestProvider: createLocalPullRequestProvider(),
      integrations: scenario.integrations,
    };

    const output = await runDevelopmentAgentTask(deps, scenario.task);

    expect(output).toMatchObject({ status: 'SUCCEEDED', artifactType: 'CODE_CHANGE' });
    expect(publishedArtifact).toMatchObject({ artifactType: 'CODE_CHANGE', status: 'GENERATED' });
    expect(publishedVersion?.metadata).toMatchObject({
      branchName: 'devos/add-status-field',
      commitMessage: 'Add status field documentation',
      files: ['STATUS.md'],
      pullRequestReference: expect.any(String),
    });

    // The real repository actually has the branch and the committed file —
    // the model never touched the filesystem itself.
    const { stdout: branches } = await runGit(['branch', '--list'], repositoryPath);
    expect(branches).toContain('devos/add-status-field');
    const { stdout: log } = await runGit(
      ['log', 'devos/add-status-field', '--oneline', '-1'],
      repositoryPath,
    );
    expect(log).toContain('Add status field documentation');
    // Pushing updates the source repository's refs, not its checked-out
    // working tree (still "master") — read the pushed branch's blob
    // directly rather than expecting the file on disk there.
    const { stdout: written } = await runGit(
      ['show', 'devos/add-status-field:STATUS.md'],
      repositoryPath,
    );
    expect(written).toBe('status: planned\n');

    expect(scenario.toolInvocations.filter((i) => i.status === 'SUCCEEDED')).toHaveLength(3);

    // The workspace is a temp directory, not the source repository, and
    // must be reliably cleaned up.
    const commitSha = (output as { commitSha?: string }).commitSha;
    expect(commitSha).toMatch(/^[0-9a-f]{40}$/);
    const pullRequestReference = (output as { pullRequestReference?: string }).pullRequestReference;
    expect(pullRequestReference).toBeTruthy();
  }, 30_000);

  it('DEVOS-067: folds the latest CHANGES_REQUIRED review findings into the model input on a rework attempt', async () => {
    const scenario = await buildScenario(repositoryPath);

    const reviewArtifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId: scenario.project.id,
      artifactType: 'REVIEW_EVIDENCE',
      name: 'Review Evidence',
      status: 'GENERATED',
      workflowRunId: randomUUID() as Artifact['workflowRunId'],
      workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
      createdBy: SYSTEM_ACTOR_ID,
      createdAt: new Date(1).toISOString(),
      updatedAt: new Date(1).toISOString(),
    };
    const reviewVersion: ArtifactVersion = {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: reviewArtifact.id,
      version: 1,
      contentType: 'application/json',
      contentUri: 'file:///review.json',
      contentHash: 'b'.repeat(64),
      metadata: {
        decision: 'CHANGES_REQUIRED',
        findings: [{ severity: 'BLOCKER', description: 'Missing error handling.' }],
      },
      createdBy: SYSTEM_ACTOR_ID,
      createdAt: reviewArtifact.createdAt,
    };

    const artifactsWithReview: ArtifactRepository = {
      getById: async (id) =>
        id === scenario.planArtifact.id
          ? scenario.planArtifact
          : id === reviewArtifact.id
            ? reviewArtifact
            : null,
      listForProject: async () => [scenario.planArtifact, reviewArtifact],
      create: async () => {},
    };
    const artifactVersionsWithReview: ArtifactVersionRepository = {
      getById: async (id) =>
        id === scenario.planVersion.id
          ? scenario.planVersion
          : id === reviewVersion.id
            ? reviewVersion
            : null,
      listForArtifact: async (artifactId) =>
        artifactId === scenario.planArtifact.id
          ? [scenario.planVersion]
          : artifactId === reviewArtifact.id
            ? [reviewVersion]
            : [],
      create: async () => {},
    };

    let receivedInput: Record<string, unknown> | undefined;
    const modelAdapter: AgentModelAdapter = {
      invoke: async (request) => {
        receivedInput = request.input;
        return {
          status: 'SUCCEEDED',
          result: {
            summary: 'Add error handling as requested.',
            branchName: 'devos/add-status-field',
            commitMessage: 'Add status field with error handling',
            files: [{ path: 'STATUS.md', content: 'status: planned\n' }],
          },
        };
      },
    };

    const deps: DevelopmentAgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: artifactsWithReview,
      artifactVersions: artifactVersionsWithReview,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      pullRequestProvider: createLocalPullRequestProvider(),
      integrations: scenario.integrations,
    };

    await runDevelopmentAgentTask(deps, scenario.task);

    expect(receivedInput?.priorReviewFindings).toEqual([
      { severity: 'BLOCKER', description: 'Missing error handling.' },
    ]);
  }, 30_000);

  it('throws (without applying anything) when the agent proposes no file changes', async () => {
    const scenario = await buildScenario(repositoryPath);
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Nothing to do.',
          branchName: 'devos/noop',
          commitMessage: 'noop',
          files: [],
        },
      }),
    };

    const deps: DevelopmentAgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      pullRequestProvider: createLocalPullRequestProvider(),
      integrations: scenario.integrations,
    };

    await expect(runDevelopmentAgentTask(deps, scenario.task)).rejects.toThrow(
      'proposed no file changes',
    );
    expect(scenario.toolInvocations).toHaveLength(0);
  });

  it('DEVOS-085: rejects the proposed change when the agent version is not allowed the repo-write capability', async () => {
    const scenario = await buildScenario(repositoryPath, {
      ...CONFIGURATION,
      allowedCapabilities: ['git-commit', 'pull-request-create'],
    });

    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Add a STATUS.md file documenting the new status field.',
          branchName: 'devos/add-status-field',
          commitMessage: 'Add status field documentation',
          files: [{ path: 'STATUS.md', content: 'status: planned\n' }],
        },
      }),
    };

    const deps: DevelopmentAgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      memberships: scenario.memberships,
      policies: scenario.policies,
      toolCapabilities: scenario.toolCapabilities,
      toolInvocations: scenario.toolInvocationRepository,
      auditRecords: scenario.auditRecordRepository,
      pullRequestProvider: createLocalPullRequestProvider(),
      integrations: scenario.integrations,
    };

    await expect(runDevelopmentAgentTask(deps, scenario.task)).rejects.toThrow(
      'DEVOS_AGENT_CAPABILITY_DENIED',
    );

    // Rejected before ever reaching the git adapter — no branch was created.
    const { stdout: branches } = await runGit(['branch', '--list'], repositoryPath);
    expect(branches).not.toContain('devos/add-status-field');
  }, 30_000);

  describe('DEVOS-104: real GitHub target selection', () => {
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Add a STATUS.md file documenting the new status field.',
          branchName: 'devos/add-status-field',
          commitMessage: 'Add status field documentation',
          files: [{ path: 'STATUS.md', content: 'status: planned\n' }],
        },
      }),
    };

    it('throws when a real GitHub target is configured but no credentialResolver is available', async () => {
      const scenario = await buildScenario(repositoryPath, CONFIGURATION, {
        github: { owner: 'devos-org', repo: 'devos-pilot' },
      });

      const deps: DevelopmentAgentTaskHandlerDeps = {
        workflowRuns: scenario.workflowRuns,
        workItems: scenario.workItems,
        agents: scenario.agents,
        agentVersions: scenario.agentVersions,
        agentExecutions: scenario.agentExecutions,
        modelAdapter,
        prompts,
        schemas,
        recordContextManifest: scenario.recordContextManifest,
        storage: createLocalFilesystemStorage(storageDir),
        publishArtifact: async () => {},
        artifacts: scenario.artifacts,
        artifactVersions: scenario.artifactVersions,
        projects: scenario.projects,
        knowledgeSources: scenario.knowledgeSources,
        memberships: scenario.memberships,
        policies: scenario.policies,
        toolCapabilities: scenario.toolCapabilities,
        toolInvocations: scenario.toolInvocationRepository,
        auditRecords: scenario.auditRecordRepository,
        pullRequestProvider: createLocalPullRequestProvider(),
        integrations: scenario.integrations,
        // credentialResolver intentionally omitted.
      };

      await expect(runDevelopmentAgentTask(deps, scenario.task)).rejects.toThrow(
        'no credentialResolver is available',
      );
    }, 30_000);

    it('throws when the configured credential reference cannot be resolved', async () => {
      const scenario = await buildScenario(repositoryPath, CONFIGURATION, {
        github: { owner: 'devos-org', repo: 'devos-pilot' },
      });
      const credentialResolver: CredentialResolver = { resolve: async () => null };

      const deps: DevelopmentAgentTaskHandlerDeps = {
        workflowRuns: scenario.workflowRuns,
        workItems: scenario.workItems,
        agents: scenario.agents,
        agentVersions: scenario.agentVersions,
        agentExecutions: scenario.agentExecutions,
        modelAdapter,
        prompts,
        schemas,
        recordContextManifest: scenario.recordContextManifest,
        storage: createLocalFilesystemStorage(storageDir),
        publishArtifact: async () => {},
        artifacts: scenario.artifacts,
        artifactVersions: scenario.artifactVersions,
        projects: scenario.projects,
        knowledgeSources: scenario.knowledgeSources,
        memberships: scenario.memberships,
        policies: scenario.policies,
        toolCapabilities: scenario.toolCapabilities,
        toolInvocations: scenario.toolInvocationRepository,
        auditRecords: scenario.auditRecordRepository,
        pullRequestProvider: createLocalPullRequestProvider(),
        integrations: scenario.integrations,
        credentialResolver,
      };

      await expect(runDevelopmentAgentTask(deps, scenario.task)).rejects.toThrow(
        'Could not resolve a credential for reference "DEVOS057_TEST_CREDENTIAL"',
      );
    }, 30_000);

    it('opens the pull request through the real GitHub API when a real target and credential are both configured', async () => {
      const scenario = await buildScenario(repositoryPath, CONFIGURATION, {
        github: { owner: 'devos-org', repo: 'devos-pilot' },
      });
      const credentialResolver: CredentialResolver = { resolve: async () => 'ghp_test_token' };

      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 })) // open-PR check
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              number: 99,
              title: 'Add a STATUS.md file documenting the new status field.',
              body: 'Add status field documentation',
              html_url: 'https://github.com/devos-org/devos-pilot/pull/99',
              head: { ref: 'devos/add-status-field' },
              base: { ref: 'main' },
            }),
            { status: 201 },
          ),
        );
      vi.stubGlobal('fetch', fetchImpl);

      const deps: DevelopmentAgentTaskHandlerDeps = {
        workflowRuns: scenario.workflowRuns,
        workItems: scenario.workItems,
        agents: scenario.agents,
        agentVersions: scenario.agentVersions,
        agentExecutions: scenario.agentExecutions,
        modelAdapter,
        prompts,
        schemas,
        recordContextManifest: scenario.recordContextManifest,
        storage: createLocalFilesystemStorage(storageDir),
        publishArtifact: async () => {},
        artifacts: scenario.artifacts,
        artifactVersions: scenario.artifactVersions,
        projects: scenario.projects,
        knowledgeSources: scenario.knowledgeSources,
        memberships: scenario.memberships,
        policies: scenario.policies,
        toolCapabilities: scenario.toolCapabilities,
        toolInvocations: scenario.toolInvocationRepository,
        auditRecords: scenario.auditRecordRepository,
        pullRequestProvider: createLocalPullRequestProvider(),
        integrations: scenario.integrations,
        credentialResolver,
      };

      try {
        const output = await runDevelopmentAgentTask(deps, scenario.task);

        expect((output as { pullRequestReference?: string }).pullRequestReference).toBe('99');
        const createCall = fetchImpl.mock.calls.find(
          ([, init]: [string, RequestInit]) => init?.method === 'POST',
        ) as [string, RequestInit];
        expect(createCall[0]).toBe('https://api.github.com/repos/devos-org/devos-pilot/pulls');
        expect((createCall[1].headers as Record<string, string>).authorization).toBe(
          'Bearer ghp_test_token',
        );
      } finally {
        vi.unstubAllGlobals();
      }
    }, 30_000);
  });
});
