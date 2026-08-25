import { randomUUID } from 'node:crypto';
import type { AuditId, ProjectId } from '@devos/contracts';
import { canManageMembers, type Membership, type MembershipRole } from '@devos/domain';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';
import { resolveMembership } from './membership-access.js';

export interface AddMemberInput {
  principalId: string;
  role: MembershipRole;
}

export async function addMember(
  deps: ProjectUseCaseDeps,
  requesterPrincipalId: string,
  projectId: ProjectId,
  input: AddMemberInput,
): Promise<Membership> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const requester = await resolveMembership(deps, requesterPrincipalId, project);
  if (!requester) throw new NotFoundError('Project');
  if (!canManageMembers(requester.role)) throw new ForbiddenError();

  const existing = await deps.memberships.getForPrincipalAndProject(input.principalId, projectId);
  if (existing) throw new ValidationError('Principal is already a member of this project.');

  const now = new Date().toISOString();
  const membership: Membership = {
    id: randomUUID() as Membership['id'],
    organisationId: project.organisationId,
    projectId,
    principalId: input.principalId,
    role: input.role,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await deps.memberships.create(membership);

  await deps.auditRecords.create({
    id: randomUUID() as AuditId,
    organisationId: project.organisationId,
    projectId,
    actorType: 'USER',
    actorId: requesterPrincipalId,
    action: 'membership.added',
    targetType: 'Membership',
    targetId: membership.id,
    outcome: 'SUCCESS',
    metadata: { principalId: input.principalId, role: input.role },
    createdAt: now,
  });

  return membership;
}
