import type { OrganisationId } from '@devos/contracts';
import {
  createOrganisation,
  getOrganisationForPrincipal,
  listOrganisationsForPrincipal,
  updateOrganisation,
  type OrganisationUseCaseDeps,
} from '@devos/application';
import {
  parseCreateOrganisationBody,
  parseUpdateOrganisationBody,
  toOrganisationDto,
} from '../dto/organisation.js';
import { requirePrincipal, type Route } from '../http/router.js';

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
  ];
}
