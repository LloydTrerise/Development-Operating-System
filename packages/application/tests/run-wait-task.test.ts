import { randomUUID } from 'node:crypto';
import type {
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';
import { describe, expect, it } from 'vitest';
import type { WaitTaskHandlerDeps } from '../src/tasks/run-wait-task.js';
import { runWaitTask } from '../src/tasks/run-wait-task.js';

const now = new Date(0).toISOString();

function makeRun(): WorkflowRun {
  return {
    id: randomUUID() as WorkflowRun['id'],
    projectId: randomUUID() as WorkflowRun['projectId'],
    workflowVersionId: randomUUID() as WorkflowRun['workflowVersionId'],
    workItemId: randomUUID() as WorkflowRun['workItemId'],
    status: 'PENDING',
    input: {},
    createdAt: now,
    updatedAt: now,
  };
}

function makeTask(
  run: WorkflowRun,
  taskKey: string,
  output?: Record<string, unknown>,
): WorkflowTask {
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: run.id,
    taskKey,
    taskType: 'WAIT',
    status: 'RUNNING',
    attempt: 1,
    input: {},
    ...(output !== undefined ? { output } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function makeDeps(
  run: WorkflowRun,
  nodeConfig: Record<string, unknown> | undefined,
  siblingTasks: WorkflowTask[] = [],
): WaitTaskHandlerDeps {
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
              name: 'Wait Test Workflow',
              trigger: { type: 'WORK_ITEM_MANUAL' },
              inputs: [],
              nodes: [
                {
                  id: 'wait',
                  type: 'WAIT',
                  ...(nodeConfig !== undefined ? { config: nodeConfig } : {}),
                },
              ],
              edges: [],
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

  return { workflowRuns, workflowVersions, workflowTasks };
}

describe('runWaitTask', () => {
  describe('duration', () => {
    it('reports a future waitUntil on its first call', async () => {
      const run = makeRun();
      const task = makeTask(run, 'wait');
      const deps = makeDeps(run, { waitType: 'duration', durationSeconds: 30 });

      const before = Date.now();
      const output = await runWaitTask(deps, task);
      const after = Date.now();

      expect(typeof output.waitUntil).toBe('string');
      const waitUntilMs = Date.parse(output.waitUntil as string);
      expect(waitUntilMs).toBeGreaterThanOrEqual(before + 30_000);
      expect(waitUntilMs).toBeLessThanOrEqual(after + 30_000);
    });

    it('completes once resumed with a prior waitUntil already recorded in its own output', async () => {
      const run = makeRun();
      const task = makeTask(run, 'wait', { waitUntil: new Date(0).toISOString() });
      const deps = makeDeps(run, { waitType: 'duration', durationSeconds: 30 });

      const output = await runWaitTask(deps, task);

      expect(output).toEqual({ status: 'SUCCEEDED' });
    });
  });

  describe('dependency', () => {
    it('reports a short waitUntil when the named task has not produced an artifact yet', async () => {
      const run = makeRun();
      const task = makeTask(run, 'wait');
      const producer = makeTask(run, 'produce');
      const deps = makeDeps(run, { waitType: 'dependency', taskKey: 'produce' }, [producer]);

      const output = await runWaitTask(deps, task);

      expect(typeof output.waitUntil).toBe('string');
    });

    it('completes once the named task has produced an artifact', async () => {
      const run = makeRun();
      const task = makeTask(run, 'wait');
      const artifactId = randomUUID();
      const producer = makeTask(run, 'produce', { artifactId });
      const deps = makeDeps(run, { waitType: 'dependency', taskKey: 'produce' }, [producer]);

      const output = await runWaitTask(deps, task);

      expect(output).toEqual({ status: 'SUCCEEDED', artifactId });
    });

    it('uses a custom pollIntervalSeconds when re-checking', async () => {
      const run = makeRun();
      const task = makeTask(run, 'wait');
      const deps = makeDeps(run, {
        waitType: 'dependency',
        taskKey: 'produce',
        pollIntervalSeconds: 5,
      });

      const before = Date.now();
      const output = await runWaitTask(deps, task);

      const waitUntilMs = Date.parse(output.waitUntil as string);
      expect(waitUntilMs).toBeGreaterThanOrEqual(before + 5_000);
    });
  });

  it('throws when the node has no config.waitType', async () => {
    const run = makeRun();
    const task = makeTask(run, 'wait');
    const deps = makeDeps(run, undefined);

    await expect(runWaitTask(deps, task)).rejects.toThrow('has no config.waitType');
  });

  it('throws when the run cannot be found', async () => {
    const run = makeRun();
    const task = makeTask(run, 'wait');
    const deps = makeDeps(run, { waitType: 'duration', durationSeconds: 1 });
    const missingTask = { ...task, workflowRunId: randomUUID() as WorkflowTask['workflowRunId'] };

    await expect(runWaitTask(deps, missingTask)).rejects.toThrow('not found');
  });
});
