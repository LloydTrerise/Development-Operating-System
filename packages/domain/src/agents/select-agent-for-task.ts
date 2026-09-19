import type { Agent } from './agent.js';
import type { AgentVersion } from './agent-version.js';

export interface AgentSelectionCandidate {
  agent: Agent;
  version: AgentVersion;
}

/**
 * DEVOS-159: resolves a role/capability requirement (declared on a
 * `WorkflowNode` via `requiredRole`/`requiredCapabilities`, DEVOS-158) to one
 * real candidate agent — the mechanism `apps/worker/src/agent-task-router.ts`
 * lacked entirely before this task (see
 * specs/DEVOS-AGENT-SELECTION-BACKLOG.md §1/§2). A pure function, mirroring
 * `computeExecutionPaths`/`diffWorkflowVersions`'s own established
 * pure-function-in-`@devos/domain` pattern — the router supplies the real
 * candidate list (every agent in the run's own project) and applies the
 * result.
 *
 * Tie-break is deliberately simple and disclosed, not a scoring system: the
 * lowest `agent.key`, ascending. No cost/quality/performance preference is
 * considered — no such data exists yet (specs/DEVOS-COST-MANAGEMENT-BACKLOG.md
 * §2/§9), so there is nothing real to weigh.
 */
export function selectAgentForTask(
  candidates: AgentSelectionCandidate[],
  requiredRole: string,
  requiredCapabilities: string[],
): AgentSelectionCandidate | null {
  const matches = candidates.filter(
    ({ version }) =>
      version.status === 'PUBLISHED' &&
      version.configuration.role === requiredRole &&
      requiredCapabilities.every((capability) =>
        version.configuration.allowedCapabilities.includes(capability),
      ),
  );

  if (matches.length === 0) return null;

  return matches.reduce((best, candidate) =>
    candidate.agent.key < best.agent.key ? candidate : best,
  );
}
