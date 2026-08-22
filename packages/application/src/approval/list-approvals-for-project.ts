import type { ProjectId } from '@devos/contracts';
import type { Approval } from '@devos/domain';
import { NotFoundError } from '../errors.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { ApprovalUseCaseDeps } from './deps.js';

export async function listApprovalsForProject(
  deps: ApprovalUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<Approval[]> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  return deps.approvals.listForProject(projectId);
}
