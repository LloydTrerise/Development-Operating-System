import type { TaskQueue, WorkflowTask } from '@devos/domain';

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

  let status: DispatcherStatus = 'ready';
  let stopRequested = false;
  let loopPromise: Promise<void> | undefined;
  let nextReclaimAt = 0;

  async function processNext(): Promise<TaskDispatchResult | undefined> {
    const task = await queue.claimNext();
    if (!task) return undefined;

    const handler = handlers.get(task.taskType);
    if (!handler) {
      await queue.fail(
        task.id,
        {
          code: 'DEVOS_NO_HANDLER',
          message: `No handler registered for task type "${task.taskType}".`,
        },
        false,
      );
      return { taskId: task.id, outcome: 'failed' };
    }

    try {
      const output = await handler(task);
      await queue.complete(task.id, output);
      return { taskId: task.id, outcome: 'succeeded' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      await queue.fail(task.id, { message }, true);
      return { taskId: task.id, outcome: 'retrying' };
    }
  }

  async function loop(): Promise<void> {
    while (!stopRequested) {
      if (Date.now() >= nextReclaimAt) {
        await queue.reclaimStale(staleThresholdMs);
        nextReclaimAt = Date.now() + reclaimIntervalMs;
      }

      const result = await processNext();
      if (!result) await delay(pollIntervalMs);
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
