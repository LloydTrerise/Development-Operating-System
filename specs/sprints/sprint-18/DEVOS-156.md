# DEVOS-156 — Attribution by workflow and work item

**Priority:** P1 | **Estimate:** 2d
**Depends on:** DEVOS-150 (breakdown query pattern), DEVOS-152 (`CostPage.tsx`, the UI this extends).
**Depended on by:** DEVOS-157 (pilot, dashboard verification).

## Scope

DEVOS-150's breakdown query and DEVOS-152's dashboard both gain a further grouping by workflow definition and work item (not only agent role), so a real user can see which workflow type or which piece of work is actually expensive.

## Implementation

- `costBreakdownByWorkflowForProject?(projectId)` / `costBreakdownByWorkItemForProject?(projectId)` (and organisation equivalents) on `AgentExecutionRepository`, joining `agent_executions` → `workflow_tasks` → `workflow_runs` → (`workflow_versions` → `workflow_definitions` for workflow name) / (`work_items` for work-item title), grouped and summed the same way DEVOS-150's by-role breakdown already is.
- New route fields or a `?groupBy=workflow|workItem` query parameter on the existing `GET /projects/:projectId/cost` route (extending, not duplicating, DEVOS-151's route) — recorded as the chosen shape during implementation.
- `CostPage.tsx` gains a breakdown-dimension selector (role / workflow / work item) over the same fetched data.

## Out of scope

Attribution by individual agent version (role is the finest existing grouping precedent; per-version would require a new join with no named acceptance criterion).

## Acceptance

A real project with completed executions across at least two different workflow definitions and two different work items shows a correct breakdown by each dimension, verified against real Postgres; switching the dashboard's breakdown selector renders the correct grouped totals for each dimension.
