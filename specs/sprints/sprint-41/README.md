# Sprint 41 — Cross-Entity Search UI & Global Command Palette

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.14 (E28 UI/UX Redesign & Full Functional Coverage, thirteenth sprint).
**Conversion date:** 2026-09-23
**Status:** Converted and executed per explicit user instruction ("convert to specs and start the sprint. Run the sprint through without waiting for authorisation. Stop when sprint is done", 2026-09-23, in direct response to a position report naming Sprint 41 as the recorded next action). Depends on Sprint 40's DEVOS-262 real, unmodified `GET /projects/:id/search?q=...` route (direct dependency, confirmed live in `apps/api/src/routes/search.ts`).

## Goal

Close the second of the two remaining named-but-UI-less `ui-spec.txt` areas this epic tracks (§27 Search, §28 Global Command Palette): wire a real search UI onto Sprint 40's route, and add a pure-frontend, keyboard-accessible global Command Palette on top of it and every other real route this epic has already shipped.

## Grounding (confirmed by direct code inspection before scoping)

- **The mockup's search box is real, but "already present in the real app shell" is false — a real, disclosed correction to the backlog's own DEVOS-264 framing.** `Design/DevOS.dc.html:87-91` shows a search-box-styled element with a `⌘K` kbd hint in the header, but `apps/web/src/App.tsx`'s real `AppBar` (confirmed by reading the whole file) has no search input at all today — only `OrganisationSelector`/`ProjectSelector`/`SessionStatus`/the theme toggle. DEVOS-264 therefore adds a genuinely new top-bar search input, not wiring an existing-but-inert one.
- **No web API-client wrapper for search exists yet, confirmed by grep** (`search|searchProject` nowhere in `apps/web/src/api-client.ts`) — Sprint 40's own README disclosed this as deliberately deferred to this sprint.
- **DTO shapes for all four searchable entity types already exist client-side and need no new type**: `WorkItem`, `Artifact`, `Agent` (`api-client.ts:146,255,191`) exactly match `toWorkItemDto`/`toArtifactDto`/`toAgentDto`'s real output. The workflow shape returned by search uses `toWorkflowDefinitionDto` (the single-definition DTO, not `toWorkflowDefinitionSummaryDto`) — `WorkflowDefinitionSummary`'s two extra fields (`latestVersionStatus`/`versionCount`) are already optional, so reusing that type for search results is safe without a new interface.
- **Real per-entity-type navigation target audit, confirmed by reading `App.tsx`'s route table directly, not assumed from naming:**
  - Work item → `/work-items/:id` (real detail route, Sprint 31).
  - Artifact → `/artifacts/:id` (real Artifact Viewer, Sprint 35).
  - Agent → `/agents/:id` (real Agent Detail, Sprint 34).
  - Workflow → **no real per-definition route exists.** `/workflow-library` is a flat, all-projects table with in-memory (not URL-driven) `expandedId` state (`WorkflowLibraryPage.tsx:123`) — confirmed by grep, no `useSearchParams`/`scrollIntoView` anywhere in that file or anywhere else in `apps/web/src` today. A minimal, additive `?workflowId=` query param is added to `WorkflowLibraryPage.tsx`, mirroring the exact convention Sprint 31's DEVOS-215 already established for `ApprovalsPage.tsx`'s `?approvalId=` (select/expand the matching row + scroll it into view) — without this, DEVOS-264's own acceptance text ("results grouped by entity type") would be genuinely un-actionable for the one entity type search returns that has no dedicated detail page.
- **Command Palette action-to-route audit, confirmed against the real route table (`App.tsx`) and `ui-spec.txt` §28's own literal action list — every action maps to a real, already-shipped destination, with two real, disclosed, honest limitations (not invented workarounds):**
  - Open project → real project picker (from `useProjectContext().projects`) that calls `selectProject` then navigates to `/projects/:id` (real detail route, Sprint 33).
  - Search work / jump to agent / open artifact → collapsed into the palette's own live entity search (typing 2+ characters queries DEVOS-262's real route and renders grouped results, reusing DEVOS-264's `GlobalSearch` result-rendering/navigation logic directly rather than a second implementation) — this is a more literal reading of "search work" than a static command, since work items are found by searching, not by a fixed destination.
  - Start workflow → navigates to `/runs` (the real, only "Start a run" form in this codebase — `RunsPage.tsx`). No separate workflow-authoring "start" action exists; starting a _run_ is the real, only user-facing meaning of "start" for a workflow anywhere in this app.
  - Open approval → `/approvals`.
  - Open artifact (static shortcut) → `/artifacts` (the library list; a specific artifact is reached via the live search results, same as work items/agents).
  - **Open workflow run → real, disclosed limitation: navigates to `/runs`, the same destination as "Start workflow".** No `/runs/:id` detail route, no project-wide "list runs" route, and no URL-addressable single-run view exists anywhere in this codebase (`RunsPage.tsx` only shows runs started this browser session, or runs for one selected work item — confirmed by reading the whole file; this is the same pre-existing gap Sprint 30's own README already disclosed for the Home dashboard). Not fabricated with a fake route.
  - Jump to agent (static shortcut) → `/agents` (the list; a specific agent is reached via the live search results).
  - Open integration → `/integrations`.
  - View recent activity → `/governance` (the real Risk Activity panel, Sprint 32's DEVOS-219 — the closest real activity/audit surface in this codebase; there is no dedicated project-wide activity-feed page).
- **First-ever global keyboard shortcut in this codebase, confirmed by grep** (no `keydown`/`addEventListener` anywhere in `apps/web/src` today) — `Cmd+K`/`Ctrl+K` is added via a single `window`-level `keydown` listener in `App.tsx`, following the browser-standard modifier convention (`metaKey` on macOS, `ctrlKey` elsewhere), `event.preventDefault()`'d so it doesn't collide with any browser/OS default.

## In scope

- **DEVOS-264** — Search UI: new `searchProject` client wrapper (`api-client.ts`); a new top-bar `GlobalSearch` component (`features/search/GlobalSearch.tsx`) in `App.tsx`'s `AppBar`, debounced (300ms, matching `useWorkflowGraphValidation`'s established convention), results grouped by entity type, respecting the caller's permissions (already enforced server-side via `resolveMembership`); the additive `?workflowId=` deep-link on `WorkflowLibraryPage.tsx` described above.
- **DEVOS-265** — Global Command Palette: new `features/search/CommandPalette.tsx`, `Cmd+K`/`Ctrl+K`-triggered, keyboard-navigable (arrow keys + Enter + Escape), static action shortcuts plus the same live entity search DEVOS-264 renders.
- **DEVOS-266** — Validation, documentation, and gap disclosure: full monorepo validation green; full real `tests/e2e` suite green; live dev-server verification.

## Out of scope

A `/runs/:id` or `/workflows/:id` detail route (real, disclosed pre-existing gaps, not this sprint's to fix — see grounding above). Including `knowledge_sources` in the search results (Sprint 40's own disclosed boundary, unchanged here). Any change to DEVOS-262's route contract. Any new backend route or migration (this sprint is pure frontend, per the backlog's own sprint title and dependency note in §7).

## Task index

| ID        | Story                                         | File           |
| --------- | --------------------------------------------- | -------------- |
| DEVOS-264 | Search UI                                     | `DEVOS-264.md` |
| DEVOS-265 | Global Command Palette                        | `DEVOS-265.md` |
| DEVOS-266 | Validation, documentation, and gap disclosure | `DEVOS-266.md` |

## Scope extension: real fixes for the two disclosed gaps (authorized 2026-09-23)

After DEVOS-266's own validation completed, the user asked to fix the two real, disclosed limitations rather than leave them as gaps, and chose (via an explicit either/or clarifying question) the real, structural fix for each over the smaller band-aid alternative offered:

1. **WorkflowLibraryPage's client-side fan-out** — a real, new server-side aggregate route (not a client-side concurrency cap or a scope-down to one project at a time).
2. **The Command Palette's shared "Open workflow run"/"Start workflow" destination** — a real `/runs/:id` detail route (not left as a disclosed limitation).

### 1. `GET /organisations/:id/workflow-library` — real aggregate route

New `WorkflowDefinitionRepository.listForOrganisation` (optional method, joins `projects`), `SummarizeWorkflowVersionsForDefinitions` and `SummarizeWorkflowRunStatusCountsForOrganisation` (both standalone function types, mirroring `ListWorkflowRunsForDefinition`'s own established precedent — a separate flat port rather than widening `WorkflowVersionRepository`/`WorkflowRunRepository`, so every existing fake of those two widely-faked interfaces stays valid unchanged). Real Postgres implementations: one `DISTINCT ON` + `COUNT(...) OVER (PARTITION BY ...)` window-function query for per-definition latest-version-status/version-count, one `GROUP BY` query for per-definition run-status counts (mirrors `costBreakdownByWorkflowForOrganisation`'s own `workflow_runs -> projects` join shape, `agent-executions.ts`). New `packages/application/src/workflows/list-workflows-for-organisation.ts` (gated by `resolveOrganisationMembership`, mirroring `getOrganisationCostReport`'s own precedent) and `apps/api/src/routes/workflow-library.ts`. `WorkflowLibraryPage.tsx`'s own former `Promise.all(projects.map(listWorkflows))` (list fan-out) and `Promise.all(rows.map(listWorkflowRunsForDefinition))` (run-health fan-out) are both replaced by one call to the new `listWorkflowsForOrganisation` client wrapper.

**Live-verified against real Postgres**: the real seeded organisation's **16,021** real workflow definitions (across its **4,496** real accumulated projects) are returned in **238ms** — `EXPLAIN ANALYZE` on all three underlying queries confirmed 4–11ms execution each, real index usage where a leading-column composite unique index already existed (`workflow_versions_workflow_definition_id_version_key`), and real, correct, fast Postgres query-planner choices (hash join / seq scan) elsewhere — no new index was needed at this real data volume.

**A second real, more severe bug was found during this same live verification, not assumed away**: even with the fast backend response, rendering all 16,021 real rows in `WorkflowLibraryPage.tsx`'s plain, un-virtualized `<Table>` (each row also carrying its own "clone into new draft" project picker — a `<Select>` enumerating up to ~4,496 real `MenuItem`s) froze the real browser tab's main thread for minutes (confirmed repeatedly: multiple bounded Playwright probes up to 100s each never observed the tab become responsive again; one earlier unbounded attempt was left running by mistake and was still hung, having accumulated under 5 seconds of real CPU time, after 3 hours 41 minutes). This is a **real, previously-invisible client-side scaling bug this fix's own success exposed** — the page was already broken before (network never resolved), so this render cost never had a chance to matter until the backend fix made real data actually reach the browser. Fixed with the same precedent Sprint 30 already established for exactly this shape of problem (Home dashboard's own unbounded list): a real `MAX_VISIBLE_ROWS = 200` cap with an honest total-count header (`"Showing 200 of 16,021 matching (16,021 total) — refine filters to narrow results"`), and the `?workflowId=` deep link is explicitly kept outside the cap (unshifted to the front of the visible set) so DEVOS-264's own scroll-to-highlight behavior still works regardless of where the linked definition falls in the full, unfiltered list. Re-verified after the fix: the page renders (400 real `<tr>` — 200 rows × main+collapse) within ~2 seconds against the real full dataset, zero console/page errors, and the deep-link case (which also triggers a version-history fetch and expand) completes within ~16 seconds — slower than the plain case but real, bounded, and no longer a browser freeze.

### 2. `/runs/:id` — real run detail route

Real backend routes already existed, fully built, zero UI ever addressing a specific run (`GET /runs/:runId` → `getRun`, `GET /runs/:runId/tasks` → `listRunTasks`, both with existing client wrappers — confirmed by grep before assuming a route needed building). `RunCard.tsx` (Sprint 31's DEVOS-214) already renders a run's complete detail (pipeline, task drill-down, approvals link, artifacts, evidence, release readiness); the only real gap was a routed page resolving `:id` to a `WorkflowRun` and reusing that component. New `apps/web/src/features/runs/RunDetailPage.tsx` and `/runs/:id` route in `App.tsx`. The two places that previously showed a run id as inert plain text next to a generic "view runs" link to the whole list (`ApprovalsPage.tsx`, `ArtifactViewerPage.tsx` — both real, disclosed, pre-existing gaps, confirmed by grep before this fix) now link directly to `/runs/:workflowRunId`.

**Deliberately unchanged**: the Command Palette's "Open workflow run" and "Start workflow" still both navigate to `/runs` — no static Palette action names a specific run id, and runs are not part of Sprint 40's search-result entity types, so there is still no live picker that could resolve one. This is an honest, narrower, real remaining limitation (not the same as the one just closed), left as-is since fixing it was not part of what was authorized.

### Validation after both fixes

Full monorepo `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force`: **76/76 tasks successful**. New tests: `packages/application/tests/list-workflows-for-organisation.test.ts` (4 cases — real aggregation, zero-definitions short-circuit confirmed via call-count assertions, non-member 404, non-existent-organisation 404); 3 new route-level tests in `apps/api/tests/app.test.ts` (`workflow library route` describe block); a new `apps/web/tests/api-client.test.ts` case for `listWorkflowsForOrganisation`. Full real `tests/e2e` suite re-confirmed unaffected (still 27/27 files, 52/52 tests — this scope extension changed no e2e-covered behavior). Live-verified end to end against real Postgres and a real running dev server, dev servers stopped cleanly afterward (including one leftover `apps/api` process the e2e suite's own prior run had left bound to port 3000 — found and stopped the same way).
