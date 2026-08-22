import type { MembershipId, ProjectId } from '@devos/contracts';
import { canManageMembers } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';
import { assertNotLastOwner, resolveMembership } from './membership-access.js';

export async function removeMember(
  deps: ProjectUseCaseDeps,
  requesterPrincipalId: string,
  projectId: ProjectId,
  targetMembershipId: MembershipId,
): Promise<void> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Project');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const target = await deps.memberships.getById(targetMembershipId);
  if (!target || target.projectId !== projectId) throw new NotFoundError('Membership');

  if (target.role === 'OWNER') {
    await assertNotLastOwner(deps, projectId, target.id);
  }

  await deps.memberships.remove(target.id);
}
