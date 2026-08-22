import type { ApprovalId } from '@devos/contracts';
import type { Approval } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ApprovalUseCaseDeps } from './deps.js';

export async function getApprovalForPrincipal(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  approvalId: ApprovalId,
): Promise<Approval> {
  const approval = await deps.approvals.getById(approvalId);
  if (!approval) throw new NotFoundError('Approval');

  const project = await deps.projects.getById(approval.projectId);
  if (!project) throw new NotFoundError('Approval');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Approval');

  return approval;
}
