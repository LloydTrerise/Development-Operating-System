import type { ProjectId } from '@devos/contracts';
import type { JobRole } from '@devos/domain';
import { resolveMembership } from '../projects/membership-access.js';
import { NotFoundError } from '../errors.js';
import type { JobRoleUseCaseDeps } from './deps.js';

export interface ProjectJobRolesOverviewMember {
  principalId: string;
  heldJobRoleIds: string[];
  activeJobRoleIds: string[];
}

export interface ProjectJobRolesOverview {
  catalogue: JobRole[];
  members: ProjectJobRolesOverviewMember[];
}

/**
 * DEVOS-301: one call for the whole Project Members panel's job-role UI —
 * the organisation's catalogue, plus, for every current project member,
 * which job roles they hold at organisation scope and which are active on
 * this project. Deliberately a single aggregate rather than a per-member
 * fetch: `ApprovalsPage.tsx`'s own long-disclosed, still-unfixed N+1
 * evidence-fetch loop (Sprint 35 DEVOS-238, carried unresolved across
 * Sprints 39/43/44) is exactly the shape this route avoids repeating for a
 * brand-new feature.
 */
export async function getProjectJobRolesOverview(
  deps: JobRoleUseCaseDeps,
  principalId: string,
  projectId: ProjectId,
): Promise<ProjectJobRolesOverview> {
  const project = await deps.projects.getById(projectId);
  if (!project) throw new NotFoundError('Project');

  const membership = await resolveMembership(deps, principalId, project);
  if (!membership) throw new NotFoundError('Project');

  const catalogue = await deps.jobRoles.listForOrganisation(project.organisationId);
  const catalogueIds = new Set(catalogue.map((jobRole) => jobRole.id));

  const projectMembers = await deps.memberships.listForProject(projectId);
  const principalIds = [...new Set(projectMembers.map((member) => member.principalId))];

  const heldRows = deps.principalJobRoles.listForPrincipals
    ? await deps.principalJobRoles.listForPrincipals(principalIds)
    : (
        await Promise.all(principalIds.map((id) => deps.principalJobRoles.listForPrincipal(id)))
      ).flat();

  const activeRows = await deps.projectMemberJobRoles.listForProject(projectId);

  const members = principalIds.map((memberPrincipalId) => ({
    principalId: memberPrincipalId,
    heldJobRoleIds: heldRows
      .filter((row) => row.principalId === memberPrincipalId && catalogueIds.has(row.jobRoleId))
      .map((row) => row.jobRoleId),
    activeJobRoleIds: activeRows
      .filter((row) => row.principalId === memberPrincipalId)
      .map((row) => row.jobRoleId),
  }));

  return { catalogue, members };
}
