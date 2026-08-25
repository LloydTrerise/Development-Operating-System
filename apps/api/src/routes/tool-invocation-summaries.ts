import type { WorkflowRunId } from '@devos/contracts';
import {
  getToolInvocationSummariesForRun,
  type ToolInvocationSummaryUseCaseDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-060: not a literal spec-documented path (no read-API contract for
 * "development UI" evidence exists anywhere), mirroring DEVOS-036's
 * identical `agent-execution-summaries` route precedent — added because
 * the Development UI needs exactly this run-scoped view and no other
 * endpoint provides it.
 */
export function createToolInvocationSummaryRoutes(
  prefix: string,
  deps: ToolInvocationSummaryUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/runs/:runId/tool-invocation-summaries`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getToolInvocationSummariesForRun(deps, user.id, params.runId as WorkflowRunId);
      },
    },
  ];
}
