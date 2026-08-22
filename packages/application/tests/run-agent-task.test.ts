import { randomUUID } from 'node:crypto';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import type {
  Agent,
  AgentExecution,
  AgentExecutionRepository,
  AgentRepository,
  AgentVersion,
  AgentVersionRepository,
  ContextManifest,
  ProjectId,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { runAgentTask } from '../src/tasks/run-agent-task.js';
import type { AgentTaskHandlerDeps } from '../src/tasks/deps.js';

const CONFIGURATION = {
  role: 'REQUIREMENTS',
  provider: 'fake',
  modelRef: 'fake-model',
  allowedCapabilities: [],
};

const prompts: PromptRepository = {
  resolve: async (reference) => `Resolved prompt text for "${reference}".`,
};

const schemas: SchemaRepository = {
  resolve: async () => ({
    name: 'noop',
    version: 1,
    fields: {},
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
    key: 'requirements-agent',
    name: 'Requirements Agent',
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
    createdBy: 'alice',
    createdAt: now,
  };

  const task: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'requirements',
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

  return {
    projectId,
    workItem,
    run,
    agent,
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

describe('runAgentTask', () => {
  it('resolves a configured promptReference and passes its text as systemInstructions', async () => {
    const scenario = buildScenario();
    const versionWithPrompt = { ...scenario.version, promptReference: 'requirements/v1' };
    const agentVersions = {
      ...scenario.agentVersions,
      listForAgent: async () => [versionWithPrompt],
    };
    let receivedRequest: Parameters<AgentModelAdapter['invoke']>[0] | undefined;
    const modelAdapter: AgentModelAdapter = {
      invoke: async (request) => {
        receivedRequest = request;
        return { status: 'SUCCEEDED', result: {} };
      },
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await runAgentTask(deps, scenario.task);

    expect(receivedRequest?.promptReference).toBe('requirements/v1');
    expect(receivedRequest?.systemInstructions).toBe('Resolved prompt text for "requirements/v1".');
  });

  it('records a context manifest with the work item, agent version, and prompt sources before invoking the model', async () => {
    const scenario = buildScenario();
    const versionWithPrompt = { ...scenario.version, promptReference: 'requirements/v1' };
    const agentVersions = {
      ...scenario.agentVersions,
      listForAgent: async () => [versionWithPrompt],
    };
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await runAgentTask(deps, scenario.task);

    expect(scenario.contextManifests).toHaveLength(1);
    const manifest = scenario.contextManifests[0]!;
    expect(manifest.workflowTaskId).toBe(scenario.task.id);
    expect(manifest.agentExecutionId).toBe(scenario.executions[0]?.id);
    expect(manifest.sources).toEqual([
      expect.objectContaining({
        type: 'WORK_ITEM',
        ref: `work-item:${scenario.workItem.id}`,
        retrievedAt: expect.any(String),
        authorityLevel: 6,
      }),
      expect.objectContaining({
        type: 'AGENT_VERSION',
        ref: `agent-version:${versionWithPrompt.id}`,
        retrievedAt: expect.any(String),
      }),
      expect.objectContaining({
        type: 'PROMPT',
        ref: 'prompt:requirements/v1',
        retrievedAt: expect.any(String),
      }),
    ]);
  });

  it('merges additionalContext into the model input and the recorded context manifest sources', async () => {
    const scenario = buildScenario();
    let receivedInput: Record<string, unknown> | undefined;
    const modelAdapter: AgentModelAdapter = {
      invoke: async (request) => {
        receivedInput = request.input;
        return { status: 'SUCCEEDED', result: {} };
      },
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await runAgentTask(deps, scenario.task, {
      input: { priorStage: { summary: 'from a prior agent' } },
      sources: [{ type: 'ARTIFACT', ref: 'artifact:some-id:v1' }],
    });

    expect(receivedInput?.priorStage).toEqual({ summary: 'from a prior agent' });
    expect(scenario.contextManifests[0]?.sources).toContainEqual(
      expect.objectContaining({
        type: 'ARTIFACT',
        ref: 'artifact:some-id:v1',
        retrievedAt: expect.any(String),
        authorityLevel: 8,
      }),
    );
  });

  it('resolves the published agent version, records a SUCCEEDED execution, and returns its result', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({
        status: 'SUCCEEDED',
        result: { summary: 'A validated PRD.' },
        modelReference: 'fake-model@1',
      }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    const output = await runAgentTask(deps, scenario.task);

    expect(output).toMatchObject({ status: 'SUCCEEDED', summary: 'A validated PRD.' });
    expect(scenario.executions).toHaveLength(1);
    expect(scenario.executions[0]).toMatchObject({
      status: 'SUCCEEDED',
      agentVersionId: scenario.version.id,
      workflowTaskId: scenario.task.id,
    });
  });

  it('records a FAILED execution and throws when the model adapter reports failure', async () => {
    const scenario = buildScenario();
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'FAILED', errorMessage: 'The model timed out.' }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await expect(runAgentTask(deps, scenario.task)).rejects.toThrow('The model timed out.');
    expect(scenario.executions[0]).toMatchObject({
      status: 'FAILED',
      errorMessage: 'The model timed out.',
    });
  });

  it('throws when the task has no agentRef configured', async () => {
    const scenario = buildScenario();
    const taskWithoutRef: WorkflowTask = { ...scenario.task, input: {} };
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: scenario.agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await expect(runAgentTask(deps, taskWithoutRef)).rejects.toThrow('no agentRef configured');
  });

  it('throws when the agent has no published version', async () => {
    const scenario = buildScenario();
    const draftOnlyVersions: AgentVersionRepository = {
      ...scenario.agentVersions,
      listForAgent: async () => [{ ...scenario.version, status: 'DRAFT' }],
    };
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: {} }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions: draftOnlyVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await expect(runAgentTask(deps, scenario.task)).rejects.toThrow('no published version');
  });

  it('accepts a SUCCEEDED result that conforms to the configured output schema', async () => {
    const scenario = buildScenario();
    const versionWithSchema = {
      ...scenario.version,
      configuration: { ...CONFIGURATION, outputSchemaRef: 'prd-v1' },
    };
    const agentVersions = {
      ...scenario.agentVersions,
      listForAgent: async () => [versionWithSchema],
    };
    const conformingSchemas: SchemaRepository = {
      resolve: async () => ({ name: 'prd', version: 1, fields: { summary: { type: 'string' } } }),
    };
    const modelAdapter: AgentModelAdapter = {
      invoke: async () => ({ status: 'SUCCEEDED', result: { summary: 'A validated PRD.' } }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas: conformingSchemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    const output = await runAgentTask(deps, scenario.task);

    expect(output).toMatchObject({ status: 'SUCCEEDED', summary: 'A validated PRD.' });
    expect(scenario.executions[0]?.status).toBe('SUCCEEDED');
  });

  it('rejects and records FAILED when the output does not conform to the configured schema', async () => {
    const scenario = buildScenario();
    const versionWithSchema = {
      ...scenario.version,
      configuration: { ...CONFIGURATION, outputSchemaRef: 'prd-v1' },
    };
    const agentVersions = {
      ...scenario.agentVersions,
      listForAgent: async () => [versionWithSchema],
    };
    const strictSchemas: SchemaRepository = {
      resolve: async () => ({ name: 'prd', version: 1, fields: { summary: { type: 'string' } } }),
    };
    const modelAdapter: AgentModelAdapter = {
      // Missing the required "summary" field entirely.
      invoke: async () => ({ status: 'SUCCEEDED', result: { title: 'Wrong shape' } }),
    };

    const deps: AgentTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agents,
      agentVersions,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas: strictSchemas,
      recordContextManifest: scenario.recordContextManifest,
    };

    await expect(runAgentTask(deps, scenario.task)).rejects.toThrow('schema "prd-v1" validation');
    expect(scenario.executions[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'DEVOS_SCHEMA_VALIDATION_FAILED',
    });
  });
});
