import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
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
  ContextManifest,
  KnowledgeSourceRepository,
  ProjectId,
  ProjectRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runPlanningAgentTask } from '../src/tasks/run-planning-agent-task.js';
import type { AgentArtifactConsumerTaskHandlerDeps } from '../src/tasks/deps.js';

const CONFIGURATION = {
  role: 'PLANNING',
  provider: 'fake',
  modelRef: 'fake-model',
  outputSchemaRef: 'implementation-plan-v1',
  allowedCapabilities: [],
};

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};

const schemas: SchemaRepository = {
  resolve: async () => ({
    name: 'implementation-plan',
    version: 1,
    fields: { summary: { type: 'string' }, tasks: { type: 'array' } },
  }),
};

function buildScenario() {
  const projectId = randomUUID() as ProjectId;
  const now = new Date(0).toISOString();

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
    title: 'Investigate slow query',
    description: 'Users report timeouts.',
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
    key: 'planning-agent',
    name: 'Planning Agent',
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
    promptReference: 'planning/v1',
    createdBy: 'alice',
    createdAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'planning',
    taskType: 'AGENT_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: { agentRef: agent.key },
    createdAt: now,
    updatedAt: now,
  };

  const designArtifact: Artifact = {
    id: randomUUID() as Artifact['id'],
    projectId,
    artifactType: 'TECHNICAL_DESIGN',
    name: `Technical Design — ${workItem.title}`,
    status: 'GENERATED',
    workflowRunId: run.id,
    workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
    createdBy: 'devos-agent-runtime',
    createdAt: now,
    updatedAt: now,
  };
  const designVersion: ArtifactVersion = {
    id: randomUUID() as ArtifactVersion['id'],
    artifactId: designArtifact.id,
    version: 1,
    contentType: 'application/json',
    contentUri: 'file:///design.json',
    contentHash: 'a'.repeat(64),
    metadata: {
      summary: 'Add a query-duration logging middleware.',
      decisions: ['Wrap the query executor with a timing decorator.'],
    },
    createdBy: 'devos-agent-runtime',
    createdAt: now,
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

  let projectArtifacts: Artifact[] = [designArtifact];
  const artifacts: ArtifactRepository = {
    getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
    listForProject: async () => projectArtifacts,
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async (id) => (id === designVersion.id ? designVersion : null),
    listForArtifact: async (artifactId) =>
      artifactId === designArtifact.id ? [designVersion] : [],
    create: async () => {},
  };
  // DEVOS-109: runAgentTask now calls buildContext(), which needs these.
  const projects: ProjectRepository = {
    getById: async () => null,
    listForOrganisation: async () => [],
    create: async () => {},
    update: async () => {},
  };
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async () => null,
    listForProject: async () => [],
    create: async () => {},
    update: async () => {},
  };

  return {
    projectId,
    projects,
    knowledgeSources,
    workItem,
    run,
    agent,
    version,
    task,
    designArtifact,
    designVersion,
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
    removeDesignArtifact: () => {
      projectArtifacts = [];
    },
  };
}

describe('runPlanningAgentTask', () => {
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-planning-agent-task-'));
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('produces a schema-validated implementation plan artifact linked to the technical design via provenance and context manifest', async () => {
    const scenario = buildScenario();
    let receivedInput: Record<string, unknown> | undefined;
    const modelAdapter: AgentModelAdapter = {
      invoke: async (request) => {
        receivedInput = request.input;
        return {
          status: 'SUCCEEDED',
          result: {
            summary: 'Implement the timing decorator in three steps.',
            tasks: ['Add the timing decorator utility.', 'Wrap the query executor with it.'],
          },
        };
      },
    };

    let publishedArtifact: Artifact | undefined;
    let publishedVersion: ArtifactVersion | undefined;

    const deps: AgentArtifactConsumerTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async (artifact, version) => {
        publishedArtifact = artifact;
        publishedVersion = version;
      },
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
    };

    const output = await runPlanningAgentTask(deps, scenario.task);

    expect(receivedInput?.technicalDesign).toEqual(scenario.designVersion.metadata);

    expect(publishedArtifact).toMatchObject({
      artifactType: 'IMPLEMENTATION_PLAN',
      status: 'GENERATED',
      workflowRunId: scenario.run.id,
      workflowTaskId: scenario.task.id,
      createdBy: 'devos-agent-runtime',
    });
    expect(publishedVersion?.metadata).toMatchObject({
      derivedFromArtifactId: scenario.designArtifact.id,
      derivedFromArtifactVersionId: scenario.designVersion.id,
      tasks: ['Add the timing decorator utility.', 'Wrap the query executor with it.'],
    });
    expect(output).toMatchObject({
      status: 'SUCCEEDED',
      artifactType: 'IMPLEMENTATION_PLAN',
      derivedFromArtifactId: scenario.designArtifact.id,
    });

    expect(scenario.contextManifests).toHaveLength(1);
    expect(scenario.contextManifests[0]?.sources).toContainEqual(
      expect.objectContaining({
        type: 'ARTIFACT',
        ref: `artifact:${scenario.designArtifact.id}:v${scenario.designVersion.version}`,
        retrievedAt: expect.any(String),
        authorityLevel: 8,
      }),
    );
  });

  it('throws when no technical design exists for the run', async () => {
    const scenario = buildScenario();
    scenario.removeDesignArtifact();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: AgentArtifactConsumerTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
    };

    await expect(runPlanningAgentTask(deps, scenario.task)).rejects.toThrow(
      'No TECHNICAL_DESIGN artifact found',
    );
  });
});
