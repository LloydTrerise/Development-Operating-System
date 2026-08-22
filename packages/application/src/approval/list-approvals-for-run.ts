import type { WorkflowRunId } from '@devos/contracts';
import type { Approval } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ApprovalUseCaseDeps } from './deps.js';

export async function listApprovalsForRun(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  workflowRunId: WorkflowRunId,
): Promise<Approval[]> {
  const run = await deps.workflowRuns.getById(workflowRunId);
  if (!run) throw new NotFoundError('WorkflowRun');

  const project = await deps.projects.getById(run.projectId);
  if (!project) throw new NotFoundError('WorkflowRun');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('WorkflowRun');

  return deps.approvals.listForRun(workflowRunId);
}
