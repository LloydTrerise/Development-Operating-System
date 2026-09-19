# DEVOS-152 — Cost dashboard UI

**Priority:** P1 | **Estimate:** 3d
**Depends on:** DEVOS-151 (the routes this renders).
**Depended on by:** DEVOS-156/DEVOS-157 (Sprint 18's attribution UI and pilot).

## Scope

A new "Cost" view renders real project and organisation totals, a real breakdown by agent role, and a real budget-vs-actual indicator against DEVOS-098's existing `Project.budgetUsd` — the first place a human can see rollup cost data anywhere in the product.

## Real design decision (recording the choice the backlog's own acceptance summary leaves open)

A new dedicated `CostPage.tsx`, not a `GovernancePage.tsx` section: cost is a distinct concern from governance/compliance, and keeping it a separate nav-reachable page keeps each page's own scope legible, matching how `RunsPage.tsx`/`WorkflowLibraryPage.tsx` are each their own page rather than sections of one mega-page.

## Implementation

- `apps/web/src/api-client.ts` gains `getProjectCostSummary(projectId)` / `getOrganisationCostReport(organisationId)`.
- New `apps/web/src/pages/CostPage.tsx`: uses the existing `ProjectProvider` context (the current project selector already shared across pages) to fetch and render that project's cost summary (total, role breakdown, budget-vs-actual bar/indicator if `budgetUsd` is set), plus the current project's organisation-level rollup.
- New nav entry alongside the existing Governance/Runs/etc. entries in the app shell.

## Out of scope

Historical trend charts / time-series cost graphs (not named in the backlog's own three-word scope — "attribution, optimisation" are Sprint 18/19, not visualization-over-time).

## Acceptance

Live-verified against a real running `apps/api`/`apps/web` and real Postgres: a real project with real completed agent executions shows a correct total and role breakdown; a real organisation with more than one such project shows a correct combined total; a project with a configured `budgetUsd` shows a correct budget-vs-actual indicator; a project with no cost data yet renders a sensible zero/empty state rather than an error.
