# DEVOS-159 — Real capability-based selection algorithm

**Priority:** P0 | **Estimate:** 2.5d
**Depends on:** DEVOS-158 (`requiredRole`/`requiredCapabilities` fields must exist first).
**Depended on by:** DEVOS-160 (inspector targets this), DEVOS-161 (pilot exercises this), DEVOS-162 (validation).

## Scope

A new, pure `selectAgentForTask` function resolves a `(requiredRole, requiredCapabilities)` pair against a project's real candidate agents, deterministically. `run-creation.ts` folds the new node fields into task input. `routeAgentTask` gains the new resolution path, only used when `agentRef` is absent.

## Implementation

- `packages/domain/src/agents/select-agent-for-task.ts` (new, mirroring `computeExecutionPaths`/`diffWorkflowVersions`'s established pure-function-in-`@devos/domain` pattern): `selectAgentForTask(candidates: { agent: Agent; version: AgentVersion }[], requiredRole: string, requiredCapabilities: string[]): { agent: Agent; version: AgentVersion } | null`. Filters to `version.status === 'PUBLISHED' && version.configuration.role === requiredRole && requiredCapabilities.every(c => version.configuration.allowedCapabilities.includes(c))`, then sorts by `agent.key` ascending and returns the first, or `null` if none match.
- `apps/worker/src/agent-task-router.ts`: `routeAgentTask` first checks `task.input.agentRef` (existing path, unchanged). When absent, reads `task.input.requiredRole`/`task.input.requiredCapabilities`, calls `deps.agents.listForProject(run.projectId)` + `deps.agentVersions.listForAgent` per candidate to build the candidate list, calls `selectAgentForTask`, and on a match dispatches through the existing `ROLE_HANDLERS` table exactly as the `agentRef` path already does. No match, or neither `agentRef` nor `requiredRole` present, throws a clear error mirroring the existing `agentRef`-not-found message style.
- `packages/application/src/workflows/run-creation.ts`: fold `node.requiredRole`/`node.requiredCapabilities` into `WorkflowTask.input` alongside the existing `agentRef` fold, using the same `!== undefined` conditional-spread pattern already used for `agentRef`/`correlationId`/`dependsOn`.

## Out of scope

Any cost/quality/performance weighting in the sort — `agent.key` ascending is the entire rule. Caching or memoizing the candidate list across tasks in the same run.

## Acceptance

Unit tests for `selectAgentForTask`: correct pick among multiple matching candidates (lowest key wins); correctly excludes a non-`PUBLISHED` version; correctly excludes a role mismatch; correctly excludes a candidate missing one required capability; returns `null` for no match. `routeAgentTask` test: a task with `agentRef` set resolves exactly as before (regression); a task with `requiredRole` set and one real matching candidate in a fake project resolves and dispatches to the correct handler; a task with `requiredRole` set and zero matching candidates throws a clear error. Every existing `run-agent-task.test.ts`/router-adjacent test passes unmodified.
