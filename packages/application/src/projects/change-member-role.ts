import { randomUUID } from 'node:crypto';
import type { AuditId, MembershipId, ProjectId } from '@devos/contracts';
import { canManageMembers, type Membership, type MembershipRole } from '@devos/domain';
import { ForbiddenError, NotFoundError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';
import { assertNotLastOwner, resolveMembership } from './membership-access.js';

export async function changeMemberRole(
  deps: ProjectUseCaseDeps,
  requesterPrincipalId: string,
  projectId: ProjectId,
  targetMembershipId: MembershipId,
  role: MembershipRole,
): Promise<Membership> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Project');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const target = await deps.memberships.getById(targetMembershipId);
  if (!target || target.projectId !== projectId) throw new NotFoundError('Membership');

  if (target.role === 'OWNER' && role !== 'OWNER') {
    await assertNotLastOwner(deps, projectId, target.id);
  }

  const previousRole = target.role;
  const updatedAt = new Date().toISOString();
  await deps.memberships.updateRole(target.id, role, updatedAt);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'membership.role_changed',
    targetType: 'Membership',
    targetId: target.id,
    outcome: 'SUCCESS',
    metadata: { principalId: target.principalId, previousRole, role },
    createdAt: updatedAt,
  });

  return { ...target, role, updatedAt };
}
