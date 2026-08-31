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
import { runDiscoveryAgentTask } from '../src/tasks/run-discovery-agent-task.js';
import type { AgentArtifactTaskHandlerDeps } from '../src/tasks/deps.js';

const CONFIGURATION = {
  role: 'DISCOVERY',
  provider: 'fake',
  modelRef: 'fake-model',
  outputSchemaRef: 'discovery-report-v1',
  allowedCapabilities: [],
};

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};

const schemas: SchemaRepository = {
  resolve: async () => ({
    name: 'discovery-report',
    version: 1,
    fields: { summary: { type: 'string' }, findings: { type: 'array' } },
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
    key: 'discovery-agent',
    name: 'Discovery Agent',
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
    promptReference: 'discovery/v1',
    createdBy: 'alice',
    createdAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'discovery',
    taskType: 'AGENT_TASK',
    status: 'RUNNING',
    attempt: 1,
    input: { agentRef: agent.key },
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

  // DEVOS-109: runAgentTask now calls buildContext(), which needs these —
  // empty/absent by default, matching this scenario's own minimal scope.
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
  const artifacts: ArtifactRepository = {
    getById: async () => null,
    listForProject: async () => [],
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async () => null,
    listForArtifact: async () => [],
    create: async () => {},
  };

  return {
    projectId,
    workItem,
    run,
    agent,
    projects,
    knowledgeSources,
    artifacts,
    artifactVersions,
    version,
    task,
    workflowRuns,
    workItems,
    agents,
    agentVersions,
    agentExecutions,
    executions,
    contextManifests,
    recordContextManifest,
  };
}

describe('runDiscoveryAgentTask', () => {
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-run-discovery-agent-task-'));
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('produces a schema-validated DISCOVERY_REPORT artifact with correct provenance', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: {
          summary: 'The work item asks for slow-query investigation.',
          findings: ['Users report timeouts.', 'No specific query is named yet.'],
        },
      }),
    };

    let publishedArtifact: Artifact | undefined;
    let publishedVersion: ArtifactVersion | undefined;

    const deps: AgentArtifactTaskHandlerDeps = {
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
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async (artifact, version) => {
        publishedArtifact = artifact;
        publishedVersion = version;
      },
    };

    const output = await runDiscoveryAgentTask(deps, scenario.task);

    expect(publishedArtifact).toMatchObject({
      artifactType: 'DISCOVERY_REPORT',
      status: 'GENERATED',
      projectId: scenario.projectId,
      workflowRunId: scenario.run.id,
      workflowTaskId: scenario.task.id,
      createdBy: 'devos-agent-runtime',
    });
    expect(publishedVersion?.contentHash).toHaveLength(64);
    expect(publishedVersion?.metadata).toMatchObject({
      workItemId: scenario.workItem.id,
      summary: 'The work item asks for slow-query investigation.',
      findings: ['Users report timeouts.', 'No specific query is named yet.'],
    });
    expect(output).toMatchObject({ status: 'SUCCEEDED', artifactType: 'DISCOVERY_REPORT' });

    expect(scenario.contextManifests).toHaveLength(1);
    expect(scenario.contextManifests[0]?.workflowTaskId).toBe(scenario.task.id);
    expect(scenario.executions).toHaveLength(1);
    expect(scenario.executions[0]?.status).toBe('SUCCEEDED');
  });

  it('throws and publishes no artifact when the output fails schema validation', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      // Missing the required "findings" field.
      invoke: async () => ({ status: 'SUCCEEDED', result: { summary: 'Incomplete.' } }),
    };

    let published = false;

    const deps: AgentArtifactTaskHandlerDeps = {
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
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {
        published = true;
      },
    };

    await expect(runDiscoveryAgentTask(deps, scenario.task)).rejects.toThrow('schema');
    expect(published).toBe(false);
    expect(scenario.executions[0]).toMatchObject({ status: 'FAILED' });
  });

  it('throws when the run cannot be found', async () => {
    const scenario = buildScenario();
    const taskForMissingRun: WorkflowTask = {
      ...scenario.task,
      workflowRunId: randomUUID() as WorkflowTask['workflowRunId'],
    };
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: AgentArtifactTaskHandlerDeps = {
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
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
    };

    await expect(runDiscoveryAgentTask(deps, taskForMissingRun)).rejects.toThrow('not found');
  });
});
