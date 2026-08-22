import type { WorkflowRunId } from '@devos/contracts';
import type { WorkflowRun, WorkflowRunRepository } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ProjectUseCaseDeps } from '../projects/deps.js';

/**
 * Narrower than WorkflowUseCaseDeps (the only fields this function actually
 * touches) so other deps shapes that also need "resolve a run for this
 * principal" — like DEVOS-036's AgentExecutionSummaryUseCaseDeps — can
 * reuse it without satisfying WorkflowUseCaseDeps's unrelated fields
 * (workItems, workflowDefinitions, etc). WorkflowUseCaseDeps itself still
 * satisfies this shape structurally, so every existing caller is unaffected.
 */
export interface GetWorkflowRunDeps extends ProjectUseCaseDeps {
  workflowRuns: WorkflowRunRepository;
}

export async function getWorkflowRunForPrincipal(
  deps: GetWorkflowRunDeps,
  principalId: string,
  runId: WorkflowRunId,
): Promise<WorkflowRun> {
  const run = await deps.workflowRuns.getById(runId);
  if (!run) throw new NotFoundError('Run');

  const project = await deps.projects.getById(run.projectId);
  if (!project) throw new NotFoundError('Run');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Run');

  return run;
}
