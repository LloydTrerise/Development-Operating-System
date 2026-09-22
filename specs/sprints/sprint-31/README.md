# Sprint 31 — Work Items & Runs: Restyle + Gap Closure

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.3 (E28 UI/UX Redesign & Full Functional Coverage, third sprint).
**Conversion date:** 2026-09-22
**Status:** Converted per explicit user authorization ("proceed. Run sprint 31 through without waiting for authorisation after each task. Stop when done with sprint and wait for further instructions", 2026-09-22). Depends on Sprint 29's theme/nav/`features/`/routing foundation (COMPLETE) — reuses `DetailPageLayout` and the `/{area}/:id` convention it scaffolded. Has no dependency on Sprint 30.

## Goal

Restyle the Work Items and Runs pages to the Nocturne mockup's own layout language, and close the two real functional gaps the backlog names for this sprint: a real work-item detail/edit view, and run-scoped approval visibility.

## Grounding (confirmed by direct code inspection before scoping)

- **The backlog's own framing of DEVOS-213/DEVOS-215 as backend gaps is corrected by direct inspection**: both backend routes already exist and are already tested at the application layer.
  - `GET /work-items/:workItemId` and `PATCH /work-items/:workItemId` (`apps/api/src/routes/work-items.ts:49-78`) are real, already route-tested (`apps/api/tests/app.test.ts:1132-1161`), and already documented in `specs/api/poc-api-contracts.md:250-255`. `UpdateWorkItemBody` (`apps/api/src/dto/work-item.ts:78-84`) accepts `title`/`description`/`status`/`priority`/`metadata`.
  - `GET /runs/:runId/approvals` (`apps/api/src/routes/approvals.ts:49-58`, → `listApprovalsForRun`) is real and already unit-tested at the application layer (`packages/application/tests/approvals.test.ts:447,456`) — but has **no route-level HTTP test** and **no frontend client wrapper**.
  - The real gap in both cases is entirely on the frontend: `apps/web/src/api-client.ts` has no `getWorkItem`/`updateWorkItem`/`listApprovalsForRun` wrapper, `WorkItemDetailPage.tsx` is still Sprint 29's routing scaffold (its own doc comment names this sprint as the one that replaces it), and `RunsPage.tsx` shows no approval information at all. This sprint's DEVOS-213/DEVOS-215 are scoped as **frontend + client-wrapper + route-level-test** work, not new backend routes or use cases.
- **`WorkItemStatus`/`WorkItemPriority` remain open-ended strings**, not closed enums (`packages/contracts/src/status.ts:79`, unchanged since Sprint 30's own grounding). DEVOS-212's filter chips are therefore derived from the distinct status values actually present in the loaded data, not a hardcoded enum; DEVOS-213's edit form uses plain text fields for status/priority, not a dropdown — the same open-ended-string handling already established, not a new decision.
- **No per-work-item or per-run "stage" concept exists** beyond a run's own ordered task list (`WorkflowTask.nodeId`/`status`) — there is no separate stage/milestone entity. DEVOS-212's mockup-inspired "stage-progress bar" per work-item row would require an N+1 fan-out (fetch each work item's latest run, then that run's tasks) across a table that can hold hundreds of rows (552 real seeded work items, confirmed by Sprint 30's own real dev-server check) — the same disproportionate-cost reasoning Sprint 30's own `DEVOS-211.md` already used to omit a per-run stage bar on Home's Active Work list. This sprint applies the same reasoning and omits a per-row stage bar from the Work Items table; DEVOS-214's Runs restyle instead visualizes the one real per-run stage-like sequence that already exists — the run's own ordered task list — as a horizontal pipeline header, which is real data, not fabricated.
- **`RunsPage.tsx`'s pre-existing "no historical runs list" limitation, flagged by Sprint 30's own `DEVOS-211.md` (its Gaps section, last bullet) as deferred to this sprint, is re-confirmed unchanged**: the page shows only runs started in the current browser session (`runs` state) plus, since DEVOS-080, a per-selected-work-item historical timeline (`listWorkflowRunsForWorkItem`) — there is still no project-wide "list all runs" route. Per this epic's own Delivery Principle (backlog §3: no net-new backend route without a net-new-UI story naming it), and because DEVOS-214's own acceptance text scopes it to "existing real data/logic" restyle, this sprint does **not** add a new project-wide runs-listing route — it restyles what already exists (session-started runs, per-work-item timeline) and leaves the project-wide gap open, disclosed again here rather than silently re-deferred.
- **"Linking to the full Approval detail" (DEVOS-215's own acceptance text) has no literal target to link to** — no per-approval detail route/component exists anywhere in this app (`App.tsx` has no `/approvals/:id` route; `ApprovalsPage.tsx`/`GovernancePage.tsx` are both list-only). Sprint 29's own `DEVOS-206.md` explicitly deferred per-approval detail views to a later sprint, not this one. This sprint therefore does not invent a new `/approvals/:id` detail route (that would be scope beyond "restyle + close two gaps"); instead, `ApprovalsPage.tsx` gains a real `?approvalId=` query-parameter handler (scroll-to and highlight a specific approval already present in its existing Pending/Decided lists), and the Runs page links to that — a real, working, single-navigation path to the fullest approval detail this app has today, without fabricating a route that doesn't exist.
- `DetailPageLayout` (`apps/web/src/components/DetailPageLayout.tsx`, Sprint 29's DEVOS-206) takes `{ title, backTo, children }` — reused unchanged for the real work-item detail/edit view.

## In scope

- **DEVOS-212** — Work Items restyle: dense table (title/id, type, status, priority, updated), status filter chips derived from real data, row click navigates to the real detail view.
- **DEVOS-213** — Work item detail & edit: `getWorkItem`/`updateWorkItem` client wrappers; `WorkItemDetailPage.tsx` replaced with a real fetch + edit form (title, description, status, priority) using the already-existing, already-tested `PATCH` route.
- **DEVOS-214** — Runs restyle: a real per-run pipeline header (from the run's own ordered task list), a master/detail task view (task list + selected-task detail pane) replacing the flat inline list, split into `features/runs/` sub-components; existing Artifacts/Test evidence/Review evidence/Release readiness sections preserved.
- **DEVOS-215** — Run-scoped approval visibility: `listApprovalsForRun` client wrapper; each `RunCard` fetches and shows its own run's approval(s) directly, with a link to `ApprovalsPage.tsx`'s new `?approvalId=` highlight.
- **DEVOS-216** — Cross-check existing e2e/UI coverage: re-run the full real `tests/e2e` suite and `apps/api`/`apps/web` test suites; add the missing route-level test for `GET /runs/:runId/approvals` found during this sprint's own grounding; update any assertion this sprint's markup changes break.
- **DEVOS-217** — Validation, documentation, and gap disclosure.

## Out of scope

Any new backend route or use case (both named gaps resolve to already-existing backend code, per grounding above). A project-wide "list all runs for this project" route (a real, separately-scoped gap, re-disclosed, not fixed). A new `/approvals/:id` detail route (deferred, not this sprint's scope). A closed status/priority enum for work items (none is specified anywhere). A per-work-item stage-progress bar (disproportionate N+1 cost, same reasoning as Sprint 30's Active Work omission).

## Task index

| ID        | Story                                    | File           |
| --------- | ----------------------------------------- | -------------- |
| DEVOS-212 | Work Items restyle                         | `DEVOS-212.md` |
| DEVOS-213 | Work item detail & edit                    | `DEVOS-213.md` |
| DEVOS-214 | Runs restyle                               | `DEVOS-214.md` |
| DEVOS-215 | Run-scoped approval visibility             | `DEVOS-215.md` |
| DEVOS-216 | Cross-check existing e2e/UI coverage       | `DEVOS-216.md` |
| DEVOS-217 | Validation, documentation, and gap disclosure | `DEVOS-217.md` |
