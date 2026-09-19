# DEVOS-150 — Organisation-level and breakdown cost queries

**Priority:** P0 | **Estimate:** 3d
**Depends on:** DEVOS-098 (`sumEstimatedCostUsdForProject`, already real); DEVOS-149 (per-model `estimated_cost_usd` values feeding these sums).
**Depended on by:** DEVOS-151 (routes), DEVOS-155/DEVOS-157 (Sprint 18's organisation budget/pilot).

## Scope

`AgentExecutionRepository` gains `sumEstimatedCostUsdForOrganisation` (joining `agent_executions` → `workflow_tasks` → `workflow_runs` → `projects`, one join further than `sumEstimatedCostUsdForProject` already walks, to `projects.organisation_id`) and a real cost-breakdown query grouped by project and by agent role.

## Real design decision (resolving the backlog's own §7 flagged open question)

Built as a real SQL join (mirroring `AuditRecordRepository.listForOrganisation`'s own already-proven precedent), not a client-side loop calling `sumEstimatedCostUsdForProject` once per project — consistent with DEVOS-147's established organisation-query pattern.

## Implementation

- `sumEstimatedCostUsdForOrganisation?: (organisationId: OrganisationId) => Promise<number>` — optional, same additive precedent as `sumEstimatedCostUsdForProject`, on `AgentExecutionRepository` (`packages/domain/src/agents/agent-execution.ts`).
- `costBreakdownByRoleForProject?: (projectId: ProjectId) => Promise<{ role: string; totalUsd: number }[]>` and `costBreakdownByRoleForOrganisation?: (organisationId: OrganisationId) => Promise<{ role: string; totalUsd: number }[]>` — real queries joining through to `agent_versions`/`agents` for `role` (mirroring how role is already resolved by the agent-selection code elsewhere in this codebase), grouped by role, summing `estimated_cost_usd`.
- Real Postgres implementations in `packages/database/src/repositories/agent-executions.ts`; no change to any existing method signature.

## Out of scope

Cross-_organisation_ aggregation (tenant isolation, ADR-SEC-005). Breakdown by workflow/work item (Sprint 18's DEVOS-156).

## Acceptance

A real organisation with at least two real projects, each with real completed agent executions carrying real `estimated_cost_usd`, produces a correct combined total via `sumEstimatedCostUsdForOrganisation` and a correct per-role breakdown via both new breakdown methods — proven with a real Postgres integration test (mirroring `agent-executions`' own existing `sumEstimatedCostUsdForProject` test pattern) and, where reasonably isolable, a unit test of the grouping logic.
