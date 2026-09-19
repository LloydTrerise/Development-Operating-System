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
  KnowledgeSourceRepository,
  Project,
  ProjectId,
  ProjectRepository,
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

  const roleByAgentKey: Record<string, string> = {
    [SEED_DISCOVERY_AGENT_KEY]: 'DISCOVERY',
    [SEED_REQUIREMENTS_AGENT_KEY]: 'REQUIREMENTS',
    [SEED_TECHNICAL_DESIGN_AGENT_KEY]: 'TECHNICAL_DESIGN',
    [SEED_PLANNING_AGENT_KEY]: 'PLANNING',
    [SEED_DEVELOPMENT_AGENT_KEY]: 'DEVELOPMENT',
    [SEED_REVIEW_AGENT_KEY]: 'REVIEW',
  };
  const agentKeys = Object.keys(roleByAgentKey);
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
      role: roleByAgentKey[agent.key]!,
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

  // DEVOS-109: runAgentTask now assembles its context manifest via
  // buildContext(), which needs `projects`/`knowledgeSources` too.
  const project: Project = {
    id: projectId,
    organisationId: randomUUID() as Project['organisationId'],
    name: 'Router test project',
    slug: 'router-test-project',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
  const projects: ProjectRepository = {
    getById: async (id) => (id === projectId ? project : null),
    listForOrganisation: async () => [project],
    create: async () => {},
    update: async () => {},
  };
  const knowledgeSources: KnowledgeSourceRepository = {
    getById: async () => null,
    getByProjectAndKey: async () => null,
    listForProject: async () => [],
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

  // DEVOS-159: a task targeting a role/capability requirement instead of a
  // literal agentRef.
  function buildRoleTargetedTask(
    requiredRole: string,
    requiredCapabilities: string[] = [],
  ): WorkflowTask {
    return {
      id: randomUUID() as WorkflowTask['id'],
      workflowRunId: run.id,
      taskKey: requiredRole,
      taskType: 'AGENT_TASK',
      status: 'RUNNING',
      attempt: 1,
      input: { requiredRole, requiredCapabilities },
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    projectId,
    agents,
    versions,
    workflowRuns,
    workItems,
    agentRepository,
    agentVersionRepository,
    agentExecutions,
    recordContextManifest,
    artifacts,
    artifactVersions,
    projects,
    knowledgeSources,
    buildTask,
    buildRoleTargetedTask,
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
        projects: scenario.projects,
        knowledgeSources: scenario.knowledgeSources,
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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    await expect(routeAgentTask(deps, scenario.buildTask('not-a-real-agent'))).rejects.toThrow(
      'No agent handler registered for agentRef "not-a-real-agent"',
    );
  });

  it('throws clearly when the resolved agent has an unrecognized role', async () => {
    const scenario = buildScenario();
    const unknownRoleKey = 'mystery-agent';
    const unknownRoleAgent: Agent = {
      id: randomUUID() as Agent['id'],
      projectId: scenario.projectId,
      key: unknownRoleKey,
      name: unknownRoleKey,
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    scenario.agents.push(unknownRoleAgent);
    scenario.versions.push({
      id: randomUUID() as AgentVersion['id'],
      agentId: unknownRoleAgent.id,
      version: 1,
      status: 'PUBLISHED',
      configuration: {
        role: 'MYSTERY_ROLE',
        provider: 'fake',
        modelRef: 'fake-model',
        allowedCapabilities: [],
      },
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
    });

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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    await expect(routeAgentTask(deps, scenario.buildTask(unknownRoleKey))).rejects.toThrow(
      'unrecognized role "MYSTERY_ROLE"',
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

  it('DEVOS-159: routes a requiredRole-only task (no agentRef) to the matching handler', async () => {
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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    const output = await routeAgentTask(deps, scenario.buildRoleTargetedTask('DISCOVERY'));

    expect(publishedArtifactType).toBe('DISCOVERY_REPORT');
    expect(output).toMatchObject({ status: 'SUCCEEDED', artifactType: 'DISCOVERY_REPORT' });
  });

  it('DEVOS-159: picks the lowest agent.key among multiple matching candidates', async () => {
    const scenario = buildScenario();
    // A second real DISCOVERY-role candidate with a key that sorts before
    // the seeded one — proves selection, not "the only match wins by
    // accident".
    const secondAgent: Agent = {
      id: randomUUID() as Agent['id'],
      projectId: scenario.projectId,
      key: `aaa-${SEED_DISCOVERY_AGENT_KEY}`,
      name: 'Second discovery agent',
      status: 'ACTIVE',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    };
    scenario.agents.push(secondAgent);
    scenario.versions.push({
      id: randomUUID() as AgentVersion['id'],
      agentId: secondAgent.id,
      version: 1,
      status: 'PUBLISHED',
      configuration: {
        role: 'DISCOVERY',
        provider: 'fake',
        modelRef: 'fake-model',
        allowedCapabilities: [],
      },
      createdBy: 'alice',
      createdAt: new Date(0).toISOString(),
    });

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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    // Both real candidates would resolve to the same DISCOVERY handler, so
    // this proves selection ran (not a crash/ambiguity) rather than which
    // literal agent won — DEVOS-159's own disclosed tie-break is unit-tested
    // directly in packages/domain/tests/select-agent-for-task.test.ts.
    await routeAgentTask(deps, scenario.buildRoleTargetedTask('DISCOVERY'));
    expect(publishedArtifactType).toBe('DISCOVERY_REPORT');
  });

  it('DEVOS-159: throws clearly when no published agent matches the required role', async () => {
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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    await expect(
      routeAgentTask(deps, scenario.buildRoleTargetedTask('NONEXISTENT_ROLE')),
    ).rejects.toThrow('No agent handler registered for requiredRole "NONEXISTENT_ROLE"');
  });

  it('DEVOS-159: throws clearly when a candidate matches role but not every required capability', async () => {
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
      projects: scenario.projects,
      knowledgeSources: scenario.knowledgeSources,
    };

    // The seeded DISCOVERY agent's allowedCapabilities is [] (buildScenario
    // above), so requiring any real capability makes it an intentional
    // non-match — proving the capability filter, not just the role filter.
    await expect(
      routeAgentTask(deps, scenario.buildRoleTargetedTask('DISCOVERY', ['repo-read'])),
    ).rejects.toThrow('No agent handler registered for requiredRole "DISCOVERY"');
  });
});
