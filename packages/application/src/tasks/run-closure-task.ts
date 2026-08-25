import type { WorkflowTask } from '@devos/domain';
import { NonRetryableTaskError, ValidationError } from '@devos/domain';
import { closeWorkItem } from '../workflows/close-work-item.js';
import type { ClosureUseCaseDeps } from '../workflows/deps.js';

// Matches run-validation-task.ts's identical constant — the agent runtime
// acting without a human principal. The seeded project already grants this
// principal a real OWNER membership (DEVOS-052's own precedent), which is
// exactly what `closeWorkItem`'s `resolveMembership` check needs.
const SYSTEM_ACTOR_ID = 'devos-agent-runtime';

/**
 * Stage 12 — Closure (specs/workflows/software-change-workflow.md §23): the
 * `release-path` v2 node that runs after `runReleaseTask` in the same run
 * (DEVOS-079) — no gate sits between release and closure, so (mirroring
 * development -> validation -> review's precedent, DEVOS-067) both live as
 * separate nodes in one run rather than separate runs.
 *
 * Thin wrapper around `closeWorkItem` (DEVOS-078) — `closeWorkItem` itself
 * already does the real work (evidence gathering, the deterministic
 * evaluator, the transactional close). The one thing a task handler needs
 * that the use case doesn't provide on its own: when closure criteria
 * aren't met, `closeWorkItem` throws `ValidationError` — a state that
 * won't change on its own (retrying immediately would just re-observe the
 * same evidence), so it's re-thrown as `NonRetryableTaskError` (DEVOS-077's
 * own retry-classification mechanism) rather than left to the dispatcher's
 * default retryable behaviour.
 */
export async function runClosureTask(
  deps: ClosureUseCaseDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  const run = await deps.workflowRuns.getById(task.workflowRunId);
  if (!run) throw new Error(`Workflow run ${task.workflowRunId} not found.`);

  try {
    const result = await closeWorkItem(deps, SYSTEM_ACTOR_ID, run.workItemId);
    return { status: 'SUCCEEDED', closed: result.closed, reasons: result.reasons };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new NonRetryableTaskError(error.message);
    }
    throw error;
  }
}
