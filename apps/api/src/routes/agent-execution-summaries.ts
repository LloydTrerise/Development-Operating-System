import type { WorkflowRunId } from '@devos/contracts';
import {
  getAgentExecutionSummariesForRun,
  type AgentExecutionSummaryUseCaseDeps,
} from '@devos/application';
import { requirePrincipal, type Route } from '../http/router.js';

/**
 * DEVOS-036: not a literal spec-documented path (specs/api/poc-api-
 * contracts.md §20 documents agent-scoped execution listing, not this
 * run-scoped shape) — a flagged assumption, added because the Agent
 * Execution UI needs exactly this per-task view and no other endpoint
 * provides it.
 */
export function createAgentExecutionSummaryRoutes(
  prefix: string,
  deps: AgentExecutionSummaryUseCaseDeps,
): Route[] {
  return [
    {
      method: 'GET',
      pattern: `${prefix}/runs/:runId/agent-execution-summaries`,
      protected: true,
      handler: async ({ principal, params }) => {
        const user = requirePrincipal(principal);
        return getAgentExecutionSummariesForRun(deps, user.id, params.runId as WorkflowRunId);
      },
    },
  ];
}
