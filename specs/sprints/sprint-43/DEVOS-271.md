# DEVOS-271 — Notification bell and list

**Priority:** P0 | **Estimate:** 1d
**Depends on:** Sprint 42's `GET /notifications`/`PATCH /notifications/:id/read` routes (unchanged).
**Depended on by:** DEVOS-272 (validation).

## Scope

Header notification bell (mockup: `Design/DevOS.dc.html:102-105`, a static badge, never wired) wired to Sprint 42's real routes. Each notification deep-links to its real target (approval/run/artifact) per `ui-spec.txt` §29's action-mapping table, wherever a real target route exists — see `README.md`'s grounding for the real, disclosed exceptions (`WorkflowTask` has no resolvable target; `Integration` has no per-id route and is not a currently-reachable trigger in practice).

## Implementation

- `apps/web/src/api-client.ts`: new `Notification` interface (mirrors `apps/api/src/dto/notifications.ts`'s `toNotificationDto` shape exactly); `listNotifications()` (`GET /notifications`); `markNotificationRead(id)` (`PATCH /notifications/:id/read`).
- New `apps/web/src/features/notifications/notification-target.ts`: pure functions —
  - `describeNotificationType(type: EventType): string` — a human-readable label per real `EventType` (covering the full union, not just the four live ones).
  - `getNotificationLink(referenceType: string, referenceId: string): string | null` — `'Approval'` → `/approvals?approvalId=<id>`; `'WorkflowRun'` → `/runs/<id>`; `'Artifact'` → `/artifacts/<id>`; `'Integration'` → `/integrations`; anything else (including `'WorkflowTask'`) → `null`.
- New `apps/web/src/features/notifications/NotificationBell.tsx`: an `IconButton` (`NotificationsIcon`) with a MUI `Badge` showing the real unread count, in the same `Popper`/`ClickAwayListener` shape `GlobalSearch.tsx` already established. Fetches on mount and on each open. Each row shows the real label, a relative-to-absolute timestamp (`formatDate`, the same small local helper duplicated per feature file elsewhere in this codebase, not centralized), and an unread visual indicator. A row with a real link renders as a `RouterLink`; a row with no link (the disclosed `WorkflowTask` gap) renders as plain, non-interactive text with a small inline note. Clicking a linked row calls `markNotificationRead` (fire-and-forget, then refetches) and closes the popover.
- `App.tsx`: `<NotificationBell />` added to the `AppBar`'s real-time cluster, next to the existing theme-mode `IconButton`, matching the mockup's own placement.

## Out of scope

Bulk "mark all read" (no route exists). Any polling/push mechanism — fetch-on-mount-and-open only, matching this codebase's existing no-polling convention (`getHealth()` in `App.tsx` also only runs once). Any change to `Notification`'s shape or the Sprint 42 routes.

## Acceptance

`pnpm --filter @devos/web typecheck lint test build` clean. New `apps/web/tests/api-client.test.ts` cases for both wrappers. Live-verified against a real running dev server and real seeded Postgres: a real triggering event (an `APPROVAL`-node run, mirroring Sprint 42's own DEVOS-270 proof) produces a real notification; the bell's badge count reflects it; opening the bell shows it with a working `/approvals?approvalId=` link; clicking marks it read and the badge count drops.

## Actual results

Implemented exactly as planned, with one real, disclosed correction found while writing `ListItemText`'s per-row unread styling: this codebase's own MUI v7, per Sprint 39's already-disclosed `Switch`/`inputProps`-vs-`slotProps` finding, requires the modern `slotProps={{ primary: {...} }}` form — the legacy `primaryTypographyProps` prop was avoided from the start rather than risking the same class of silently-inert-prop bug.

New files: `apps/web/src/features/notifications/notification-target.ts` (`describeNotificationType`, a `Record<EventType, string>` covering the full union for compile-time exhaustiveness; `getNotificationLink`, mapping `'Approval'`/`'WorkflowRun'`/`'Artifact'`/`'Integration'` to their real routes and everything else, including `'WorkflowTask'`, to `null`); `apps/web/src/features/notifications/NotificationBell.tsx` (an `IconButton`+`Badge`+`Popper`+`ClickAwayListener`, the same shape `GlobalSearch.tsx` already established, fetching on mount and on each open, no polling). `apps/web/src/api-client.ts` gained `Notification`, `listNotifications`, `markNotificationRead` — the first-ever client wrappers for Sprint 42's routes. `App.tsx` gained `<NotificationBell />` in the `AppBar`'s real-time cluster, next to the theme toggle, matching the mockup's own placement exactly.

New tests: 2 cases added to `apps/web/tests/api-client.test.ts` (54 pre-existing + 2 new = 56), mirroring every prior sprint's own wrapper-test convention.

`pnpm --filter @devos/web typecheck lint test build` clean: **60/60 tests green** (56 in `api-client.test.ts` + 4 in `diff-lines.test.ts`). `prettier --check` clean across every file this task touched.

**Live-verified against a real running dev server, a real running `apps/worker`, and real seeded Postgres** (a throwaway script driving the real, unmodified HTTP contract, deleted afterward, mirroring Sprint 42's own DEVOS-270 proof exactly — real work item → real workflow with a single `APPROVAL` node → publish → start run → poll until the approval task reaches real `WAITING` → real `Approval` confirmed via `GET /runs/:runId/approvals` → after the worker's real drain-loop tick, `GET /notifications` returned a real `ApprovalRequested` row for `seed-user` referencing that exact approval), followed by a real Playwright script (run from inside `apps/web`, deleted afterward): the bell's badge showed a real unread count; opening it showed the just-created notification at the top of the list (ordered `created_at desc`); clicking it navigated to the real `/approvals?approvalId=<id>` URL, the `ApprovalsPage.tsx` detail pane rendered the correct approval (confirmed via its own real `workflowRunId` text); re-opening the bell showed the unread count had dropped by exactly one.

**A real, disclosed, pre-existing finding surfaced by this task's own live verification, not caused by this task's code**: opening `/approvals?approvalId=...` produced hundreds of real `net::ERR_INSUFFICIENT_RESOURCES` console errors — this is `ApprovalsPage.tsx`'s own already-disclosed (Sprint 35's `DEVOS-238.md`) unbounded per-approval evidence-fetch loop (`getArtifactVersionById`, once per evidence artifact-version id across every approval on the page), confirmed by direct inspection of `ApprovalsPage.tsx` (lines 100-122, its own pre-existing `useEffect` that this task's diff never touches) to be the exact same mechanism Sprint 35 already found, now firing far more often than the 47 errors Sprint 35 originally measured purely because the real seeded project's real approval count has continued growing since. Left unfixed, per this sprint's own declared out-of-scope boundary (`README.md`) — a real, worsening, pre-existing issue, not this sprint's to fix.
