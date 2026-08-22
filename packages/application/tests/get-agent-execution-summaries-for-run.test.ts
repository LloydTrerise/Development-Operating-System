import { randomUUID } from 'node:crypto';
import type {
  AgentExecution,
  AgentExecutionRepository,
  AgentVersion,
  AgentVersionRepository,
  ContextManifest,
  ContextManifestRepository,
  Membership,
  MembershipRepository,
  OrganisationId,
  Project,
  ProjectRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import { getAgentExecutionSummariesForRun } from '../src/workflows/get-agent-execution-summaries-for-run.js';
import type { AgentExecutionSummaryUseCaseDeps } from '../src/workflows/deps.js';

function buildScenario() {
  const now = new Date(0).toISOString();
  const organisationId = randomUUID() as OrganisationId;

  const project: Project = {
    id: randomUUID() as Project['id'],
    organisationId,
    name: 'Test Project',
    slug: 'test-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId,
    projectId: project.id,
    principalId: 'alice',
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  const run: WorkflowRun = {
    id: randomUUID() as WorkflowRun['id'],
    projectId: project.id,
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const agentTask: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'discovery',
    taskType: 'AGENT_TASK',
    status: 'SUCCEEDED',
    attempt: 1,
    input: { agentRef: 'discovery-agent' },
    createdAt: now,
    updatedAt: now,
  };
  const plainTask: WorkflowTask = {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey: 'deterministic',
    taskType: 'TASK',
    status: 'SUCCEEDED',
    attempt: 1,
    input: {},
    createdAt: now,
    updatedAt: now,
  };

  const agentVersion: AgentVersion = {
    id: randomUUID() as AgentVersion['id'],
    agentId: randomUUID() as AgentVersion['agentId'],
    version: 1,
    status: 'PUBLISHED',
    configuration: {
      role: 'DISCOVERY',
      provider: 'fake',
      modelRef: 'fake-model',
      allowedCapabilities: [],
    },
    promptReference: 'discovery/v1',
    createdBy: 'alice',
    createdAt: now,
  };

  const execution: AgentExecution = {
    id: randomUUID() as AgentExecution['id'],
    workflowTaskId: agentTask.id,
    agentVersionId: agentVersion.id,
    status: 'SUCCEEDED',
    input: {},
    output: { summary: 'a summary' },
    createdAt: now,
  };

  const manifest: ContextManifest = {
    id: randomUUID() as ContextManifest['id'],
    projectId: project.id,
    workflowTaskId: agentTask.id,
    agentExecutionId: execution.id,
    version: 1,
    sources: [{ type: 'WORK_ITEM', ref: 'work-item:x' }],
    policySnapshot: { policyVersion: 'none' },
    createdAt: now,
  };

  const projects: ProjectRepository = {
    getById: async (id) => (id === project.id ? project : null),
    listForOrganisation: async () => [project],
    create: async () => {},
    update: async () => {},
  };
  const memberships: MembershipRepository = {
    getById: async (id) => (id === membership.id ? membership : null),
    getForPrincipalAndProject: async (principalId, projectId) =>
      principalId === membership.principalId && projectId === project.id ? membership : null,
    listForPrincipal: async (principalId) =>
      principalId === membership.principalId ? [membership] : [],
    listForProject: async () => [membership],
    create: async () => {},
    updateRole: async () => {},
    remove: async () => {},
  };
  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    create: async () => {},
  };
  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => [agentTask, plainTask].find((t) => t.id === id) ?? null,
    listForRun: async (runId) => (runId === run.id ? [agentTask, plainTask] : []),
    create: async () => {},
  };
  const agentExecutions: AgentExecutionRepository = {
    getById: async (id) => (id === execution.id ? execution : null),
    listForTask: async (taskId) => (taskId === agentTask.id ? [execution] : []),
    create: async () => {},
    complete: async () => {},
    fail: async () => {},
  };
  const agentVersions: AgentVersionRepository = {
    getById: async (id) => (id === agentVersion.id ? agentVersion : null),
    getByAgentAndVersion: async () => null,
    getLatestForAgent: async () => agentVersion,
    listForAgent: async () => [agentVersion],
    create: async () => {},
    publish: async () => {},
  };
  const contextManifests: ContextManifestRepository = {
    getById: async (id) => (id === manifest.id ? manifest : null),
    getForExecution: async (executionId) => (executionId === execution.id ? manifest : null),
    create: async () => {},
  };

  const deps: AgentExecutionSummaryUseCaseDeps = {
    projects,
    memberships,
    workflowRuns,
    workflowTasks,
    agentExecutions,
    agentVersions,
    contextManifests,
  };

  return { deps, project, run, agentTask, plainTask, execution, agentVersion, manifest };
}

describe('getAgentExecutionSummariesForRun', () => {
  it('summarizes prompt version, context manifest, status, and output for an agent task', async () => {
    const scenario = buildScenario();

    const summaries = await getAgentExecutionSummariesForRun(
      scenario.deps,
      'alice',
      scenario.run.id,
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      taskId: scenario.agentTask.id,
      executionId: scenario.execution.id,
      status: 'SUCCEEDED',
      role: 'DISCOVERY',
      promptReference: 'discovery/v1',
      output: { summary: 'a summary' },
      contextManifest: { sourceCount: 1, sources: [{ type: 'WORK_ITEM', ref: 'work-item:x' }] },
    });
  });

  it('omits a plain (non-agent) task from the summaries', async () => {
    const scenario = buildScenario();

    const summaries = await getAgentExecutionSummariesForRun(
      scenario.deps,
      'alice',
      scenario.run.id,
    );

    expect(summaries.find((s) => s.taskId === scenario.plainTask.id)).toBeUndefined();
  });

  it('denies a non-member from reading a run its summaries', async () => {
    const scenario = buildScenario();

    await expect(
      getAgentExecutionSummariesForRun(scenario.deps, 'mallory', scenario.run.id),
    ).rejects.toThrow();
  });
});
