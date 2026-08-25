import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentModelAdapter, PromptRepository, SchemaRepository } from '@devos/agents';
import {
  SEED_DEVELOPMENT_AGENT_KEY,
  SEED_DISCOVERY_AGENT_KEY,
  SEED_PLANNING_AGENT_KEY,
  SEED_REQUIREMENTS_AGENT_KEY,
  SEED_REVIEW_AGENT_KEY,
  SEED_TECHNICAL_DESIGN_AGENT_KEY,
} from '@devos/database';
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
  ProjectId,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkItem,
  WorkItemRepository,
} from '@devos/domain';
import type { AgentArtifactConsumerTaskHandlerDeps } from '@devos/application';
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routeAgentTask } from '../src/agent-task-router.js';

const NO_OP_SCHEMA = { name: 'noop', version: 1, fields: {} };

/**
 * A single scenario shared by every case below: one work item/run, and one
 * published Agent/AgentVersion per planning-path key (all four exist at
 * once, mirroring the real seed data — routing is what's under test, not
 * agent resolution). Requirements/technical-design/planning also need their
 * respective upstream artifact already published in the run.
 */
function buildScenario() {
  const projectId = randomUUID() as ProjectId;
  const now = new Date(0).toISOString();

  const workItem: WorkItem = {
    id: randomUUID() as WorkItem['id'],
    projectId,
    title: 'Router test work item',
    description: 'Exercises DEVOS-035s agent-task routing.',
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

  const agentKeys = [
    SEED_DISCOVERY_AGENT_KEY,
    SEED_REQUIREMENTS_AGENT_KEY,
    SEED_TECHNICAL_DESIGN_AGENT_KEY,
    SEED_PLANNING_AGENT_KEY,
  ];
  const agents: Agent[] = agentKeys.map((key) => ({
    id: randomUUID() as Agent['id'],
    projectId,
    key,
    name: key,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }));
  const versions: AgentVersion[] = agents.map((agent) => ({
    id: randomUUID() as AgentVersion['id'],
    agentId: agent.id,
    version: 1,
    status: 'PUBLISHED',
    configuration: {
      role: agent.key,
      provider: 'fake',
      modelRef: 'fake-model',
      allowedCapabilities: [],
    },
    createdBy: 'alice',
    createdAt: now,
  }));

  function upstreamArtifact(artifactType: string, metadata: Record<string, unknown>) {
    const artifact: Artifact = {
      id: randomUUID() as Artifact['id'],
      projectId,
      artifactType,
      name: `${artifactType} — ${workItem.title}`,
      status: 'GENERATED',
      workflowRunId: run.id,
      workflowTaskId: randomUUID() as Artifact['workflowTaskId'],
      createdBy: 'devos-agent-runtime',
      createdAt: now,
      updatedAt: now,
    };
    const version: ArtifactVersion = {
      id: randomUUID() as ArtifactVersion['id'],
      artifactId: artifact.id,
      version: 1,
      contentType: 'application/json',
      contentUri: `file:///${artifactType}.json`,
      contentHash: 'a'.repeat(64),
      metadata,
      createdBy: 'devos-agent-runtime',
      createdAt: now,
    };
    return { artifact, version };
  }

  const discoveryReport = upstreamArtifact('DISCOVERY_REPORT', {
    summary: 'fake discovery',
    findings: [],
  });
  const prd = upstreamArtifact('PRD', { summary: 'fake prd', requirements: [] });
  const technicalDesign = upstreamArtifact('TECHNICAL_DESIGN', {
    summary: 'fake design',
    decisions: [],
  });

  const projectArtifacts = [discoveryReport.artifact, prd.artifact, technicalDesign.artifact];
  const artifactVersionsByArtifactId = new Map(
    [discoveryReport, prd, technicalDesign].map(({ artifact, version }) => [
      artifact.id,
      [version],
    ]),
  );

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
  const agentRepository: AgentRepository = {
    getById: async (id) => agents.find((a) => a.id === id) ?? null,
    getByProjectAndKey: async (pid, key) =>
      agents.find((a) => a.projectId === pid && a.key === key) ?? null,
    listForProject: async () => agents,
    create: async () => {},
  };
  const agentVersionRepository: AgentVersionRepository = {
    getById: async (id) => versions.find((v) => v.id === id) ?? null,
    getByAgentAndVersion: async () => null,
    getLatestForAgent: async (agentId) => versions.find((v) => v.agentId === agentId) ?? null,
    listForAgent: async (agentId) => versions.filter((v) => v.agentId === agentId),
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
    getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
    listForProject: async () => projectArtifacts,
    create: async () => {},
  };
  const artifactVersions: ArtifactVersionRepository = {
    getById: async () => null,
    listForArtifact: async (artifactId) => artifactVersionsByArtifactId.get(artifactId) ?? [],
    create: async () => {},
  };

  function buildTask(agentRef: string): WorkflowTask {
    return {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: agentRef,
      taskType: 'AGENT_TASK',
      status: 'RUNNING',
      attempt: 1,
      input: { agentRef },
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    workflowRuns,
    workItems,
    agentRepository,
    agentVersionRepository,
    agentExecutions,
    recordContextManifest,
    artifacts,
    artifactVersions,
    buildTask,
  };
}

const prompts: PromptRepository = { resolve: async () => 'unused' };
const schemas: SchemaRepository = { resolve: async () => NO_OP_SCHEMA };
const modelAdapter: AgentModelAdapter = {
  invoke: async () => ({ status: 'SUCCEEDED', result: { summary: 'ok', findings: [] } }),
};

describe('routeAgentTask', () => {
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-agent-task-router-'));
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it.each([
    [SEED_DISCOVERY_AGENT_KEY, 'DISCOVERY_REPORT'],
    [SEED_REQUIREMENTS_AGENT_KEY, 'PRD'],
    [SEED_TECHNICAL_DESIGN_AGENT_KEY, 'TECHNICAL_DESIGN'],
    [SEED_PLANNING_AGENT_KEY, 'IMPLEMENTATION_PLAN'],
  ])(
    'routes agentRef "%s" to the handler that publishes a %s artifact',
    async (agentRef, expectedArtifactType) => {
      const scenario = buildScenario();
      let publishedArtifactType: string | undefined;

      const deps: AgentArtifactConsumerTaskHandlerDeps = {
        workflowRuns: scenario.workflowRuns,
        workItems: scenario.workItems,
        agents: scenario.agentRepository,
        agentVersions: scenario.agentVersionRepository,
        agentExecutions: scenario.agentExecutions,
        modelAdapter,
        prompts,
        schemas,
        recordContextManifest: scenario.recordContextManifest,
        storage: createLocalFilesystemStorage(storageDir),
        publishArtifact: async (artifact) => {
          publishedArtifactType = artifact.artifactType;
        },
        artifacts: scenario.artifacts,
        artifactVersions: scenario.artifactVersions,
      };

      const output = await routeAgentTask(deps, scenario.buildTask(agentRef));

      expect(publishedArtifactType).toBe(expectedArtifactType);
      expect(output).toMatchObject({ status: 'SUCCEEDED', artifactType: expectedArtifactType });
    },
  );

  it('throws clearly for an unrecognized agentRef', async () => {
    const scenario = buildScenario();
    const deps: AgentArtifactConsumerTaskHandlerDeps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agentRepository,
      agentVersions: scenario.agentVersionRepository,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
    };

    await expect(routeAgentTask(deps, scenario.buildTask('not-a-real-agent'))).rejects.toThrow(
      'No planning-path agent handler registered',
    );
  });

  it('routes agentRef "development-agent" to runDevelopmentAgentTask (DEVOS-061)', async () => {
    const scenario = buildScenario();
    // A minimal, deliberately-incomplete DevelopmentAgentTaskHandlerDeps —
    // proving the switch case actually dispatches to
    // `runDevelopmentAgentTask` (which fails on "no IMPLEMENTATION_PLAN
    // artifact" specifically, since this scenario's project has none) is
    // enough here; that function's own real behavior is already
    // exhaustively covered by run-development-agent-task.test.ts.
    const deps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agentRepository,
      agentVersions: scenario.agentVersionRepository,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: { getById: async () => null } as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: { listForProject: async () => [] } as never,
      pullRequestProvider: {} as never,
    };

    await expect(
      routeAgentTask(deps, scenario.buildTask(SEED_DEVELOPMENT_AGENT_KEY)),
    ).rejects.toThrow('No IMPLEMENTATION_PLAN artifact found');
  });

  it('routes agentRef "review-agent" to runReviewAgentTask (DEVOS-065/067)', async () => {
    const scenario = buildScenario();
    // Same minimal, deliberately-incomplete deps pattern as the
    // development-agent case above — proving the switch case dispatches to
    // `runReviewAgentTask` (which fails on "no CODE_CHANGE artifact"
    // specifically, since this scenario's project has none) is enough
    // here; that function's own real behavior is already exhaustively
    // covered by run-review-agent-task.test.ts.
    const deps = {
      workflowRuns: scenario.workflowRuns,
      workItems: scenario.workItems,
      agents: scenario.agentRepository,
      agentVersions: scenario.agentVersionRepository,
      agentExecutions: scenario.agentExecutions,
      modelAdapter,
      prompts,
      schemas,
      recordContextManifest: scenario.recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact: async () => {},
      artifacts: scenario.artifacts,
      artifactVersions: scenario.artifactVersions,
      projects: { getById: async () => null } as never,
      memberships: {} as never,
      policies: {} as never,
      toolCapabilities: {} as never,
      toolInvocations: {} as never,
      auditRecords: {} as never,
      integrations: { listForProject: async () => [] } as never,
      pullRequestProvider: {} as never,
      knowledgeSources: {} as never,
      workflowDefinitions: {} as never,
      workflowVersions: {} as never,
      workflowTasks: {} as never,
      createDraft: async () => {},
      startRun: async () => {},
    };

    await expect(routeAgentTask(deps, scenario.buildTask(SEED_REVIEW_AGENT_KEY))).rejects.toThrow(
      'No CODE_CHANGE artifact found',
    );
  });
});
