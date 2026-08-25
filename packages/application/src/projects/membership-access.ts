import type { Membership, MembershipRepository, Project } from '@devos/domain';
import { ValidationError } from '../errors.js';

/**
 * DEVOS-086: narrowed to only what these two functions actually touch
 * (`memberships`), not the full `ProjectUseCaseDeps` — every one of the
 * ~20 unrelated use-case deps interfaces that call `resolveMembership`
 * structurally satisfies this without needing `ProjectUseCaseDeps`'s own
 * fields (like the new `auditRecords`), which are irrelevant to membership
 * resolution.
 */
export interface MembershipAccessDeps {
  memberships: MembershipRepository;
}

export async function resolveMembership(
  deps: MembershipAccessDeps,
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
  deps: MembershipAccessDeps,
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
