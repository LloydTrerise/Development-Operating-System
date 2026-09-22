import type { ProjectId } from '@devos/contracts';
import { getProjectSystemHealth, type SystemHealthUseCaseDeps } from '@devos/application';
import type { DatabaseClient } from '@devos/database';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-258: a new, separate, authenticated, project-scoped route — the
 * existing unauthenticated `GET /health` (`routes/health.ts`) is left
 * completely unmodified. Composes `getProjectSystemHealth`'s real
 * integration/capability counts with the same `database.checkHealth()`
 * call `createHealthRoutes` already makes, at the route layer, so the
 * application-layer use case stays free of any `DatabaseClient` dependency.
 */
export function createSystemHealthRoutes(
  prefix: string,
  deps: SystemHealthUseCaseDeps,
  database: DatabaseClient,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/system-health`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const [health, databaseHealthy] = await Promise.all([
          getProjectSystemHealth(deps, user.id, params.projectId as ProjectId),
          database.checkHealth(),
        ]);
        return { ...health, database: databaseHealthy ? 'ok' : 'error' };
      },
    },
  ];
}
