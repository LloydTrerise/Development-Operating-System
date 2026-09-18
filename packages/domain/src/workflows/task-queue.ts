import type { WorkflowTask } from './workflow-task.js';

export const MAX_TASK_ATTEMPTS = 3;

export interface TaskFailure {
  code?: string;
  message: string;
}

export interface TaskQueue {
  claimNext: () => Promise<WorkflowTask | null>;
  /**
   * DEVOS-094: `attempt` is the fencing token — the attempt number the
   * caller believes it still holds (from the `WorkflowTask` it was handed
   * by `claimNext()`). Applied only if the row is still `RUNNING` under
   * that exact attempt; otherwise the row has already moved on (reclaimed
   * by another worker and resolved under a later attempt), and this call
   * is a safe no-op rather than silently clobbering that later outcome.
   */
  complete: (
    taskId: WorkflowTask['id'],
    attempt: number,
    output: Record<string, unknown>,
  ) => Promise<void>;
  /** DEVOS-094: see `complete()` — same fencing-token contract. */
  fail: (
    taskId: WorkflowTask['id'],
    attempt: number,
    failure: TaskFailure,
    retryable: boolean,
  ) => Promise<void>;
  /**
   * Recovers tasks left in RUNNING state by a worker that claimed them and
   * then crashed/was killed before calling complete()/fail() — without
   * this, such a task is stuck forever, since claimNext() only selects
   * PENDING rows. A task whose started_at is older than staleThresholdMs
   * is treated exactly like a retryable failure: reset to PENDING if
   * attempts remain, else FAILED (same MAX_TASK_ATTEMPTS accounting as
   * fail()). Returns the number of tasks reclaimed.
   */
  reclaimStale: (staleThresholdMs: number) => Promise<number>;
  /**
   * DEVOS-121: a `WAIT` node's handler (`runWaitTask`) reports it isn't
   * ready yet by returning a reserved `waitUntil` output key instead of
   * completing — the dispatcher (`task-dispatcher.ts`) calls this instead
   * of `complete()` in that case. Transitions RUNNING -> WAITING (not
   * SUCCEEDED, and not counted as a failure/retry) and records `readyAt`
   * for `resumeReadyWaits()` to later find. Same attempt-fencing contract
   * as `complete()`/`fail()`.
   */
  markWaiting: (taskId: WorkflowTask['id'], attempt: number, readyAt: string) => Promise<void>;
  /**
   * DEVOS-121: the `WAIT`-node counterpart to `reclaimStale()` — periodic
   * maintenance, called from the same dispatcher poll loop, that finds
   * every `WAITING` task whose recorded `readyAt` has passed and resets it
   * to `PENDING` so `claimNext()` can pick it up again for real re-
   * evaluation (a duration wait's own re-check confirms it's actually over;
   * a dependency wait's own re-check tests its condition again). Returns
   * the number of tasks resumed.
   */
  resumeReadyWaits: () => Promise<number>;
}
