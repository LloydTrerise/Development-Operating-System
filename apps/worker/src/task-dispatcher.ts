import { NonRetryableTaskError, type TaskQueue, type WorkflowTask } from '@devos/domain';
import type { MetricsRegistry } from '@devos/observability';

export type TaskHandler = (task: WorkflowTask) => Promise<Record<string, unknown>>;

export type DispatcherStatus = 'ready' | 'running' | 'stopping' | 'stopped';

export interface TaskDispatchResult {
  taskId: string;
  outcome: 'succeeded' | 'failed' | 'retrying';
}

export interface TaskDispatcher {
  status: () => DispatcherStatus;
  registerHandler: (taskType: string, handler: TaskHandler) => void;
  processNext: () => Promise<TaskDispatchResult | undefined>;
  start: () => void;
  stop: () => Promise<void>;
}

export interface TaskDispatcherOptions {
  pollIntervalMs?: number;
  /** How long a task may sit in RUNNING before a restarted worker reclaims it as stale (default 5 minutes). */
  staleThresholdMs?: number;
  /** How often to check for stale RUNNING tasks (default 60 seconds). */
  reclaimIntervalMs?: number;
  /**
   * DEVOS-087: workflow/agent/tool/queue metrics. Optional — omitted
   * entirely in every existing test that doesn't care about metrics, and
   * in any future caller that doesn't need them.
   */
  metrics?: MetricsRegistry;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTaskDispatcher(
  queue: TaskQueue,
  options: TaskDispatcherOptions = {},
): TaskDispatcher {
  const handlers = new Map<string, TaskHandler>();
  const pollIntervalMs = options.pollIntervalMs ?? 200;
  const staleThresholdMs = options.staleThresholdMs ?? 5 * 60 * 1000;
  const reclaimIntervalMs = options.reclaimIntervalMs ?? 60 * 1000;
  const metrics = options.metrics;

  let status: DispatcherStatus = 'ready';
  let stopRequested = false;
  let loopPromise: Promise<void> | undefined;
  let nextReclaimAt = 0;

  async function processNext(): Promise<TaskDispatchResult | undefined> {
    const task = await queue.claimNext();
    if (!task) return undefined;

    const labels = { taskType: task.taskType };
    metrics?.incrementCounter('task_queue.claimed', labels);
    const startedAt = Date.now();

    const handler = handlers.get(task.taskType);
    if (!handler) {
      await queue.fail(
        task.id,
        task.attempt,
        {
          code: 'DEVOS_NO_HANDLER',
          message: `No handler registered for task type "${task.taskType}".`,
        },
        false,
      );
      metrics?.incrementCounter('task_queue.failed', labels);
      return { taskId: task.id, outcome: 'failed' };
    }

    try {
      const output = await handler(task);
      await queue.complete(task.id, task.attempt, output);
      metrics?.incrementCounter('task_queue.completed', labels);
      metrics?.observeHistogram('workflow_task.duration_ms', Date.now() - startedAt, labels);
      return { taskId: task.id, outcome: 'succeeded' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      // DEVOS-077: a handler that recognises its own failure as
      // non-transient (e.g. a policy-denied release) opts out of the
      // default retryable classification by throwing NonRetryableTaskError
      // — every other error stays retryable exactly as before.
      const retryable = !(error instanceof NonRetryableTaskError);
      await queue.fail(task.id, task.attempt, { message }, retryable);
      metrics?.incrementCounter(retryable ? 'task_queue.retrying' : 'task_queue.failed', labels);
      metrics?.observeHistogram('workflow_task.duration_ms', Date.now() - startedAt, labels);
      return { taskId: task.id, outcome: retryable ? 'retrying' : 'failed' };
    }
  }

  async function loop(): Promise<void> {
    while (!stopRequested) {
      try {
        if (Date.now() >= nextReclaimAt) {
          const reclaimed = await queue.reclaimStale(staleThresholdMs);
          if (reclaimed > 0) {
            metrics?.incrementCounter('task_queue.reclaimed_stale', undefined, reclaimed);
          }
          nextReclaimAt = Date.now() + reclaimIntervalMs;
        }

        const result = await processNext();
        if (!result) await delay(pollIntervalMs);
      } catch {
        // DEVOS-092: every error a task's own handler throws is already
        // caught inside processNext() and turned into a retryable/failed
        // task outcome — this catches everything else (a transient failure
        // in claimNext()/reclaimStale()/complete()/fail() themselves, e.g. a
        // dropped DB connection). Without this, a single transient queue-
        // level error would propagate out of the unawaited `loopPromise`
        // and permanently stop the dispatch loop with no one watching to
        // notice — the queue would look "stuck" forever with no crash
        // reported anywhere. Retrying after the normal poll interval, the
        // same way "nothing to claim" is already handled, is the minimal
        // fix: transient failures get a fresh attempt next tick instead of
        // silently ending the process's ability to make progress at all.
        metrics?.incrementCounter('task_queue.dispatch_error');
        await delay(pollIntervalMs);
      }
    }
    status = 'stopped';
  }

  function start(): void {
    if (status !== 'ready') return;
    status = 'running';
    stopRequested = false;
    // Reclaim once immediately on startup — the exact scenario this
    // exists for (a worker crashed holding a task, this process is its
    // replacement) shouldn't have to wait a full reclaimIntervalMs.
    nextReclaimAt = 0;
    loopPromise = loop();
  }

  async function stop(): Promise<void> {
    if (status !== 'running') return;
    status = 'stopping';
    stopRequested = true;
    await loopPromise;
  }

  return {
    status: () => status,
    registerHandler: (taskType, handler) => {
      handlers.set(taskType, handler);
    },
    processNext,
    start,
    stop,
  };
}
