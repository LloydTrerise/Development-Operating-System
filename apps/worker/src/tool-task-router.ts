import {
  runClosureTask,
  runReleaseReadinessCheckTask,
  runReleaseRollbackTask,
  runReleaseTask,
  runSecurityScanTask,
  runValidationTask,
  type ClosureUseCaseDeps,
  type ToolTaskHandlerDeps,
} from '@devos/application';
import type { WorkflowTask } from '@devos/domain';

/**
 * DEVOS-073/076/078/113/114: mirrors `agent-task-router.ts`'s exact pattern —
 * one 'TOOL_TASK' WorkflowNodeType, now six deterministic (non-agent)
 * handlers behind it (DEVOS-064's build/test validation, DEVOS-113's
 * security scan, DEVOS-073's release-readiness check, DEVOS-076's release,
 * DEVOS-114's rollback, DEVOS-078's closure), so the
 * dispatcher's single registration for that type routes internally. Keyed
 * by `task.taskKey` (the node's own `id`, unconditionally threaded through
 * by `run-creation.ts` for every node — unlike `agentRef`, no new per-node
 * config needed to make this routable). An unrecognized taskKey fails the
 * task clearly rather than silently doing nothing.
 *
 * `deps` is typed as `ToolTaskHandlerDeps & ClosureUseCaseDeps` (a
 * structural superset of what every handler needs) rather than either
 * shape alone — each concrete handler simply ignores the fields it
 * doesn't use, the same approach `routeAgentTask` already takes.
 */
export async function routeToolTask(
  deps: ToolTaskHandlerDeps & ClosureUseCaseDeps,
  task: WorkflowTask,
): Promise<Record<string, unknown>> {
  switch (task.taskKey) {
    case 'validation':
      return runValidationTask(deps, task);
    case 'security-scan':
      return runSecurityScanTask(deps, task);
    case 'release-readiness-check':
      return runReleaseReadinessCheckTask(deps, task);
    case 'release':
      return runReleaseTask(deps, task);
    case 'rollback':
      return runReleaseRollbackTask(deps, task);
    case 'closure':
      return runClosureTask(deps, task);
    default:
      throw new Error(
        `No tool-task handler registered for taskKey "${task.taskKey}" (task ${task.id}).`,
      );
  }
}
