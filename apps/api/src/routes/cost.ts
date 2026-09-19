import type { OrganisationId, ProjectId } from '@devos/contracts';
import {
  getOrganisationCostReport,
  getProjectCostSummary,
  type CostUseCaseDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-151: the real cost API surface — today's only cost data
 * (`sumEstimatedCostUsdForProject`, DEVOS-098) was unreachable from any
 * client. Mirrors `createAuditRoutes`'s file-per-concern convention and
 * membership-check shape exactly.
 */
export function createCostRoutes(prefix: string, deps: CostUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/cost`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getProjectCostSummary(deps, user.id, params.projectId as ProjectId);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/cost-report`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getOrganisationCostReport(deps, user.id, params.organisationId as OrganisationId);
      },
    },
  ];
}
