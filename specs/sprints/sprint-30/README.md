# Sprint 30 — Home Dashboard (net-new)

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.2 (E28 UI/UX Redesign & Full Functional Coverage, second sprint).
**Conversion date:** 2026-09-22
**Status:** Converted per explicit user authorization ("proceed with Sprint 30. Run through the whole sprint and stop once the sprint is done", 2026-09-22). Has no dependency on Sprints 31-38 (backlog §7) but does depend on Sprint 29's theme/nav/`features/`/routing foundation, already COMPLETE.

## Goal

Replace `DashboardPage.tsx`'s placeholder ("Project, work item, and run visibility will appear here as later tasks add the underlying APIs.") with a real Home dashboard at `/`, backed entirely by already-existing routes — no new backend route, per this epic's own Delivery Principle (backlog §3: "Every net-new UI story wires a real, already-existing backend route").

## Grounding (confirmed by direct code inspection before scoping)

- `DashboardPage.tsx` (`apps/web/src/features/dashboard/`) is exactly the placeholder text above — nothing real to preserve; this sprint replaces it outright rather than incrementally extending it.
- **The mockup's Home layout** (`Design/DevOS.dc.html` lines 157-271) has 5 real sections: 4 KPI tiles (`pulse`), "Needs attention" (`attention`), "Active work" (`activeRuns`, with per-run stage-progress bars), "Recent activity" (`activity`, a vertical timeline), and "System health" (`health`). The mockup's own sample data arrays (`pulse`/`attention`/etc.) are template placeholders with no bound values in `support.js` — only the layout shape is real, not sample content.
- **A real gap found during this sprint's own conversion grounding**: there is no project-wide "list runs" backend route anywhere in this codebase (confirmed by reading every route in `apps/api/src/routes/workflow-runs.ts` — only `GET /runs/:runId` (single) and `GET /workflows/:workflowId/runs` (per-definition) exist). `RunsPage.tsx`'s own `runs` state is, on inspection, populated only by prepending a just-started run in the current browser session (`setRuns((current) => [result.data, ...current])`) — it has no way to list a project's pre-existing runs either. This sprint does **not** invent a new `GET /projects/:id/runs` route (forbidden by the epic's own Delivery Principle); instead it fans out `listWorkflows(projectId)` → `listWorkflowRunsForDefinition(workflowId)` per definition and aggregates client-side — the exact same real, already-proven pattern `WorkflowLibraryPage.tsx` already uses for its own per-definition run-health summary.
- **`WorkItemStatus` is a genuinely open-ended string** (`packages/contracts/src/status.ts:73-79`, explicit comment: "the source specifications provide OPEN as the canonical example... but do not define the complete enumeration... the contract intentionally preserves the status as an opaque string rather than inventing lifecycle values"). This sprint therefore does **not** compute an "active vs. closed" work-item split for a KPI tile — doing so would require inventing a status partition this codebase's own domain model explicitly refuses to define (AGENTS.md §7). The Work Items KPI tile uses a plain total count instead.
- `RUN_TERMINAL_STATUSES` (`api-client.ts:681`, `new Set(['COMPLETED', 'FAILED', 'CANCELLED'])`) and `approvalStatuses` (`packages/contracts/src/status.ts:112`, a real closed enum `['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']`) are both already-established closed sets safe to filter by — used for the "Runs In Progress" KPI tile and the "Needs attention"/pending-approvals KPI tile respectively.
- `listAuditRecordsForProject(projectId)` (`api-client.ts:827`) is a real, already-used route (Sprint 3/DEVOS-115 onward) that exactly fits "Recent activity" — a real chronological record of state-changing operations.
- **No real per-integration/system health signal exists yet** — `Integration` has no UI at all until Sprint 36, and there is no health-aggregation route until Sprint 39's DEVOS-258. Per DEVOS-208's own backlog acceptance text ("integrations-health once Sprint 36 exists — until then, omit that tile rather than fabricate it"), the System Health section is **omitted entirely** from this sprint, not rendered with fabricated data — added for real in Sprint 39 (DEVOS-259).

## In scope

- **DEVOS-208** — Home dashboard data: a real data hook fetching work items, approvals, artifacts, and the client-side-aggregated runs list and audit records for the selected project.
- **DEVOS-209** — Home dashboard layout: KPI tiles, Needs Attention, Active Work, Recent Activity — Nocturne-themed, matching the mockup's section shape. System Health omitted (see grounding above).
- **DEVOS-210** — Wire Home to real navigation: every tile/row is a real link to its real target page; no dead links.
- **DEVOS-211** — Validation, documentation, and gap disclosure.

## Out of scope

Any new backend route (the client-side runs fan-out reuses only already-existing routes). A System Health tile (explicitly deferred to Sprint 39). An "active vs. closed" work-item status partition (no spec defines one). Any change to `RunsPage.tsx`'s own separate, pre-existing runs-listing limitation (a real, disclosed but different gap — out of this sprint's scope; Sprint 31's DEVOS-214 restyle is where `RunsPage.tsx` itself is next touched).

## Task index

| ID        | Story                          | File           |
| --------- | ------------------------------- | -------------- |
| DEVOS-208 | Home dashboard data              | `DEVOS-208.md` |
| DEVOS-209 | Home dashboard layout             | `DEVOS-209.md` |
| DEVOS-210 | Wire Home to real navigation      | `DEVOS-210.md` |
| DEVOS-211 | Validation, documentation, and gap disclosure | `DEVOS-211.md` |
