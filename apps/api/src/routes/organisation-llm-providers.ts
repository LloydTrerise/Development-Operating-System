import type { OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import {
  createOrganisationLlmProvider,
  deleteOrganisationLlmProvider,
  listOrganisationLlmProviders,
  reorderOrganisationLlmProviders,
  updateOrganisationLlmProvider,
  type OrganisationLlmProviderUseCaseDeps,
} from '@devos/application';
import {
  parseCreateOrganisationLlmProviderBody,
  parseReorderOrganisationLlmProvidersBody,
  parseUpdateOrganisationLlmProviderBody,
  toOrganisationLlmProviderDto,
} from '../dto/organisation-llm-provider.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-321 (Sprint 54, `specs/sprints/sprint-54/DEVOS-321.md`): the
 * "AI Providers" settings panel's own backend surface. Every write route
 * (`POST`/`PATCH`/`DELETE`/`reorder`) is gated by the use-case layer itself
 * (`resolveOrganisationAdminMembership`/`canUpdateOrganisation`, DEVOS-320)
 * — nothing here re-checks it.
 */
export function createOrganisationLlmProviderRoutes(
  prefix: string,
  deps: OrganisationLlmProviderUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/llm-providers`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const providers = await listOrganisationLlmProviders(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
        return providers.map(toOrganisationLlmProviderDto);
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/llm-providers`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseCreateOrganisationLlmProviderBody(body);
        const provider = await createOrganisationLlmProvider(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          input,
        );
        return toOrganisationLlmProviderDto(provider);
      },
    },
    {
      method: 'PATCH',
      pattern: `${prefix}/organisations/:organisationId/llm-providers/:providerId`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const changes = parseUpdateOrganisationLlmProviderBody(body);
        const provider = await updateOrganisationLlmProvider(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          params.providerId as OrganisationLlmProviderId,
          changes,
        );
        return toOrganisationLlmProviderDto(provider);
      },
    },
    {
      method: 'DELETE',
      pattern: `${prefix}/organisations/:organisationId/llm-providers/:providerId`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        await deleteOrganisationLlmProvider(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          params.providerId as OrganisationLlmProviderId,
        );
        return { removed: true };
      },
    },
    {
      method: 'POST',
      pattern: `${prefix}/organisations/:organisationId/llm-providers/reorder`,
      protected: true,
      handler: async ({ principal, params, body }) => {
        const user = requirePrincipal(principal);
        const input = parseReorderOrganisationLlmProvidersBody(body);
        await reorderOrganisationLlmProviders(
          deps,
          user.id,
          params.organisationId as OrganisationId,
          input.orderedIds as OrganisationLlmProviderId[],
        );
        return { reordered: true };
      },
    },
  ];
}
