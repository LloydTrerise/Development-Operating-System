import { randomUUID } from 'node:crypto';
import {
  NonRetryableTaskError,
  type TaskFailure,
  type TaskQueue,
  type WorkflowTask,
} from '@devos/domain';
import { createMetricsRegistry } from '@devos/observability';
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

function createFakeQueue(tasks: WorkflowTask[], reclaimedCount = 0) {
  const queue = [...tasks];
  const completed: { taskId: string; output: Record<string, unknown> }[] = [];
  const failed: { taskId: string; failure: TaskFailure; retryable: boolean }[] = [];
  let reclaimCalls = 0;

  const taskQueue: TaskQueue = {
    claimNext: async () => queue.shift() ?? null,
    complete: async (taskId, _attempt, output) => {
      completed.push({ taskId, output });
    },
    fail: async (taskId, _attempt, failure, retryable) => {
      failed.push({ taskId, failure, retryable });
    },
    reclaimStale: async () => {
      reclaimCalls += 1;
      return reclaimedCount;
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

  it('DEVOS-077: marks a task non-retryable when its handler throws NonRetryableTaskError, failing it immediately', async () => {
    const task = createTask();
    const { taskQueue, failed } = createFakeQueue([task]);
    const dispatcher = createTaskDispatcher(taskQueue);
    dispatcher.registerHandler('TASK', async () => {
      throw new NonRetryableTaskError('policy denied this release');
    });

    const result = await dispatcher.processNext();

    expect(result).toEqual({ taskId: task.id, outcome: 'failed' });
    expect(failed).toEqual([
      { taskId: task.id, failure: { message: 'policy denied this release' }, retryable: false },
    ]);
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

  describe('DEVOS-087: metrics', () => {
    it('records a claim and a completion, labeled by task type, when a handler succeeds', async () => {
      const task = createTask({ taskType: 'AGENT_TASK' });
      const { taskQueue } = createFakeQueue([task]);
      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, { metrics });
      dispatcher.registerHandler('AGENT_TASK', async () => ({}));

      await dispatcher.processNext();

      expect(metrics.getCounter('task_queue.claimed', { taskType: 'AGENT_TASK' })).toBe(1);
      expect(metrics.getCounter('task_queue.completed', { taskType: 'AGENT_TASK' })).toBe(1);
      expect(
        metrics.getHistogram('workflow_task.duration_ms', { taskType: 'AGENT_TASK' })?.count,
      ).toBe(1);
    });

    it('records a retrying outcome, labeled by task type, when a handler throws a plain error', async () => {
      const task = createTask({ taskType: 'TOOL_TASK' });
      const { taskQueue } = createFakeQueue([task]);
      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, { metrics });
      dispatcher.registerHandler('TOOL_TASK', async () => {
        throw new Error('boom');
      });

      await dispatcher.processNext();

      expect(metrics.getCounter('task_queue.retrying', { taskType: 'TOOL_TASK' })).toBe(1);
      expect(metrics.getCounter('task_queue.failed', { taskType: 'TOOL_TASK' })).toBe(0);
    });

    it('records a failed outcome when a handler throws NonRetryableTaskError', async () => {
      const task = createTask({ taskType: 'TOOL_TASK' });
      const { taskQueue } = createFakeQueue([task]);
      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, { metrics });
      dispatcher.registerHandler('TOOL_TASK', async () => {
        throw new NonRetryableTaskError('policy denied');
      });

      await dispatcher.processNext();

      expect(metrics.getCounter('task_queue.failed', { taskType: 'TOOL_TASK' })).toBe(1);
      expect(metrics.getCounter('task_queue.retrying', { taskType: 'TOOL_TASK' })).toBe(0);
    });

    it('records a failed outcome when no handler is registered', async () => {
      const task = createTask({ taskType: 'UNKNOWN' });
      const { taskQueue } = createFakeQueue([task]);
      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, { metrics });

      await dispatcher.processNext();

      expect(metrics.getCounter('task_queue.failed', { taskType: 'UNKNOWN' })).toBe(1);
    });

    it('records reclaimed-stale count from a real non-zero reclaimStale() result', async () => {
      const { taskQueue } = createFakeQueue([], 2);
      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, {
        pollIntervalMs: 5,
        reclaimIntervalMs: 60_000,
        metrics,
      });

      dispatcher.start();
      await vi.waitFor(() => expect(metrics.getCounter('task_queue.reclaimed_stale')).toBe(2));
      await dispatcher.stop();
    });

    it('does not throw or require metrics when none is supplied (fully optional)', async () => {
      const task = createTask();
      const { taskQueue } = createFakeQueue([task]);
      const dispatcher = createTaskDispatcher(taskQueue);
      dispatcher.registerHandler('TASK', async () => ({}));

      await expect(dispatcher.processNext()).resolves.toMatchObject({ outcome: 'succeeded' });
    });
  });

  describe('DEVOS-092: recovery from a transient queue-level failure', () => {
    it('survives a transient error thrown by claimNext() itself and keeps processing afterward', async () => {
      const task = createTask();
      let claimAttempts = 0;
      const completed: { taskId: string; output: Record<string, unknown> }[] = [];

      const taskQueue: TaskQueue = {
        claimNext: async () => {
          claimAttempts += 1;
          // The first claim attempt simulates a transient failure at the
          // queue level itself (e.g. a dropped DB connection) — distinct
          // from a task handler throwing, which processNext() already
          // handles. Every attempt after the first behaves normally.
          if (claimAttempts === 1) throw new Error('connection terminated unexpectedly');
          return claimAttempts === 2 ? task : null;
        },
        complete: async (taskId, _attempt, output) => {
          completed.push({ taskId, output });
        },
        fail: async () => {},
        reclaimStale: async () => 0,
      };

      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(taskQueue, { pollIntervalMs: 5, metrics });
      dispatcher.registerHandler('TASK', async () => ({ result: 'ok' }));

      dispatcher.start();
      await vi.waitFor(() => expect(completed).toHaveLength(1));
      await dispatcher.stop();

      expect(completed).toEqual([{ taskId: task.id, output: { result: 'ok' } }]);
      expect(metrics.getCounter('task_queue.dispatch_error')).toBe(1);
      // The loop is still "stopped" cleanly, not crashed — start()/stop()
      // remain meaningful, proving the dispatch loop as a whole survived.
      expect(dispatcher.status()).toBe('stopped');
    });

    it('survives a transient error thrown by reclaimStale() itself without ever wedging the loop', async () => {
      const { taskQueue } = createFakeQueue([]);
      let reclaimAttempts = 0;
      const wrappedQueue: TaskQueue = {
        ...taskQueue,
        reclaimStale: async (thresholdMs) => {
          reclaimAttempts += 1;
          if (reclaimAttempts === 1) throw new Error('connection terminated unexpectedly');
          return taskQueue.reclaimStale(thresholdMs);
        },
      };

      const metrics = createMetricsRegistry();
      const dispatcher = createTaskDispatcher(wrappedQueue, {
        pollIntervalMs: 5,
        reclaimIntervalMs: 60_000,
        metrics,
      });

      dispatcher.start();
      await vi.waitFor(() => expect(reclaimAttempts).toBeGreaterThanOrEqual(2));
      await dispatcher.stop();

      expect(metrics.getCounter('task_queue.dispatch_error')).toBeGreaterThanOrEqual(1);
      expect(dispatcher.status()).toBe('stopped');
    });
  });
});
