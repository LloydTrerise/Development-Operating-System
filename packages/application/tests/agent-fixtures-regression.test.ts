import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createFilesystemFixtureRepository,
  createFilesystemPromptRepository,
  createFilesystemSchemaRepository,
  createFixtureModelAdapter,
} from '@devos/agents';
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
import { createLocalFilesystemStorage } from '@devos/storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  runDiscoveryAgentTask,
  runPlanningAgentTask,
  runRequirementsAgentTask,
  runTechnicalDesignAgentTask,
  type AgentArtifactConsumerTaskHandlerDeps,
} from '../src/index.js';

/**
 * DEVOS-037: the regression proof that each planning-path agent's recorded
 * golden fixture (a real Gemini response, captured during DEVOS-031–034's
 * live verification) still produces a schema-valid, correctly-chained
 * artifact through the real handlers, real prompt/schema files, and real
 * schema validation — with zero live API calls. Only the model call is
 * faked (via createFixtureModelAdapter); everything downstream of it
 * (runAgentTask, the four run*AgentTask wrappers, schema validation,
 * context manifest recording, artifact chaining) is exercised for real.
 * If a future prompt or schema change makes an old recorded fixture no
 * longer valid, this test is what catches that drift.
 */
describe('agent fixtures regression (no live API calls)', () => {
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'devos-agent-fixtures-regression-'));
  });

  afterAll(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('runs the full discovery -> requirements -> technical design -> planning chain against recorded fixtures', async () => {
    const projectId = randomUUID() as ProjectId;
    const now = new Date(0).toISOString();

    const workItem: WorkItem = {
      id: randomUUID() as WorkItem['id'],
      projectId,
      title: 'Add CSV export to the reporting dashboard',
      description:
        'Users on the analytics team need to export the current reporting dashboard view as a CSV file for offline analysis. No specific format or column list has been agreed yet.',
      type: 'FEATURE',
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

    const roles = [
      {
        key: 'discovery-agent',
        role: 'DISCOVERY',
        outputSchemaRef: 'discovery-report-v1',
        promptReference: 'discovery/v1',
      },
      {
        key: 'requirements-agent',
        role: 'REQUIREMENTS',
        outputSchemaRef: 'prd-v1',
        promptReference: 'requirements/v1',
      },
      {
        key: 'technical-design-agent',
        role: 'TECHNICAL_DESIGN',
        outputSchemaRef: 'technical-design-v1',
        promptReference: 'technical-design/v1',
      },
      {
        key: 'planning-agent',
        role: 'PLANNING',
        outputSchemaRef: 'implementation-plan-v1',
        promptReference: 'planning/v1',
      },
    ] as const;

    const agents: Agent[] = roles.map((r) => ({
      id: randomUUID() as Agent['id'],
      projectId,
      key: r.key,
      name: r.key,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }));
    const versions: AgentVersion[] = roles.map((r, i) => ({
      id: randomUUID() as AgentVersion['id'],
      agentId: agents[i]!.id,
      version: 1,
      status: 'PUBLISHED',
      configuration: {
        role: r.role,
        provider: 'gemini',
        modelRef: 'gemini-3.6-flash',
        outputSchemaRef: r.outputSchemaRef,
        allowedCapabilities: [],
      },
      promptReference: r.promptReference,
      createdBy: 'alice',
      createdAt: now,
    }));

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

    const projectArtifacts: Artifact[] = [];
    const artifactVersionsByArtifactId = new Map<string, ArtifactVersion[]>();
    const artifacts: ArtifactRepository = {
      getById: async (id) => projectArtifacts.find((a) => a.id === id) ?? null,
      listForProject: async () => projectArtifacts,
      create: async (artifact) => {
        projectArtifacts.push(artifact);
      },
    };
    const artifactVersions: ArtifactVersionRepository = {
      getById: async () => null,
      listForArtifact: async (artifactId) => artifactVersionsByArtifactId.get(artifactId) ?? [],
      create: async (version) => {
        const existing = artifactVersionsByArtifactId.get(version.artifactId) ?? [];
        artifactVersionsByArtifactId.set(version.artifactId, [...existing, version]);
      },
    };
    const publishArtifact = async (artifact: Artifact, version: ArtifactVersion): Promise<void> => {
      await artifacts.create(artifact);
      await artifactVersions.create(version);
    };

    const fixtureRepository = createFilesystemFixtureRepository();
    const [discoveryFixture, requirementsFixture, technicalDesignFixture, planningFixture] =
      await Promise.all([
        fixtureRepository.resolve('discovery-v1'),
        fixtureRepository.resolve('requirements-v1'),
        fixtureRepository.resolve('technical-design-v1'),
        fixtureRepository.resolve('planning-v1'),
      ]);

    const modelAdapter = createFixtureModelAdapter({
      DISCOVERY: discoveryFixture,
      REQUIREMENTS: requirementsFixture,
      TECHNICAL_DESIGN: technicalDesignFixture,
      PLANNING: planningFixture,
    });

    const deps: AgentArtifactConsumerTaskHandlerDeps = {
      workflowRuns,
      workItems,
      agents: agentRepository,
      agentVersions: agentVersionRepository,
      agentExecutions,
      modelAdapter,
      prompts: createFilesystemPromptRepository(),
      schemas: createFilesystemSchemaRepository(),
      recordContextManifest,
      storage: createLocalFilesystemStorage(storageDir),
      publishArtifact,
      artifacts,
      artifactVersions,
    };

    function buildTask(taskKey: string, agentRef: string): WorkflowTask {
      return {
        id: randomUUID() as WorkflowTask['id'],
        workflowRunId: run.id,
        taskKey,
        taskType: 'AGENT_TASK',
        status: 'RUNNING',
        attempt: 1,
        input: { agentRef },
        createdAt: now,
        updatedAt: now,
      };
    }

    function storedMetadata(artifactId: string): Record<string, unknown> {
      const [version] = artifactVersionsByArtifactId.get(artifactId) ?? [];
      return (version?.metadata ?? {}) as Record<string, unknown>;
    }

    const discoveryOutput = await runDiscoveryAgentTask(
      deps,
      buildTask('discovery', 'discovery-agent'),
    );
    expect(discoveryOutput).toMatchObject({
      status: 'SUCCEEDED',
      artifactType: 'DISCOVERY_REPORT',
    });
    expect(storedMetadata(discoveryOutput.artifactId as string)).toMatchObject(
      discoveryFixture.result,
    );

    const requirementsOutput = await runRequirementsAgentTask(
      deps,
      buildTask('requirements', 'requirements-agent'),
    );
    expect(requirementsOutput).toMatchObject({ status: 'SUCCEEDED', artifactType: 'PRD' });
    expect(storedMetadata(requirementsOutput.artifactId as string)).toMatchObject(
      requirementsFixture.result,
    );

    const technicalDesignOutput = await runTechnicalDesignAgentTask(
      deps,
      buildTask('technical-design', 'technical-design-agent'),
    );
    expect(technicalDesignOutput).toMatchObject({
      status: 'SUCCEEDED',
      artifactType: 'TECHNICAL_DESIGN',
    });
    expect(storedMetadata(technicalDesignOutput.artifactId as string)).toMatchObject(
      technicalDesignFixture.result,
    );

    const planningOutput = await runPlanningAgentTask(
      deps,
      buildTask('planning', 'planning-agent'),
    );
    expect(planningOutput).toMatchObject({
      status: 'SUCCEEDED',
      artifactType: 'IMPLEMENTATION_PLAN',
    });
    expect(storedMetadata(planningOutput.artifactId as string)).toMatchObject(
      planningFixture.result,
    );

    // Every stage after the first is genuinely chained to the one before it.
    expect(requirementsOutput.derivedFromArtifactId).toBe(discoveryOutput.artifactId);
    expect(technicalDesignOutput.derivedFromArtifactId).toBe(requirementsOutput.artifactId);
    expect(planningOutput.derivedFromArtifactId).toBe(technicalDesignOutput.artifactId);

    expect(projectArtifacts.map((a) => a.artifactType)).toEqual([
      'DISCOVERY_REPORT',
      'PRD',
      'TECHNICAL_DESIGN',
      'IMPLEMENTATION_PLAN',
    ]);
    expect(executions.every((e) => e.status === 'SUCCEEDED')).toBe(true);
    expect(contextManifests).toHaveLength(4);
  });
});
