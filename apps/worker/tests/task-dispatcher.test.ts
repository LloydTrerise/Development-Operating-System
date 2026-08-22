import { randomUUID } from 'node:crypto';
import type { TaskFailure, TaskQueue, WorkflowTask } from '@devos/domain';
import { describe, expect, it, vi } from 'vitest';
import { createTaskDispatcher } from '../src/task-dispatcher.js';

function createTask(overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  const now = new Date(0).toISOString();
  return {
    id: randomUUID() as WorkflowTask['id'],
    workflowRunId: randomUUID() as WorkflowTask['workflowRunId'],
    taskKey: 'discovery',
    taskType: 'TASK',
    status: 'PENDING',
    attempt: 0,
    input: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createFakeQueue(tasks: WorkflowTask[]) {
  const queue = [...tasks];
  const completed: { taskId: string; output: Record<string, unknown> }[] = [];
  const failed: { taskId: string; failure: TaskFailure; retryable: boolean }[] = [];
  let reclaimCalls = 0;

  const taskQueue: TaskQueue = {
    claimNext: async () => queue.shift() ?? null,
    complete: async (taskId, output) => {
      completed.push({ taskId, output });
    },
    fail: async (taskId, failure, retryable) => {
      failed.push({ taskId, failure, retryable });
    },
    reclaimStale: async () => {
      reclaimCalls += 1;
      return 0;
    },
  };

  return { taskQueue, completed, failed, getReclaimCalls: () => reclaimCalls };
}

describe('task dispatcher', () => {
  it('starts in a ready state', () => {
    const { taskQueue } = createFakeQueue([]);
    const dispatcher = createTaskDispatcher(taskQueue);
    expect(dispatcher.status()).toBe('ready');
  });

  it('processes a claimed task through its registered handler', async () => {
    const task = createTask();
    const { taskQueue, completed } = createFakeQueue([task]);
    const dispatcher = createTaskDispatcher(taskQueue);
    dispatcher.registerHandler('TASK', async () => ({ result: 'ok' }));

    const result = await dispatcher.processNext();

    expect(result).toEqual({ taskId: task.id, outcome: 'succeeded' });
    expect(completed).toEqual([{ taskId: task.id, output: { result: 'ok' } }]);
  });

  it('fails a task gracefully when no handler is registered', async () => {
    const task = createTask({ taskType: 'UNKNOWN' });
    const { taskQueue, failed } = createFakeQueue([task]);
    const dispatcher = createTaskDispatcher(taskQueue);

    const result = await dispatcher.processNext();

    expect(result).toEqual({ taskId: task.id, outcome: 'failed' });
    expect(failed).toHaveLength(1);
    expect(failed[0]?.retryable).toBe(false);
  });

  it('marks a task retryable when its handler throws', async () => {
    const task = createTask();
    const { taskQueue, failed } = createFakeQueue([task]);
    const dispatcher = createTaskDispatcher(taskQueue);
    dispatcher.registerHandler('TASK', async () => {
      throw new Error('boom');
    });

    const result = await dispatcher.processNext();

    expect(result).toEqual({ taskId: task.id, outcome: 'retrying' });
    expect(failed).toEqual([{ taskId: task.id, failure: { message: 'boom' }, retryable: true }]);
  });

  it('returns undefined when the queue has nothing to claim', async () => {
    const { taskQueue } = createFakeQueue([]);
    const dispatcher = createTaskDispatcher(taskQueue);

    const result = await dispatcher.processNext();

    expect(result).toBeUndefined();
  });

  it('starts consuming, processes a task, and stops gracefully', async () => {
    const task = createTask();
    const { taskQueue, completed } = createFakeQueue([task]);
    const dispatcher = createTaskDispatcher(taskQueue, { pollIntervalMs: 5 });
    dispatcher.registerHandler('TASK', async () => ({}));

    dispatcher.start();
    expect(dispatcher.status()).toBe('running');

    await vi.waitFor(() => expect(completed).toHaveLength(1));

    await dispatcher.stop();
    expect(dispatcher.status()).toBe('stopped');
  });

  it('reclaims stale tasks immediately on start, not just after the first interval', async () => {
    const { taskQueue, getReclaimCalls } = createFakeQueue([]);
    const dispatcher = createTaskDispatcher(taskQueue, {
      pollIntervalMs: 5,
      reclaimIntervalMs: 60_000,
    });

    dispatcher.start();
    await vi.waitFor(() => expect(getReclaimCalls()).toBeGreaterThanOrEqual(1));
    await dispatcher.stop();

    expect(getReclaimCalls()).toBe(1);
  });
});
