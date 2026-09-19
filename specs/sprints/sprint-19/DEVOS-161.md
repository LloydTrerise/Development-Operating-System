# DEVOS-161 — Real end-to-end pilot: multi-candidate selection

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** DEVOS-158, DEVOS-159, DEVOS-160 (exercises all three for real).
**Depended on by:** DEVOS-162 (validation summarizes this pilot's evidence).

## Scope

A real project gains a second real `Agent`/`AgentVersion` sharing an existing role with a different `allowedCapabilities` set — the first time any project in this codebase has had two agents for one role. A real workflow version is authored with one capability-based `AGENT_TASK` node (no literal `agentRef`) alongside one ordinary literal-`agentRef` node, published, and run for real.

## Implementation

- Against a real running `apps/api`/`apps/worker` and real Postgres: create a second real `Agent` in an existing seeded (or freshly created) project, same `role` as one of the six seeded agents (e.g. a second `DEVELOPMENT`-role agent) but a real, deliberately different `allowedCapabilities` set from the existing one — publish its version.
- Author a real `WorkflowDefinition`/draft `WorkflowVersion` with two `AGENT_TASK` nodes: one using `requiredRole`/`requiredCapabilities` matching only the new second agent's capability set (no `agentRef`), one using the existing literal `agentRef` pattern unchanged. Validate and publish.
- Start a real run. Confirm via direct Postgres query (not just the API) that the capability-based node's `AgentExecution`/task dispatched to the correct second agent's version, and the literal-`agentRef` node dispatched exactly as it always has.
- Clean up all test data afterward (project artifacts, agents/versions, workflow definition/version, run/tasks) — confirm 0 remaining rows, matching this codebase's own established pilot-cleanup convention.

## Out of scope

Any new seeded project type or permanent fixture — this is a live pilot against test data, cleaned up afterward, the same as DEVOS-100/108/126/137/148/157.

## Acceptance

The real run reaches `COMPLETED` (or the expected terminal state for its graph shape). The capability-based node's dispatch resolved to the new second agent, confirmed independently via Postgres, not just an API response. The literal-`agentRef` node's dispatch is provably unchanged. All test data cleaned up, confirmed 0 remaining rows.
