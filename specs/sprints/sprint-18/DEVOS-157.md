# DEVOS-157 — Real end-to-end pilot: multi-tier budgets, org rollup, dashboard, compliance export

**Priority:** P0 | **Estimate:** 2d
**Depends on:** DEVOS-149–156 (everything this epic built).

## Scope

A real organisation with two real projects genuinely crosses a real warning threshold and then a real hard project-level threshold under real (or, if a live-provider quota constraint recurs, the existing deterministic fixture adapter, disclosed exactly like DEVOS-089's own precedent) executions; both real alerts appear correctly in `CostPage.tsx` and in the existing compliance export.

## Implementation

- Seed/create a real organisation with two real projects, each with a configured `budgetUsd`, and an organisation-level `budgetUsd`.
- Drive enough real agent executions (via the real running `apps/worker`/`apps/api`, using the Gemini adapter if quota allows, else the `FixtureModelAdapter` with a disclosed note) to cross: one project's warning tier, then that same project's hard tier, and the organisation's own rollup threshold.
- Confirm via direct Postgres query: correct `agent_executions.estimated_cost_usd` values, correct `project.budget_warning`/`project.budget_exceeded`/`organisation.budget_warning`/`organisation.budget_exceeded` audit records.
- Confirm via the real API/UI: `CostPage.tsx` shows the correct totals/breakdowns/budget-vs-actual state for both projects and the organisation; `GovernancePage.tsx`'s existing compliance export includes the new budget audit records when filtered appropriately.
- Clean up all test data afterward, confirmed via a direct Postgres query (0 remaining rows), matching this codebase's own established pilot-cleanup convention.

## Acceptance

All of the above confirmed with real evidence, not simulated; any gap found during the pilot recorded in `DEVOS-BUILD-STATE.md`'s state-change-log rather than silently patched. Full monorepo `pnpm turbo run typecheck lint test build` green, plus the full real `tests/e2e` suite unaffected.
