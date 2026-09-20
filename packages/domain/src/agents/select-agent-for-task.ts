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
 * lowest `agent.key`, ascending — unchanged, and reproduced byte-for-byte
 * when `qualityByAgentVersionId` (DEVOS-179, Sprint 23) is omitted or has no
 * data for either candidate being compared.
 *
 * DEVOS-179: an optional second sort key — a real per-agent-version review
 * pass rate (E25's own `computeAgentVersionQuality`, DEVOS-174) — applied
 * *only* when both candidates being compared have a real, known rate; a
 * candidate with no known rate is never numerically compared against one
 * that does (never "penalized below a real 0%"), it simply falls straight
 * through to the same ascending-key rule as today. This is one disclosed,
 * deterministic secondary sort key, not a configurable weighted-scoring
 * system.
 */
export function selectAgentForTask(
  candidates: AgentSelectionCandidate[],
  requiredRole: string,
  requiredCapabilities: string[],
  qualityByAgentVersionId?: Map<string, number>,
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

  const sorted = [...matches].sort((a, b) => {
    const rateA = qualityByAgentVersionId?.get(a.version.id);
    const rateB = qualityByAgentVersionId?.get(b.version.id);
    if (rateA !== undefined && rateB !== undefined && rateA !== rateB) {
      return rateB - rateA;
    }
    if (a.agent.key < b.agent.key) return -1;
    if (a.agent.key > b.agent.key) return 1;
    return 0;
  });

  return sorted[0]!;
}
