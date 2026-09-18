import type { OrganisationId, ProjectId, ProjectTypeId } from '@devos/contracts';
import {
  addMember,
  changeMemberRole,
  createProject,
  getProjectForPrincipal,
  listMembers,
  listProjectsForPrincipal,
  removeMember,
  updateProject,
  NotFoundError as UseCaseNotFoundError,
  type ProjectUseCaseDeps,
} from '@devos/application';
import { SEED_ORGANISATION_ID } from '@devos/database';
import {
  parseAddMemberBody,
  parseCreateProjectBody,
  parseRoleBody,
  parseUpdateProjectBody,
  toMembershipDto,
  toProjectDto,
} from '../dto/project.js';
import { requirePrincipal, type Route } from '../http/router.js';

async function requireMembershipByPrincipal(
  deps: ProjectUseCaseDeps,
  projectId: ProjectId,
  principalId: string,
) {
  const membership = await deps.memberships.getForPrincipalAndProject(principalId, projectId);
  if (!membership) throw new UseCaseNotFoundError('Membership');
  return membership;
}

export function createProjectRoutes(prefix: string, deps: ProjectUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const projects = await listProjectsForPrincipal(deps, user.id);
        return projects.map(toProjectDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects`,
      protected: true,
      handler: async ({ principal, body }) => {
        const user = requirePrincipal(principal);
        const { organisationId, projectTypeId, ...input } = parseCreateProjectBody(body);
        const project = await createProject(deps, user.id, {
          organisationId: (organisationId ?? SEED_ORGANISATION_ID) as OrganisationId,
          ...(projectTypeId !== undefined ? { projectTypeId: projectTypeId as ProjectTypeId } : {}),
          ...input,
        });
        return toProjectDto(project);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const project = await getProjectForPrincipal(deps, user.id, params.projectId as ProjectId);
        return toProjectDto(project);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/projects/:projectId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const changes = parseUpdateProjectBody(body);
        const project = await updateProject(deps, user.id, params.projectId as ProjectId, changes);
        return toProjectDto(project);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/members`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const members = await listMembers(deps, user.id, params.projectId as ProjectId);
        return members.map(toMembershipDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/projects/:projectId/members`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseAddMemberBody(body);
        const membership = await addMember(deps, user.id, params.projectId as ProjectId, {
          principalId: input.userId,
          role: input.role,
        });
        return toMembershipDto(membership);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/projects/:projectId/members/:userId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const role = parseRoleBody(body);
        const projectId = params.projectId as ProjectId;
        const target = await requireMembershipByPrincipal(deps, projectId, params.userId!);
        const membership = await changeMemberRole(deps, user.id, projectId, target.id, role);
        return toMembershipDto(membership);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/projects/:projectId/members/:userId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const projectId = params.projectId as ProjectId;
        const target = await requireMembershipByPrincipal(deps, projectId, params.userId!);
        await removeMember(deps, user.id, projectId, target.id);
        return { removed: true };
      },
    },
  ];
}
