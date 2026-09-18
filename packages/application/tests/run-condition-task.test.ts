import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactId,
  ArtifactRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { ConditionTaskHandlerDeps } from '../src/tasks/run-condition-task.js';
import { runConditionTask } from '../src/tasks/run-condition-task.js';

const now = new Date(0).toISOString();

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: randomUUID() as WorkflowRun['id'],
    projectId: randomUUID() as WorkflowRun['projectId'],
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTask(run: WorkflowRun, taskKey: string): WorkflowTask {
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey,
    taskType: 'CONDITION',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    createdAt: now,
    updatedAt: now,
  };
}

function makeDeps(
  run: WorkflowRun,
  nodeConfig: Record<string, unknown> | undefined,
  edges: { from: string; to: string; branch?: string }[],
  siblingTasks: WorkflowTask[] = [],
  artifacts: Artifact[] = [],
): ConditionTaskHandlerDeps {
  const workflowRuns: WorkflowRunRepository = {
    getById: async (id) => (id === run.id ? run : null),
    getByVersionAndIdempotencyKey: async () => null,
    listForWorkItem: async () => [],
    create: async () => {},
  };

  const workflowVersions: WorkflowVersionRepository = {
    getById: async (id) =>
      id === run.workflowVersionId
        ? {
            id: run.workflowVersionId,
            workflowDefinitionId: randomUUID() as never,
            version: 1,
            status: 'PUBLISHED',
            definition: {
              name: 'Condition Test Workflow',
              trigger: { type: 'WORK_ITEM_MANUAL' },
              inputs: [],
              nodes: [
                {
                  id: 'route',
                  type: 'CONDITION',
                  ...(nodeConfig !== undefined ? { config: nodeConfig } : {}),
                },
              ],
              edges,
              policies: [],
              outputs: [],
            },
            createdBy: 'test',
            createdAt: now,
          }
        : null,
    getByDefinitionAndVersion: async () => null,
    getLatestForDefinition: async () => null,
    listForDefinition: async () => [],
    create: async () => {},
    updateDefinition: async () => {},
    publish: async () => {},
  };

  const workflowTasks: WorkflowTaskRepository = {
    getById: async (id) => siblingTasks.find((task) => task.id === id) ?? null,
    listForRun: async () => siblingTasks,
    create: async () => {},
  };

  const artifactRepo: ArtifactRepository = {
    getById: async (id) => artifacts.find((artifact) => artifact.id === id) ?? null,
    listForProject: async () => [],
    create: async () => {},
  };

  return { workflowRuns, workflowVersions, workflowTasks, artifacts: artifactRepo };
}

describe('runConditionTask', () => {
  it('evaluates a variable-source rule and reports the taken branch, skipping the untaken target', async () => {
    const run = makeRun({ input: { flag: true } });
    const task = makeTask(run, 'route');
    const deps = makeDeps(
      run,
      {
        rule: { source: 'variable', path: 'flag', operator: 'equals', value: true },
        whenTrue: 'yes',
        whenFalse: 'no',
      },
      [
        { from: 'route', to: 'takenPath', branch: 'yes' },
        { from: 'route', to: 'untakenPath', branch: 'no' },
      ],
    );

    const output = await runConditionTask(deps, task);

    expect(output).toMatchObject({
      status: 'SUCCEEDED',
      branch: 'yes',
      skipTaskKeys: ['untakenPath'],
    });
  });

  it('takes the false branch when the variable rule evaluates false', async () => {
    const run = makeRun({ input: { flag: false } });
    const task = makeTask(run, 'route');
    const deps = makeDeps(
      run,
      {
        rule: { source: 'variable', path: 'flag', operator: 'equals', value: true },
      },
      [
        { from: 'route', to: 'takenPath', branch: 'true' },
        { from: 'route', to: 'untakenPath', branch: 'false' },
      ],
    );

    const output = await runConditionTask(deps, task);

    expect(output).toMatchObject({ branch: 'false', skipTaskKeys: ['takenPath'] });
  });

  it('evaluates a task-source rule against a prior task output field', async () => {
    const run = makeRun();
    const task = makeTask(run, 'route');
    const upstream: WorkflowTask = {
      ...makeTask(run, 'build'),
      status: 'SUCCEEDED',
      output: { testsPassed: true },
    };
    const deps = makeDeps(
      run,
      {
        rule: {
          source: 'task',
          taskKey: 'build',
          field: 'testsPassed',
          operator: 'equals',
          value: true,
        },
      },
      [{ from: 'route', to: 'onPass', branch: 'true' }],
      [upstream],
    );

    const output = await runConditionTask(deps, task);

    expect(output).toMatchObject({ branch: 'true' });
  });

  it('evaluates an artifact-source rule against the produced artifact status', async () => {
    const run = makeRun();
    const task = makeTask(run, 'route');
    const artifactId = randomUUID() as ArtifactId;
    const upstream: WorkflowTask = {
      ...makeTask(run, 'review'),
      status: 'SUCCEEDED',
      output: { artifactId },
    };
    const artifact: Artifact = {
      id: artifactId,
      projectId: run.projectId,
      artifactType: 'REVIEW_REPORT',
      name: 'Review',
      status: 'APPROVED',
      workflowRunId: run.id,
      workflowTaskId: upstream.id,
      createdBy: 'test',
      createdAt: now,
      updatedAt: now,
    };
    const deps = makeDeps(
      run,
      { rule: { source: 'artifact', taskKey: 'review', operator: 'equals', value: 'APPROVED' } },
      [{ from: 'route', to: 'onApproved', branch: 'true' }],
      [upstream],
      [artifact],
    );

    const output = await runConditionTask(deps, task);

    expect(output).toMatchObject({ branch: 'true' });
  });

  it('supports the exists operator against a missing variable', async () => {
    const run = makeRun({ input: {} });
    const task = makeTask(run, 'route');
    const deps = makeDeps(
      run,
      { rule: { source: 'variable', path: 'nope', operator: 'exists' } },
      [],
    );

    const output = await runConditionTask(deps, task);

    expect(output).toMatchObject({ branch: 'false' });
  });

  it('does not report skipTaskKeys when no edge is tagged with a branch', async () => {
    const run = makeRun({ input: { flag: true } });
    const task = makeTask(run, 'route');
    const deps = makeDeps(
      run,
      { rule: { source: 'variable', path: 'flag', operator: 'equals', value: true } },
      [{ from: 'route', to: 'always' }],
    );

    const output = await runConditionTask(deps, task);

    expect(output.skipTaskKeys).toBeUndefined();
  });

  it('throws when the node has no config.rule', async () => {
    const run = makeRun();
    const task = makeTask(run, 'route');
    const deps = makeDeps(run, undefined, []);

    await expect(runConditionTask(deps, task)).rejects.toThrow('has no config.rule');
  });

  it('throws when the run cannot be found', async () => {
    const run = makeRun();
    const task = makeTask(run, 'route');
    const deps = makeDeps(run, { rule: { source: 'variable', path: 'x', operator: 'exists' } }, []);
    const missingTask = { ...task, workflowRunId: randomUUID() as WorkflowTask['workflowRunId'] };

    await expect(runConditionTask(deps, missingTask)).rejects.toThrow('not found');
  });
});
