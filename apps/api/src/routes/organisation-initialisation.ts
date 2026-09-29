import type { OrganisationId } from '@devos/contracts';
import {
  getOrganisationInitialisationStatus,
  type OrganisationInitialisationStatusDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-334 (Sprint 58, `specs/sprints/sprint-58/DEVOS-334.md`): a single,
 * read-only route — authorization (any member of the organisation) lives in
 * the use case itself, not here, mirroring `platform-operators.ts`'s own
 * established "authorization lives in the use case" convention. Introduces
 * no enforcement against any mutating route (Sprint 59's own scope).
 */
export function createOrganisationInitialisationRoutes(
  prefix: string,
  deps: OrganisationInitialisationStatusDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/initialisation-status`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getOrganisationInitialisationStatus(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
      },
    },
  ];
}
