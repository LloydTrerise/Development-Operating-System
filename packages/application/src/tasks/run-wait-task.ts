import type {
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersionRepository,
} from '@devos/domain';

export interface WaitTaskHandlerDeps {
  workflowRuns: WorkflowRunRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowTasks: WorkflowTaskRepository;
}

interface DurationWaitConfig {
  waitType: 'duration';
  durationSeconds: number;
}

interface DependencyWaitConfig {
  waitType: 'dependency';
  taskKey: string;
  /** Default 1s — how soon to re-check the named task's own artifact after finding it doesn't exist yet. */
  pollIntervalSeconds?: number;
}

type WaitNodeConfig = DurationWaitConfig | DependencyWaitConfig;

const DEFAULT_DEPENDENCY_POLL_INTERVAL_SECONDS = 1;

/**
 * DEVOS-121: a `WAIT` node's real handler. Reuses the existing task-queue/
 * dispatcher polling model rather than a new scheduler: "not ready yet" is
 * reported by returning a reserved `waitUntil` output key, which
 * `task-dispatcher.ts`/`TaskQueue.markWaiting()` interpret to park the task
 * `WAITING` instead of completing it; `TaskQueue.resumeReadyWaits()` (the
 * same periodic tick that already runs `reclaimStale()`) resets it to
 * `PENDING` once `waitUntil` has passed, so `claimNext()` hands it back to
 * this same handler for a real re-check.
 *
 * Both variants share this one mechanism — the only difference is how each
 * computes/re-evaluates its own condition:
 *  - `duration`: the *first* call (no prior `waitUntil` in this task's own
 *    output) computes and reports one long `waitUntil`; by the time
 *    `resumeReadyWaits()` ever resurfaces it, the real wait is already over,
 *    so that second call just completes.
 *  - `dependency`: every call actually checks whether the named upstream
 *    task's own output already carries an `artifactId` (the same
 *    convention `run-condition-task.ts`'s artifact-source rule uses); if
 *    not, it reports a short `waitUntil` so it gets re-checked again soon.
 */
export async function runWaitTask(
  deps: WaitTaskHandlerDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  const version = await deps.workflowVersions.getById(run.workflowVersionId);
  if (!version) throw new Error(`Workflow version ${run.workflowVersionId} not found.`);

  const node = version.definition.nodes.find((candidate) => candidate.id === task.taskKey);
  if (!node) throw new Error(`WAIT node "${task.taskKey}" not found in workflow definition.`);

  const config = node.config as unknown as WaitNodeConfig | undefined;
  if (!config?.waitType) {
    throw new Error(`WAIT node "${task.taskKey}" has no config.waitType.`);
  }

  if (config.waitType === 'duration') {
    if (typeof task.output?.waitUntil === 'string') {
      return { status: 'SUCCEEDED' };
    }
    const waitUntil = new Date(Date.now() + config.durationSeconds * 1000).toISOString();
    return { waitUntil };
  }

  const tasks = await deps.workflowTasks.listForRun(task.workflowRunId);
  const upstream = tasks.find((candidate) => candidate.taskKey === config.taskKey);
  const artifactId = upstream?.output?.artifactId;
  if (typeof artifactId === 'string') {
    return { status: 'SUCCEEDED', artifactId };
  }

  const pollIntervalSeconds =
    config.pollIntervalSeconds ?? DEFAULT_DEPENDENCY_POLL_INTERVAL_SECONDS;
  const waitUntil = new Date(Date.now() + pollIntervalSeconds * 1000).toISOString();
  return { waitUntil };
}
