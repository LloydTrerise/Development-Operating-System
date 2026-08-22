import type { ProjectId } from '@devos/contracts';
import type { Project } from '@devos/domain';
import type { ProjectUseCaseDeps } from './deps.js';

export async function listProjectsForPrincipal(
  deps: ProjectUseCaseDeps,
  principalId: string,
): Promise<Project[]> {
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
