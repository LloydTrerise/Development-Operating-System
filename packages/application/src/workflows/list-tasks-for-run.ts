import type { WorkflowRunId } from '@devos/contracts';
import type { WorkflowTask } from '@devos/domain';
import { getWorkflowRunForPrincipal } from './get-workflow-run.js';
import type { WorkflowUseCaseDeps } from './deps.js';

export async function listTasksForRun(
  deps: WorkflowUseCaseDeps,
  principalId: string,
  runId: WorkflowRunId,
): Promise<WorkflowTask[]> {
  const run = await getWorkflowRunForPrincipal(deps, principalId, runId);
  return deps.workflowTasks.listForRun(run.id);
}
