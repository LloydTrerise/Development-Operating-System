import type { OrganisationId } from '@devos/contracts';
import {
  addOrganisationMember,
  changeOrganisationMemberRole,
  createOrganisation,
  getOrganisationForPrincipal,
  listOrganisationMembers,
  listOrganisationsForPrincipal,
  removeOrganisationMember,
  transferOrganisationOwnership,
  updateOrganisation,
  NotFoundError as UseCaseNotFoundError,
  type OrganisationUseCaseDeps,
} from '@devos/application';
import { parseAddMemberBody, parseRoleBody, toMembershipDto } from '../dto/project.js';
import {
  parseCreateOrganisationBody,
  parseTransferOwnershipBody,
  parseUpdateOrganisationBody,
  toOrganisationDto,
} from '../dto/organisation.js';
import { requirePrincipal, type Route } from '../http/router.js';

async function requireOrganisationMembershipByPrincipal(
  deps: OrganisationUseCaseDeps,
  organisationId: OrganisationId,
  principalId: string,
) {
  const membership = ((await deps.memberships.listForOrganisation?.(organisationId)) ?? []).find(
    (candidate) => candidate.principalId === principalId,
  );
  if (!membership) throw new UseCaseNotFoundError('Membership');
  return membership;
}

export function createOrganisationRoutes(prefix: string, deps: OrganisationUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations`,
      protected: true,
      handler: async ({ principal }) => {
        const user = requirePrincipal(principal);
        const organisations = await listOrganisationsForPrincipal(deps, user.id);
        return organisations.map(toOrganisationDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations`,
      protected: true,
      handler: async ({ principal, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateOrganisationBody(body);
        const organisation = await createOrganisation(deps, user.id, input);
        return toOrganisationDto(organisation);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const organisation = await getOrganisationForPrincipal(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return toOrganisationDto(organisation);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/organisations/:organisationId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const changes = parseUpdateOrganisationBody(body);
        const organisation = await updateOrganisation(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          changes,
        );
        return toOrganisationDto(organisation);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/members`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const members = await listOrganisationMembers(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return members.map(toMembershipDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/members`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseAddMemberBody(body);
        const membership = await addOrganisationMember(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          { principalId: input.userId, role: input.role },
        );
        return toMembershipDto(membership);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/organisations/:organisationId/members/:userId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const role = parseRoleBody(body);
        const organisationId = params.organisationId as OrganisationId;
        const target = await requireOrganisationMembershipByPrincipal(
          deps,
          organisationId,
          params.userId!,
        );
        const membership = await changeOrganisationMemberRole(
          deps,
          user.id,
          organisationId,
          target.id,
          role,
        );
        return toMembershipDto(membership);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/transfer-ownership`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseTransferOwnershipBody(body);
        const organisation = await transferOrganisationOwnership(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          input.principalId,
        );
        return toOrganisationDto(organisation);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/organisations/:organisationId/members/:userId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const organisationId = params.organisationId as OrganisationId;
        const target = await requireOrganisationMembershipByPrincipal(
          deps,
          organisationId,
          params.userId!,
        );
        await removeOrganisationMember(deps, user.id, organisationId, target.id);
        return { removed: true };
      },
    },
  ];
}
