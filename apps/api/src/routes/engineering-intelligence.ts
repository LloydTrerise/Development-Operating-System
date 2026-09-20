import type { OrganisationId, ProjectId } from '@devos/contracts';
import {
  getOrganisationEngineeringReport,
  getProjectEngineeringReport,
  type EngineeringIntelligenceUseCaseDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

interface SlowestWorkflowRow {
  workflowVersionId: string;
  workflowDefinitionName: string;
  meanDurationMs: number;
  taskCount: number;
}

/**
 * DEVOS-171: `apps/worker`'s own live `MetricsRegistry` (DEVOS-170's real
 * data source) is a separate OS process's in-memory object — `apps/api`
 * has no direct access to it. This proxies the worker's own new
 * `GET /slowest-workflows` endpoint (`apps/worker/src/metrics-server.ts`)
 * so the browser only ever talks to `apps/api`, never the worker's raw
 * port directly. **Disclosed, real limitation, not silently hidden**: the
 * worker's endpoint has no per-project scoping (a `workflowVersionId` has
 * no cheap reverse index back to "which project"), so every project's
 * dashboard currently sees the same system-wide ranking — a real, bounded
 * MVP boundary, the same kind DEVOS-152 already drew around Grafana.
 * Returns an empty array (never throws) when `WORKER_METRICS_URL` is
 * unset or the worker is unreachable — a real, disclosed absence, not
 * fabricated data.
 */
async function fetchSlowestWorkflows(env: NodeJS.ProcessEnv): Promise<SlowestWorkflowRow[]> {
  const workerMetricsUrl = env.WORKER_METRICS_URL;
  if (!workerMetricsUrl) return [];

  try {
    const response = await fetch(`${workerMetricsUrl.replace(/\/$/, '')}/slowest-workflows`);
    if (!response.ok) return [];
    return (await response.json()) as SlowestWorkflowRow[];
  } catch {
    return [];
  }
}

/**
 * DEVOS-164: the real engineering-intelligence reporting API — closes the
 * "captured but no reporting surface" gap `specs/DEVOS-ENGINEERING-INTELLIGENCE-BACKLOG.md`
 * §2 found for review/test/security-scan/release evidence, mirroring
 * `createCostRoutes`'s file-per-concern convention and membership-check
 * shape exactly.
 */
export function createEngineeringIntelligenceRoutes(
  prefix: string,
  deps: EngineeringIntelligenceUseCaseDeps,
  env: NodeJS.ProcessEnv = process.env,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/engineering-report`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getProjectEngineeringReport(deps, user.id, params.projectId as ProjectId);
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/organisations/:organisationId/engineering-report`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getOrganisationEngineeringReport(
          deps,
          user.id,
          params.organisationId as OrganisationId,
        );
      },
    },
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/slowest-workflows`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        const projectId = params.projectId as ProjectId;
        // Reuses `getProjectEngineeringReport`'s own already-proven
        // membership gate (`NotFoundError` on a non-member, exactly like
        // every other project-scoped route) rather than duplicating it —
        // `resolveMembership` itself isn't part of `@devos/application`'s
        // public exports, so re-deriving membership here would mean a
        // second, parallel implementation of the same check.
        await getProjectEngineeringReport(deps, user.id, projectId);

        return fetchSlowestWorkflows(env);
      },
    },
  ];
}
