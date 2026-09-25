import type { OrganisationId, ProjectId } from '@devos/contracts';
import {
  assignPrincipalJobRole,
  assignProjectMemberJobRole,
  getProjectJobRolesOverview,
  listJobRolesForOrganisation,
  listPrincipalJobRoles,
  removePrincipalJobRole,
  removeProjectMemberJobRole,
  type JobRoleUseCaseDeps,
} from '@devos/application';
import {
  parseJobRoleIdBody,
  toJobRoleDto,
  toProjectJobRolesOverviewDto,
  toProjectMemberJobRoleDto,
} from '../dto/job-role.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-301 (Sprint 49, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.4):
 * "assign job roles to a principal" (organisation scope, DEVOS-299) and "a
 * per-project subset picker" (DEVOS-300) are both real routes here — the
 * Project Members panel (`apps/web/src/features/projects/
 * ProjectDetailPage.tsx`) is this sprint's own single UI anchor for both,
 * since it is the one place individual principals already appear as
 * concrete rows; see `specs/sprints/sprint-49/DEVOS-301.md` for why no
 * separate organisation-wide job-role management page was built.
 */
export function createJobRoleRoutes(prefix: string, deps: JobRoleUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/job-roles`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const jobRoles = await listJobRolesForOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return jobRoles.map(toJobRoleDto);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/principals/:principalId/job-roles`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const jobRoles = await listPrincipalJobRoles(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          params.principalId!,
        );
        return jobRoles.map(toJobRoleDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/principals/:principalId/job-roles`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseJobRoleIdBody(body);
        const jobRole = await assignPrincipalJobRole(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          params.principalId!,
          input.jobRoleId,
        );
        return toJobRoleDto(jobRole);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/organisations/:organisationId/principals/:principalId/job-roles/:jobRoleId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await removePrincipalJobRole(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          params.principalId!,
          params.jobRoleId!,
        );
        return { removed: true };
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/job-roles`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const overview = await getProjectJobRolesOverview(
          deps,
          user.id,
          params.projectId as ProjectId,
        );
        return toProjectJobRolesOverviewDto(overview);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/members/:principalId/job-roles`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseJobRoleIdBody(body);
        const row = await assignProjectMemberJobRole(
          deps,
          user.id,
          params.projectId as ProjectId,
          params.principalId!,
          input.jobRoleId,
        );
        return toProjectMemberJobRoleDto(row);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/projects/:projectId/members/:principalId/job-roles/:jobRoleId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await removeProjectMemberJobRole(
          deps,
          user.id,
          params.projectId as ProjectId,
          params.principalId!,
          params.jobRoleId!,
        );
        return { removed: true };
      },
    },
  ];
}
