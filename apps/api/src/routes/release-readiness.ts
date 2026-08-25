import type { ProjectId } from '@devos/contracts';
import {
  getReleaseReadinessForProject,
  type ReleaseReadinessUseCaseDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-069: not a literal spec-documented path (no read-API contract for
 * "release readiness" exists anywhere), mirroring DEVOS-036/060's identical
 * `agent-execution-summaries`/`tool-invocation-summaries` precedent —
 * project-scoped rather than run-scoped, since the evaluator itself
 * resolves the project's latest test/review evidence, not a specific run's.
 */
export function createReleaseReadinessRoutes(
  prefix: string,
  deps: ReleaseReadinessUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/projects/:projectId/release-readiness`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getReleaseReadinessForProject(deps, user.id, params.projectId as ProjectId);
      },
    },
  ];
}
