import type { ProjectId } from '@devos/contracts';
import { searchProject, type SearchUseCaseDeps } from '@devos/application';
import { toProjectSearchResultsDto } from '../dto/search.js';
import { BadRequestError } from '../http/errors.js';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-262: a new, project-scoped, authenticated cross-entity search route
 * — mirrors `routes/system-health.ts`'s own minimal single-route shape.
 */
export function createSearchRoutes(prefix: string, deps: SearchUseCaseDeps): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/search`,
      protected: true,
      handler: async ({ principal, params, query }) => {
        const user = requirePrincipal(principal);
        const q = query.q;
        if (typeof q !== 'string' || q.trim().length === 0) {
          throw new BadRequestError('q query parameter is required.');
        }
        const results = await searchProject(deps, user.id, params.projectId as ProjectId, q);
        return toProjectSearchResultsDto(results);
      },
    },
  ];
}
