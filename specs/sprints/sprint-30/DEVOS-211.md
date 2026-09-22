# DEVOS-211 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-208, DEVOS-209, DEVOS-210.
**Depended on by:** none — closes Sprint 30.

## Scope

Full monorepo validation, a real dev-server visual check, and explicit disclosure of every real gap DEVOS-208-210 surfaced or deferred.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green — this sprint touches only `apps/web`, a pure regression check.
- Real dev-server visual check (Playwright against the real Vite dev server, per this codebase's own established substitute for a human browser check): Home renders real KPI counts, a real Needs Attention list (or empty state), a real Active Work list (or empty state), a real Recent Activity list, in both light and dark mode, with zero console errors; every navigable element (per DEVOS-210) confirmed to actually navigate.
- Record in this file's own Gaps section every deliberate omission from DEVOS-208-210 (System Health, KPI delta/trend, per-run stage bars, Artifacts tile non-linkage, deferred header quick-actions) — confirming each is a disclosed scope decision, not an oversight.

## Out of scope

Any new feature beyond what DEVOS-208-210 already scoped.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — record the actual pass count (expect the same as Sprint 29's own baseline, since this sprint adds no new package). The full real `tests/e2e` suite green with no regression to Sprint 29's own last-reported file/test counts. Real dev-server visual and click-through confirmation, documented here per the epic's own Definition of Done (backlog §8).

## Actual results

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful**, exactly matching Sprint 29's own baseline (this sprint adds no new package). The full real `tests/e2e` suite **27/27 files, 52/52 tests green**, zero regression from Sprint 29's own last-reported count.

Real dev-server visual check (Playwright against the real Vite dev server and a real running `apps/api` connected to real Postgres, screenshots reviewed): Home rendered with the seeded project's genuinely real data (552 work items, 170 in-progress runs, 97 pending approvals, 2191 artifacts), correct in both light and dark mode, zero console errors. Every navigable element confirmed via a real click-through script: the Work Items/Runs/Pending Approvals KPI tiles, Needs Attention rows, the "All approvals" link, Active Work rows, the "All runs" link, and Recent Activity rows all navigated to their real, correct target route (`/work-items`, `/runs`, `/approvals`, `/governance`); the Artifacts tile confirmed genuinely non-navigable (URL unchanged after click).

**A real usability bug was found and fixed during this sprint's own execution, before being reported as done**: the real seeded database (after many sprints' worth of real pilot runs) has 97 pending approvals and 170 in-progress runs — with DEVOS-208/209's original unbounded rendering, this produced a single dashboard page **16,895px tall**, defeating the entire purpose of an at-a-glance Home view. Caught by direct visual inspection of a real full-page screenshot (not just a console-error check), not assumed safe from a small local test fixture. Fixed by adding a shared `HOME_LIST_LIMIT` (8 rows) to both the Needs Attention and Active Work sections, with each section's header showing the real total count (e.g. "97 items") and its own real link to the full list page — mirroring the mockup's own "4 items" header-count convention (`Design/DevOS.dc.html` line 192) and Recent Activity's own pre-existing 10-item cap (DEVOS-208). Re-verified via a fresh screenshot showing a normally-proportioned page.

## Gaps disclosed (not silently patched)

- **System Health section omitted entirely** — no real per-integration/per-capability health signal exists anywhere in this codebase until Sprint 39's DEVOS-258 (backend) and DEVOS-259 (this same Home tile, wired for real at that point) — confirmed by this sprint's own conversion grounding, not a newly-discovered gap.
- **No KPI delta/trend indicator** (the mockup's `k.delta`/`k.deltaColor`) — no historical/point-in-time comparison data source exists anywhere in this codebase (every list route returns only current state); fabricating a trend would mean inventing data, not omitting a feature.
- **No per-run stage-progress bar in Active Work** (the mockup's `r.stages`) — computing one would need each run's live task list per row (`listRunTasks`, a real route, but N+1 calls per row for a summary list is a real, disproportionate cost for this sprint's own scope); `StatusChip` conveys the run's current status instead, and the real per-task breakdown remains one click away on `RunsPage.tsx`.
- **Needs Attention/Active Work rows link to the list page (`/approvals`/`/runs`), not a per-item detail view** — confirmed by direct inspection that no per-approval or per-run detail route exists anywhere in this app (Sprint 29's DEVOS-206 only scaffolded `/work-items/:id`); linking to a route that doesn't exist would be a fabricated deep link, not a real one.
- **The mockup's "Start workflow"/"New work item" header quick-actions were not built** — both already have real, complete flows on their own pages (`WorkflowsPage.tsx`, `WorkItemsPage.tsx`); a Home-page shortcut duplicating either is reasonable future value but was not in DEVOS-208/209's own written acceptance text, so it was not built as an under-scoped stub.
- **The Artifacts KPI tile has no link target** — confirmed by direct inspection that no Artifact Library page exists anywhere in this app yet; it becomes real and clickable once Sprint 35 (DEVOS-235/238) ships it.
- **`RunsPage.tsx`'s own separate, pre-existing "no way to list a project's historical runs" gap** (found during this sprint's own grounding, not fixed by it) remains open — Home's own Active Work fan-out (`listWorkflows` + `listWorkflowRunsForDefinition` per definition) works around it locally for Home's own purposes, but `RunsPage.tsx` itself still only ever shows runs started in the current browser session. Out of this sprint's own scope (`RunsPage.tsx` is next touched by Sprint 31's DEVOS-214 restyle); flagged here for that sprint's own awareness rather than silently left undiscovered.
