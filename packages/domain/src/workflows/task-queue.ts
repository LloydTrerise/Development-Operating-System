import type { WorkflowTask } from './workflow-task.js';

export const MAX_TASK_ATTEMPTS = 3;

export interface TaskFailure {
  code?: string;
  message: string;
}

export interface TaskQueue {
  claimNext: () => Promise<WorkflowTask | null>;
  complete: (taskId: WorkflowTask['id'], output: Record<string, unknown>) => Promise<void>;
  fail: (taskId: WorkflowTask['id'], failure: TaskFailure, retryable: boolean) => Promise<void>;
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
