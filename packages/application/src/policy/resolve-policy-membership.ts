import type { OrganisationId } from '@devos/contracts';
import type { Membership, Policy } from '@devos/domain';
import { resolveOrganisationMembership } from '../organisations/membership-access.js';
import { resolveMembership } from '../projects/membership-access.js';
import type { PolicyUseCaseDeps } from './deps.js';

/**
 * DEVOS-139: a `Policy` is either project-scoped (`projectId` set — resolve
 * membership through the project, as every policy use case already did) or
 * organisation-scoped (`projectId === undefined` — resolve membership
 * through the organisation directly). Shared by every policy use case that
 * needs "does this principal have standing over this policy's own scope,"
 * so the branch is written once, not duplicated per call site.
 */
export async function resolveMembershipForPolicy(
  deps: PolicyUseCaseDeps,
  principalId: string,
  policy: Policy,
): Promise<{ membership: Membership; organisationId: OrganisationId } | null> {
  if (policy.projectId === undefined) {
    const membership = await resolveOrganisationMembership(
      deps,
      principalId,
      policy.organisationId,
    );
    return membership ? { membership, organisationId: policy.organisationId } : null;
  }

  const project = await deps.projects.getById(policy.projectId);
  if (!project) return null;

  const membership = await resolveMembership(deps, principalId, project);
  return membership ? { membership, organisationId: project.organisationId } : null;
}
