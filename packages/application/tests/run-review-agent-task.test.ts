import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import type { ProjectTypeId } from '@devos/contracts';
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
  ContextManifest,
  KnowledgeSource,
  KnowledgeSourceRepository,
  Membership,
  MembershipRepository,
  Project,
  ProjectId,
  ProjectRepository,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewAgentTaskHandlerDeps } from '../src/tasks/deps.js';
import { runReviewAgentTask } from '../src/tasks/run-review-agent-task.js';

const CONFIGURATION = {
  role: 'REVIEW',
  provider: 'fake',
  modelRef: 'fake-model',
  outputSchemaRef: 'review-evidence-v1',
  allowedCapabilities: [],
};

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};

const schemas: SchemaRepository = {
  resolve: async () => ({
    name: 'review-evidence',
    version: 1,
    fields: {
      summary: { type: 'string' },
      decision: { type: 'string' },
      findings: { type: 'array' },
    },
  }),
};

function buildScenario() {
  const projectId = randomUUID() as ProjectId;
  const now = new Date(0).toISOString();

  const project: Project = {
    id: projectId,
    organisationId: randomUUID() as Project['organisationId'],
    projectTypeId: randomUUID() as ProjectTypeId,
    name: 'Test Project',
    slug: 'test-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
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
    projectId,
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: workItem.id,
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const agent: Agent = {
    id: randomUUID() as Agent['id'],
    projectId,
    key: 'review-agent',
    name: 'Review Agent',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const version: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: agent.id,
    version: 1,
    status: 'PUBLISHED',
    configuration: CONFIGURATION,
    promptReference: 'review/v1',
    createdBy: 'alice',
    createdAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'review',
    taskType: 'AGENT_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: { agentRef: agent.key },
    createdAt: now,
    updatedAt: now,
  };

  function makeArtifact(artifactType: string, offsetMs: number): Artifact {
    return {
      id: randomUUID() as Artifact['id'],
      projectId,
      artifactType,
      name: `${artifactType} — ${workItem.title}`,
      status: 'GENERATED',
      workflowRunId: run.id,
      workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
      createdBy: 'devos-agent-runtime',
      createdAt: new Date(offsetMs).toISOString(),
      updatedAt: new Date(offsetMs).toISOString(),
    };
  }
  function makeVersion(artifact: Artifact, metadata: Record<string, unknown>): ArtifactVersion {
    return {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifact.id,
      version: 1,
      contentType: 'application/json',
      contentUri: `file:///${artifact.artifactType}.json`,
      contentHash: 'a'.repeat(64),
      metadata,
      createdBy: 'devos-agent-runtime',
      createdAt: artifact.createdAt,
    };
  }

  const prdArtifact = makeArtifact('PRD', 1);
  const prdVersion = makeVersion(prdArtifact, { summary: 'Add a status field.' });
  const designArtifact = makeArtifact('TECHNICAL_DESIGN', 2);
  const designVersion = makeVersion(designArtifact, { summary: 'Add a status column.' });
  const planArtifact = makeArtifact('IMPLEMENTATION_PLAN', 3);
  const planVersion = makeVersion(planArtifact, { summary: 'Add the column and expose it.' });
  const codeChangeArtifact = makeArtifact('CODE_CHANGE', 4);
  const codeChangeVersion = makeVersion(codeChangeArtifact, {
    branchName: 'devos/add-status-field',
    commitSha: 'deadbeef',
    files: ['STATUS.md'],
  });
  const testEvidenceArtifact = makeArtifact('TEST_EVIDENCE', 5);
  const testEvidenceVersion = makeVersion(testEvidenceArtifact, {
    passed: true,
    build: { exitCode: 0 },
    test: { exitCode: 0 },
  });

  const activeKnowledgeSource: KnowledgeSource = {
    id: randomUUID() as KnowledgeSource['id'],
    projectId,
    key: 'coding-standards',
    name: 'Coding standards',
    sourceType: 'TEXT',
    content: 'Use TypeScript strict mode.',
    status: 'ACTIVE',
    createdBy: 'alice',
    createdAt: now,
    updatedAt: now,
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
    update: async (id, changes) => {
      if (id !== workItem.id) return;
      Object.assign(workItem, changes);
    },
  };

  const systemActorMembership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: project.organisationId,
    projectId,
    principalId: 'devos-agent-runtime',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  const memberships: MembershipRepository = {
    getById: async () => null,
    getForPrincipalAndProject: async (principalId, pid) =>
      principalId === systemActorMembership.principalId && pid === projectId
        ? systemActorMembership
        : null,
    listForPrincipal: async () => [],
    listForProject: async () => [systemActorMembership],
    create: async () => {},
    updateRole: async () => {},
    remove: async () => {},
  };

  const workflowDefinition: WorkflowDefinition = {
    id: randomUUID() as WorkflowDefinition['id'],
    projectId,
    key: 'development-path',
    name: 'Development Path',
    description: 'Test workflow',
    createdAt: now,
    updatedAt: now,
  };
  const workflowVersion: WorkflowVersion = {
    id: run.workflowVersionId,
    workflowDefinitionId: workflowDefinition.id,
    version: 1,
    status: 'PUBLISHED',
    definition: {
      name: 'Development Path',
      trigger: { type: 'WORK_ITEM_MANUAL' },
      inputs: [],
      nodes: [{ id: 'development', type: 'AGENT_TASK', name: 'Development', agentRef: agent.key }],
      edges: [],
      outputs: [],
    },
    publishedAt: now,
    createdBy: 'alice',
    createdAt: now,
  };
  const workflowDefinitions: WorkflowDefinitionRepository = {
    getById: async (id) => (id === workflowDefinition.id ? workflowDefinition : null),
    getByProjectAndKey: async () => null,
    listForProject: async () => [workflowDefinition],
    create: async () => {},
  };
  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) => (id === workflowVersion.id ? workflowVersion : null),
    getByDefinitionAndVersion: async () => null,
    listForDefinition: async () => [workflowVersion],
    create: async () => {},
    publish: async () => {},
  };
  const workflowTasks: WorkflowTaskRepository = {
    getById: async () => null,
    listForRun: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const startRunCalls: { workItemId: string; idempotencyKey: string }[] = [];
  const createdRuns: WorkflowRun[] = [];
  const startRun = async (newRun: WorkflowRun): Promise<void> => {
    startRunCalls.push({ workItemId: newRun.workItemId, idempotencyKey: newRun.idempotencyKey! });
    createdRuns.push(newRun);
  };
  const createDraft = async (): Promise<void> => {};
  const agents: AgentRepository = {
    getById: async (id) => (id === agent.id ? agent : null),
    getByProjectAndKey: async (pid, key) => (pid === projectId && key === agent.key ? agent : null),
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

  let projectArtifacts: Artifact[] = [
    prdArtifact,
    designArtifact,
    planArtifact,
    codeChangeArtifact,
    testEvidenceArtifact,
  ];
  const artifactVersionsByArtifactId = new Map<string, ArtifactVersion[]>([
    [prdArtifact.id, [prdVersion]],
    [designArtifact.id, [designVersion]],
    [planArtifact.id, [planVersion]],
    [codeChangeArtifact.id, [codeChangeVersion]],
    [testEvidenceArtifact.id, [testEvidenceVersion]],
  ]);
  const artifacts: ArtifactRepository = {
    getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
    listForProject: async () => projectArtifacts,
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => {
      for (const versions of artifactVersionsByArtifactId.values()) {
        const found = versions.find((v) => v.id === id);
        if (found) return found;
      }
      return null;
    },
    listForArtifact: async (artifactId) => artifactVersionsByArtifactId.get(artifactId) ?? [],
    create: async () => {},
  };

  const projects: ProjectRepository = {
    getById: async (id) => (id === project.id ? project : null),
    listForOrganisation: async () => [project],
    create: async () => {},
    update: async () => {},
  };
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async (id) => (id === activeKnowledgeSource.id ? activeKnowledgeSource : null),
    getByProjectAndKey: async (pid, key) =>
      pid === projectId && key === activeKnowledgeSource.key ? activeKnowledgeSource : null,
    listForProject: async () => [activeKnowledgeSource],
    create: async () => {},
  };

  return {
    projectId,
    project,
    workItem,
    run,
    agent,
    version,
    task,
    prdArtifact,
    prdVersion,
    codeChangeArtifact,
    codeChangeVersion,
    testEvidenceArtifact,
    activeKnowledgeSource,
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
    workflowDefinitions,
    workflowVersions,
    workflowTasks,
    createDraft,
    startRun,
    startRunCalls,
    createdRuns,
    removeCodeChangeArtifact: () => {
      projectArtifacts = projectArtifacts.filter((a) => a.artifactType !== 'CODE_CHANGE');
    },
  };
}

describe('runReviewAgentTask', () => {
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-review-agent-task-'));
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('publishes a PASS REVIEW_EVIDENCE artifact and passes engineering standards/prior artifacts to the model', async () => {
    const scenario = buildScenario();
    let receivedInput: Record<string, unknown> | undefined;
    const modelAdapter: AgentModelAdapter = {
      invoke: async (request) => {
        receivedInput = request.input;
        return {
          status: 'SUCCEEDED',
          result: { summary: 'Looks good.', decision: 'PASS', findings: [] },
        };
      },
    };

    let publishedArtifact: Artifact | undefined;
    let publishedVersion: ArtifactVersion | undefined;

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    const output = await runReviewAgentTask(deps, scenario.task);

    expect(receivedInput?.prd).toEqual(scenario.prdVersion.metadata);
    expect(receivedInput?.codeChange).toEqual(scenario.codeChangeVersion.metadata);
    expect(receivedInput?.engineeringStandards).toEqual([scenario.activeKnowledgeSource.content]);

    expect(publishedArtifact).toMatchObject({
      artifactType: 'REVIEW_EVIDENCE',
      status: 'GENERATED',
    });
    expect(publishedVersion?.metadata).toMatchObject({
      decision: 'PASS',
      findings: [],
      derivedFromArtifactId: scenario.codeChangeArtifact.id,
    });
    expect(output).toMatchObject({ status: 'SUCCEEDED', decision: 'PASS', findings: [] });

    expect(scenario.contextManifests).toHaveLength(1);
    expect(scenario.contextManifests[0]?.sources).toContainEqual(
      expect.objectContaining({ type: 'KNOWLEDGE_SOURCE' }),
    );
  });

  it('publishes CHANGES_REQUIRED when the model reports a BLOCKER finding', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Found a blocking issue.',
          decision: 'CHANGES_REQUIRED',
          findings: [{ severity: 'BLOCKER', description: 'Missing null check.' }],
        },
      }),
    };

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    const output = await runReviewAgentTask(deps, scenario.task);
    expect(output).toMatchObject({
      status: 'SUCCEEDED',
      decision: 'CHANGES_REQUIRED',
      findings: [{ severity: 'BLOCKER', description: 'Missing null check.' }],
      reworkRunId: expect.any(String),
    });

    // DEVOS-067: a CHANGES_REQUIRED decision automatically starts a new
    // run of the same workflow version, for the same work item.
    expect(scenario.startRunCalls).toHaveLength(1);
    expect(scenario.startRunCalls[0]).toMatchObject({ workItemId: scenario.workItem.id });
    expect(scenario.workItem.metadata.reworkCount).toBe(1);
  });

  it('does not start a rework run when the decision is PASS', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: { summary: 'All good.', decision: 'PASS', findings: [] },
      }),
    };

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    const output = await runReviewAgentTask(deps, scenario.task);
    expect(output.decision).toBe('PASS');
    expect(output).not.toHaveProperty('reworkRunId');
    expect(scenario.startRunCalls).toHaveLength(0);
  });

  it('DEVOS-068: stops auto-triggering rework and escalates the work item after the configured limit', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'Still broken.',
          decision: 'CHANGES_REQUIRED',
          findings: [{ severity: 'BLOCKER', description: 'Still missing null check.' }],
        },
      }),
    };

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    // Run the review three times in a row (the third exceeds the
    // configured 2-automatic-rework-cycle limit).
    await runReviewAgentTask(deps, scenario.task);
    await runReviewAgentTask(deps, scenario.task);
    const thirdOutput = await runReviewAgentTask(deps, scenario.task);

    expect(scenario.startRunCalls).toHaveLength(2);
    expect(thirdOutput).not.toHaveProperty('reworkRunId');
    expect(thirdOutput.escalated).toBe(true);
    expect(scenario.workItem.status).toBe('REWORK_LIMIT_REACHED');
  });

  it('normalizes an ambiguous decision to CHANGES_REQUIRED rather than silently passing', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: { summary: 'Unclear.', decision: 'MAYBE', findings: [] },
      }),
    };

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    const output = await runReviewAgentTask(deps, scenario.task);
    expect(output.decision).toBe('CHANGES_REQUIRED');
  });

  it('throws when no CODE_CHANGE artifact exists for the project', async () => {
    const scenario = buildScenario();
    scenario.removeCodeChangeArtifact();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: ReviewAgentTaskHandlerDeps = {
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
      workflowDefinitions: scenario.workflowDefinitions,
      workflowVersions: scenario.workflowVersions,
      workflowTasks: scenario.workflowTasks,
      createDraft: scenario.createDraft,
      startRun: scenario.startRun,
    };

    await expect(runReviewAgentTask(deps, scenario.task)).rejects.toThrow(
      'No CODE_CHANGE artifact found',
    );
  });
});
