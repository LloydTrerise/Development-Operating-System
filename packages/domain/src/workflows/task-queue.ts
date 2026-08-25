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
}
