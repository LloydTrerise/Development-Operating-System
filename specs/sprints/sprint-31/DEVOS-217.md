# DEVOS-217 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-212–216.
**Depended on by:** none — closes Sprint 31.

## Scope

Full monorepo validation, a real dev-server visual/click-through check, and explicit disclosure of every real gap this sprint surfaced or deliberately left open.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green (a regression check — this sprint touches `apps/web` restyle plus one new `apps/api` route-level test, no application-layer/domain change).
- Real dev-server visual check (Playwright against the real Vite dev server and a real running `apps/api`/Postgres, per this codebase's own established substitute for a human browser check): Work Items table renders real data with working filter chips and row navigation; a work item's detail/edit view loads real data and a real edit persists; Runs shows the restyled pipeline header/master-detail task view with real task data; a run's own real approval (if any) is visible on its `RunCard` and links through to a highlighted `ApprovalsPage.tsx` entry — in both light and dark mode, zero console errors.
- Record in this file's own Gaps section every deliberate omission or re-disclosed pre-existing gap: no per-work-item stage-progress bar; no project-wide runs-listing route/UI; no new `/approvals/:id` detail route; free-text status/priority editing (no closed enum).

## Out of scope

Any new feature beyond what DEVOS-212-216 already scoped.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — record the actual pass count against Sprint 30's own 76/76 baseline (this sprint adds no new package, so the same count is expected). The full real `tests/e2e` suite green with no regression to Sprint 30's own last-reported file/test counts, plus this sprint's own new route-level test. Real dev-server visual and click-through confirmation, documented here per the epic's own Definition of Done (backlog §8).

## Actual results

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful**, exactly matching Sprint 30's own baseline (this sprint adds no new package — only new tests within existing packages). The full real `tests/e2e` suite **27/27 files, 52/52 tests green**, zero regression from Sprint 30's own last-reported count.

Real dev-server visual and click-through check (Playwright against the real Vite dev server and a real running `apps/api` connected to real Postgres, screenshots reviewed, both light and dark mode, zero console errors throughout):
- **Work Items** (DEVOS-212): the real 576-row seeded table renders with working status filter chips; row click navigates to the real detail route.
- **Work item detail & edit** (DEVOS-213): real data loads; a real edit (Status → a sentinel value) was saved, confirmed persisted via reload, then reverted to the original value.
- **Runs** (DEVOS-214): the restyled pipeline header, master task list, and task-detail pane were verified against both a real freshly-started run and a real completed 3-task run, correctly showing real agent output and tool invocations for the selected task.
- **Run-scoped approval visibility** (DEVOS-215): a real `AWAITING_APPROVAL` run's own `RunCard` showed its real pending approval with a working "View approval" link that navigated to and highlighted the correct card on the Approvals page.

## Gaps disclosed (not silently patched)

- **A real, pre-existing usability problem was found, not fixed, in `ApprovalsPage.tsx` while verifying DEVOS-215**: the real seeded project has 101 pending approvals, and `ApprovalsPage.tsx` has never paginated or capped its Pending list — rendering all of them produces a **42,442px-tall page**, the same class of problem Sprint 30's own `DEVOS-211.md` found and fixed for the Home dashboard. This sprint does **not** fix it, because (a) `ApprovalsPage.tsx`'s own list-rendering logic is untouched by this sprint — Sprint 31 only added a `?approvalId=` highlight to it, it did not restyle or introduce the unbounded list — and (b) the backlog's own already-approved plan (`specs/DEVOS-UI-UX-REDESIGN-BACKLOG.md` §6.4, Sprint 32, DEVOS-218 "Approvals restyle") is the sprint that next touches this page's own layout. DEVOS-215's own acceptance is unaffected: the `?approvalId=` link programmatically scrolls the user directly to the target card (verified via a real `window.scrollY` assertion and screenshot) rather than requiring them to visually locate it in the unbounded list themselves — the real gap this sprint was scoped to close is closed; the separate, pre-existing unbounded-rendering problem is re-disclosed here for Sprint 32's own awareness, not silently left undiscovered.
- **No per-work-item stage-progress bar** on the Work Items table (DEVOS-212) — disproportionate N+1 cost across a 576-row real table; see this sprint's own README grounding.
- **`RunsPage.tsx`'s pre-existing "no project-wide historical runs list" limitation** (session-started runs plus per-work-item timeline only, no project-wide list) is unchanged — a real, separate, pre-existing gap, re-disclosed (not fixed) per this sprint's own README grounding; still no project-wide "list all runs" backend route exists anywhere in this codebase.
- **No new `/approvals/:id` detail route** — `ApprovalsPage.tsx`'s own list (now with the real `?approvalId=` highlight) remains the fullest per-approval detail surface this app has; a dedicated detail route is out of this sprint's scope, consistent with Sprint 29's own deferral of per-entity detail views.
- **Free-text status/priority editing** on the work item edit form (DEVOS-213) — `WorkItemStatus`/`WorkItemPriority` remain open-ended strings with no closed enum defined anywhere in this codebase's domain model; a dropdown would mean inventing lifecycle values the specs deliberately leave undefined.
- **A handful of harmless real workflow runs were created in the seeded `DevOS POC` project's real Postgres data** while verifying DEVOS-214/215 against a live dev server (real `Intake to Artifact` runs against the real "test" work item, left in `PENDING`/early stages) — the same accepted-stray-test-artifact pattern already documented for DEVOS-090's stray test policies; confirmed harmless (no workflow depends on this specific work item's run count or state).
