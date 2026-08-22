import type { Membership, Project } from '@devos/domain';
import { ValidationError } from '../errors.js';
import type { ProjectUseCaseDeps } from './deps.js';

export async function resolveMembership(
  deps: ProjectUseCaseDeps,
  principalId: string,
  project: Project,
): Promise<Membership | null> {
  const direct = await deps.memberships.getForPrincipalAndProject(principalId, project.id);
  if (direct) return direct;

  const orgLevel = (await deps.memberships.listForPrincipal(principalId)).find(
    (membership) =>
      membership.projectId === null && membership.organisationId === project.organisationId,
  );

  return orgLevel ?? null;
}

export async function assertNotLastOwner(
  deps: ProjectUseCaseDeps,
  projectId: Project['id'],
  excludingMembershipId: Membership['id'],
): Promise<void> {
  const members = await deps.memberships.listForProject(projectId);
  const otherOwners = members.filter(
    (member) => member.role === 'OWNER' && member.id !== excludingMembershipId,
  );

  if (otherOwners.length === 0) {
    throw new ValidationError('Cannot remove the last owner of a project.');
  }
}
