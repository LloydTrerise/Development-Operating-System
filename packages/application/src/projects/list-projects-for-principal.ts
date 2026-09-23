import type { ProjectId } from '@devos/contracts';
import type { Project } from '@devos/domain';
import type { ProjectUseCaseDeps } from './deps.js';

/**
 * DEVOS-292: when a real `effective_project_access` resolver is wired
 * (`apps/api/src/app.ts`, backed by migration `0049`'s view), this is one
 * real query instead of the N+1 fan-out below — confirmed to return
 * identical project sets for every existing project member, and to
 * additionally surface every project in an organisation for its
 * `ORGANISATION_ADMIN`s/owner (`packages/application/tests/organisations.test.ts`).
 * Every `ProjectUseCaseDeps` test fake that omits the resolver (the
 * majority of this codebase's own existing test suites) keeps exercising
 * the pre-existing heuristic unchanged.
 */
export async function listProjectsForPrincipal(
  deps: ProjectUseCaseDeps,
  principalId: string,
): Promise<Project[]> {
  if (deps.listEffectiveProjectIdsForPrincipal) {
    const projectIds = await deps.listEffectiveProjectIdsForPrincipal(principalId);
    const projects = await Promise.all(projectIds.map((id) => deps.projects.getById(id)));
    return projects.filter((project): project is Project => project !== null);
  }

  const memberships = await deps.memberships.listForPrincipal(principalId);
  const orgLevel = memberships.filter((membership) => membership.projectId === null);
  const projectLevel = memberships.filter((membership) => membership.projectId !== null);

  const fromOrganisations = (
    await Promise.all(
      orgLevel.map((membership) => deps.projects.listForOrganisation(membership.organisationId)),
    )
  ).flat();

  const fromProjects = (
    await Promise.all(
      projectLevel.map((membership) => deps.projects.getById(membership.projectId as ProjectId)),
    )
  ).filter((project): project is Project => project !== null);

  const byId = new Map<string, Project>();
  for (const project of [...fromOrganisations, ...fromProjects]) byId.set(project.id, project);

  return [...byId.values()];
}
