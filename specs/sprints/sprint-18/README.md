# Sprint 18 — Budget Controls & Attribution (E23 Cost Management, part 2)

**Source:** `specs/DEVOS-COST-MANAGEMENT-BACKLOG.md` §6 "Sprint 18 — Budget Controls & Attribution", grounded against direct inspection of the real, current implementation (`packages/application/src/tasks/run-agent-task.ts`'s `maybeAlertOnBudgetExceeded`, `packages/domain/src/projects/project.ts`, `packages/domain/src/organisations/organisation.ts`, Sprint 17's own new `sumEstimatedCostUsdForOrganisation`/breakdown queries and `apps/web/src/pages/CostPage.tsx`, and Sprint 16's existing `GovernancePage.tsx` compliance export).
**Conversion date:** 2026-09-19
**Status:** Approved to begin (standing authorization for DEVOS-149 → DEVOS-157, this run).

## Goal

Sprint 17 made cost data visible. This sprint closes the remaining two-thirds of the source backlog's own three-word E23 scope — "budgets" and "attribution" — turning the single one-time per-project alert into a real, tiered, organisation-aware mechanism, and turning the role-only breakdown into a real workflow/work-item attribution view, then proves all of it with a real pilot.

## Grounding (confirmed by direct code inspection before scoping)

- `maybeAlertOnBudgetExceeded` (`packages/application/src/tasks/run-agent-task.ts`) fires exactly one `project.budget_exceeded` audit record the first time accumulated cost crosses `Project.budgetUsd`, and never again for that project (the `previousTotalCostUsd > project.budgetUsd` guard makes every subsequent crossing a no-op). There is no warning tier, and no organisation-level equivalent at all — `Organisation` (`packages/domain/src/organisations/organisation.ts`) has no `budgetUsd` field.
- Sprint 17's `sumEstimatedCostUsdForOrganisation` is the real precondition DEVOS-155 needs and did not exist before this epic — confirmed now real and available.
- `workflow_tasks`/`workflow_runs` already carry the graph/run identity every execution's cost is already transitively joined through (the same chain `sumEstimatedCostUsdForProject`/DEVOS-150's queries already walk) — attribution by workflow definition and work item is a real extension of an existing join, not new plumbing. `WorkflowRun.workItemId`/`WorkflowTask`'s own `workflowDefinitionId` linkage (via `workflow_versions`) already exist in the schema.
- `GovernancePage.tsx`'s compliance export (DEVOS-147) is the direct, already-real CSV-export precedent DEVOS-157's pilot verification reuses, not a new export mechanism.

## Real design decisions this sprint's own grounding surfaced (recorded here, not silently assumed)

1. **Tiered, recurring alerts (DEVOS-154):** `maybeAlertOnBudgetExceeded` is generalized to accept a list of threshold tiers (e.g. a "warning" tier at a configurable fraction below 100%, and the existing hard-crossing tier at 100%), each firing its own distinct `project.budget_warning` / `project.budget_exceeded` audit record exactly once per crossing (mirrored guard logic per tier: a tier fires only when the pre-completion total was still under that tier's own threshold). Still audit-only — no automatic cutoff, unchanged from DEVOS-098's own explicit design choice. The warning fraction is a disclosed, approximate default (e.g. 80%) since no spec states one.
2. **Organisation-level budget (DEVOS-155):** `Organisation` gains an optional `budgetUsd` (new nullable column, mirroring `Project.budgetUsd`'s own migration/domain/repository pattern exactly). A new `maybeAlertOnOrganisationBudgetExceeded` reuses the same tiered mechanism as DEVOS-154, checked against Sprint 17's real `sumEstimatedCostUsdForOrganisation`, called from the same point `maybeAlertOnBudgetExceeded` already is (after a completed execution's cost is recorded) — a project-level check and an organisation-level check both run per completion, independently.
3. **Attribution by workflow and work item (DEVOS-156):** DEVOS-150's breakdown queries gain a further grouping dimension — `costBreakdownByWorkflowForProject`/`costBreakdownByWorkItemForProject` (and organisation equivalents), joining the same existing `workflow_tasks` → `workflow_runs` chain one step further to `workflow_runs.workflow_version_id` (→ `workflow_versions.workflow_definition_id`) and `workflow_runs.work_item_id`. `CostPage.tsx` gains a second breakdown view (by workflow definition, by work item) alongside Sprint 17's existing by-role view.
4. **Real end-to-end pilot (DEVOS-157):** a real organisation with two real projects genuinely crosses a real warning threshold and then a real hard project-level threshold, using either real Gemini executions or (if the live-provider quota constraint recurs, as it has before — DEVOS-113/DEVOS-089's own disclosed precedent) the existing deterministic `FixtureModelAdapter`, disclosed exactly like DEVOS-089's own precedent. Both alerts are confirmed in `CostPage.tsx` and in the existing compliance export (DEVOS-147, unmodified).

## In scope (DEVOS-154–157, executed in ID order)

- **DEVOS-154** — tiered, recurring budget alerts.
- **DEVOS-155** — organisation-level budget.
- **DEVOS-156** — attribution by workflow and work item.
- **DEVOS-157** — real end-to-end pilot: multi-tier budgets, org rollup, dashboard, compliance export.

## Out of scope / deferred

Automatic spend cutoff/throttling (alert-only remains the model, unchanged from DEVOS-098). Tool-invocation cost tracking and cost-aware agent selection (both deferred to the proposed, not-yet-scoped Sprint 19). Any part of E24–E27.

## Sprint-wide acceptance criteria (from the backlog's own exit criteria)

The source backlog's own three-word E23 scope — "budgets, attribution, optimisation" — has real, live-verified evidence for the first two; optimisation (model routing, cost-aware agent selection) stays explicitly deferred to Sprint 19.

## Governance

Per `AGENTS.md` §4 and this run's standing authorization: proceeding through DEVOS-149 → DEVOS-157 without per-task pauses. Decisions recorded directly in `DEVOS-BUILD-STATE.md`'s state-change-log as each task completes.

## Task index

| ID        | Story                                                                               | File           |
| --------- | ----------------------------------------------------------------------------------- | -------------- |
| DEVOS-154 | Tiered, recurring budget alerts                                                     | `DEVOS-154.md` |
| DEVOS-155 | Organisation-level budget                                                           | `DEVOS-155.md` |
| DEVOS-156 | Attribution by workflow and work item                                               | `DEVOS-156.md` |
| DEVOS-157 | Real end-to-end pilot: multi-tier budgets, org rollup, dashboard, compliance export | `DEVOS-157.md` |
