import type { WorkflowRunId } from '@devos/contracts';
import { getWorkflowRunForPrincipal } from './get-workflow-run.js';
import type { ToolInvocationSummaryUseCaseDeps } from './deps.js';

/**
 * DEVOS-060: the Development UI's read side — "for a development task: the
 * tool invocations it produced, their outcome, and the resulting
 * commit/PR evidence" (this task's own acceptance criterion). Not a
 * literal spec-documented endpoint (no read-API contract for this exists
 * anywhere), mirroring DEVOS-036's identical `getAgentExecutionSummariesForRun`
 * precedent for the same reason: this is what the UI needs, and nothing
 * else provides it. Unlike that one summary-per-task shape, a single task
 * can produce several tool invocations (one `repo-write` per proposed
 * file, plus one `git-commit`), so this returns a flat list rather than
 * one entry per task.
 */
export interface ToolInvocationSummary {
  taskId: string;
  invocationId: string;
  capabilityKey: string;
  status: string;
  outputMetadata?: Record<string, unknown>;
  providerReference?: string;
  errorCode?: string;
  createdAt: string;
}

export async function getToolInvocationSummariesForRun(
  deps: ToolInvocationSummaryUseCaseDeps,
  principalId: string,
  runId: WorkflowRunId,
): Promise<ToolInvocationSummary[]> {
  const run = await getWorkflowRunForPrincipal(deps, principalId, runId);
  const tasks = await deps.workflowTasks.listForRun(run.id);

  const summaries: ToolInvocationSummary[] = [];
  for (const task of tasks) {
    const invocations = await deps.toolInvocations.listForTask(task.id);
    for (const invocation of invocations) {
      const capability = await deps.toolCapabilities.getById(invocation.toolCapabilityId);

      summaries.push({
        taskId: task.id,
        invocationId: invocation.id,
        capabilityKey: capability?.key ?? 'UNKNOWN',
        status: invocation.status,
        ...(invocation.outputMetadata !== undefined
          ? { outputMetadata: invocation.outputMetadata }
          : {}),
        ...(invocation.providerReference !== undefined
          ? { providerReference: invocation.providerReference }
          : {}),
        ...(invocation.errorCode !== undefined ? { errorCode: invocation.errorCode } : {}),
        createdAt: invocation.createdAt,
      });
    }
  }

  return summaries;
}
