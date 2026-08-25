import type { Membership, Project } from '@devos/domain';
import type { ToolGatewayDeps } from './deps.js';

/**
 * The "Project Scope" chain step (specs/api/poc-api-contracts.md §56).
 * Deliberately a local copy of `@devos/application`'s internal (not
 * publicly exported) `resolveMembership` rather than an import: that
 * helper lives in `projects/membership-access.ts`, a file `@devos/application`
 * does not re-export from its own `index.ts`, and reaching past a
 * package's public barrel to its internals would violate the same
 * package-boundary discipline AGENTS.md §13 asks every other package here
 * to respect.
 */
export async function resolveProjectScope(
  deps: ToolGatewayDeps,
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
