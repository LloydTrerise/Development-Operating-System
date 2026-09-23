# Sprint 44 — Full-Epic Re-Audit, Nav Finalization & Close-Out

**Source:** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.17 (E28 UI/UX Redesign & Full Functional Coverage, fifteenth and final sprint).
**Conversion date:** 2026-09-23
**Status:** Converted per explicit user instruction ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-23, in direct response to a position report naming Sprint 44 as the recorded next action). Depends on every prior sprint in this epic (29–43) being COMPLETE — confirmed true, per `DEVOS-BUILD-STATE.md`'s own state-change-log.

## Goal

Close the epic: re-verify that every backend route this document ever committed to closing (§2.3's original 91-route audit plus every route Sprints 35–43 added, 105 routes total as of this sprint) is now reachable through the real UI or is an explicitly disclosed, deliberate exception; confirm the navigation/IA built across Sprints 29–43 has no dangling stub; run full validation; and produce the epic's one required closing disclosure — that real user identity/invite/role management remains permanently out of scope by deliberate decision, not oversight.

## Grounding (confirmed by direct code inspection before scoping)

- **No separate "audit record" artifact exists on disk.** `specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §2.3 says "full per-route detail is preserved in the audit record this document is built from" — grepped across `specs/` and found no such file; that original per-route detail was never checked into the repository, only its summary (§2.3's prose + 10-row gap table). DEVOS-273 therefore re-derives the full route enumeration fresh from `apps/api/src/routes/` rather than diffing against a prior document, and its own findings become the durable record going forward.
- **Route count grew from 91 to 105** since the v3.0 audit: `apps/api/src/routes/` now has 24 files (was 19), the 5 new ones (`notifications.ts`, `search.ts`, `system-health.ts`, `tool-capabilities.ts`, `workflow-library.ts`) plus new routes added to `organisations.ts` (4 membership routes) and `workflow-runs.ts` (`GET /runs/:runId`) account for the growth — all built by Sprints 39–43, all already covered by their own sprint's UI work per the roadmap's own narrative, re-confirmed independently here rather than assumed.
- **Method used**: every `method:`/`pattern:` pair was extracted programmatically from all 24 route files (105 routes, confirmed count); every `export function` in `apps/web/src/api-client.ts` was mapped to the URL template it requests; the two lists were diffed by normalized path (`:param`/`${var}` → `:X`) to find routes with zero client wrapper, and every wrapped function was independently checked for at least one call site anywhere else in `apps/web/src` (not just existence of the wrapper) to catch the specific failure mode Sprint 38 found for `listSharedKnowledgeSources`/`installKnowledgeSource` before that sprint fixed it — a wrapper that exists but nothing ever calls.
- **Result**: of 105 routes, 99 are genuinely reachable through the UI (`C`). 6 have no client wrapper; of those, 4 are the already-disclosed §9 exceptions (`GET /me`, `GET /project-types/:id`, `GET /policies/:id`, `GET /approvals/:id`) — re-confirmed still true, not silently regressed. The remaining 2 unwrapped routes, plus 2 wrapped-but-never-called functions found by the call-site check, are new findings this sprint's own audit surfaced — see DEVOS-273's own "Actual results" for the full disclosure of each. None represent a real missing user capability; each is either functionally covered by an existing list-based UI (the same precedent §9 already established for the other five) or a real, pre-existing, never-wired API surface that was never named in the document's own committed gap list to begin with.
- **Nav**: `apps/web/src/App.tsx`'s `NAV_GROUPS` (7 groups, 18 leaf items) was checked one-for-one against `<Routes>` — every nav `to` has a matching top-level `<Route path>`. No dangling stub found.

## In scope

- **DEVOS-273** — Full route-to-UI re-audit (all 105 routes), verdicts and disclosures recorded in `DEVOS-273.md`.
- **DEVOS-274** — Nav & IA finalization check, recorded in `DEVOS-274.md`.
- **DEVOS-275** — Full monorepo validation (`pnpm turbo run typecheck lint test build`) and the full real `tests/e2e` suite, recorded in `DEVOS-275.md`.
- **DEVOS-276** — Final written disclosure that real user identity/invite/suspend/role management remains deliberately out of this epic's scope, recorded in `DEVOS-276.md`.

## Out of scope

Fixing any of the newly-disclosed findings from DEVOS-273 that were never part of this document's own committed gap list (`POST /projects/:id/approvals` having no caller anywhere in the codebase; `GET /organisations/:id`/`GET /projects/:id` being wrapped-or-not but functionally superseded by list+find). Fixing the pre-existing, already-disclosed (Sprint 35) `ApprovalsPage.tsx` unbounded evidence-fetch loop — carried disclosed-but-unowned for three sprints now; this sprint's own re-audit records its continued presence rather than silently deciding to fix or defer it unilaterally, since no story in §6.17 names it. Building any part of real user identity/invite/role management (§9) — DEVOS-276 documents the exclusion, it does not narrow or reverse it.

## Task index

| ID        | Story                                                         | File           |
| --------- | -------------------------------------------------------------- | -------------- |
| DEVOS-273 | Re-run the full route-to-UI audit                              | `DEVOS-273.md` |
| DEVOS-274 | Nav & IA finalization                                           | `DEVOS-274.md` |
| DEVOS-275 | Full monorepo + e2e validation                                  | `DEVOS-275.md` |
| DEVOS-276 | Final documentation and disclosure of the one excluded gap      | `DEVOS-276.md` |
