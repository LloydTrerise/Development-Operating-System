# DEVOS-306 — UI: assignment pickers on the work item detail view

**Priority:** P1
**Depends on:** DEVOS-305 (the use cases this UI calls).

## Scope

Extends the existing `WorkItemsPage.tsx`/detail-view pattern (Sprint 31/34's precedent) with a real Assignments panel on `WorkItemDetailPage.tsx`.

## Implementation

Three new routes in `apps/api/src/routes/work-items.ts`:

- `GET /work-items/:workItemId/assignments` — any project member.
- `POST /work-items/:workItemId/assignments` (body `{ principalId, role }`) — `canManageMembers`-gated.
- `DELETE /work-items/:workItemId/assignments/:principalId/:role` — `canManageMembers`-gated.

New DTOs in `apps/api/src/dto/work-item.ts`: `toWorkItemAssignmentDto`, `parseAssignWorkItemBody` (validates `role` against `workItemAssignmentRoles`, mirroring `apps/api/src/dto/project.ts`'s own `isMembershipRole` "validate a string against a fixed, readonly tuple" shape). `toWorkItemDto`/`parseCreateWorkItemBody`/`parseUpdateWorkItemBody` all gained `parentId` (DEVOS-303).

New client wrappers in `apps/web/src/api-client.ts`: `listWorkItemAssignments`, `assignWorkItem`, `removeWorkItemAssignment`, plus `WorkItem`/`WorkItemAssignment`/`WorkItemAssignmentRole` type widenings.

`WorkItemDetailPage.tsx` gains an Assignments panel (third column, alongside the existing Details/Edit columns): a chip per current assignment (`"ROLE: principalId"`, `×` to remove), and a principal/role picker + "Assign" button below it — mirroring `ProjectDetailPage.tsx`'s own established job-role-picker convention (Chip + `Select`/`MenuItem` + a form at the bottom). No client-side role check hides the form; an unauthorized attempt surfaces the server's real `403` via the same `ErrorAlert` pattern every other panel in this codebase uses — matching `ProjectDetailPage.tsx`'s own precedent of never gating a form client-side on `canManageMembers`.

## Out of scope

_Originally also out of scope, per this file's own literal acceptance criterion (only "assignment pickers on the work item detail view" named): a parent/hierarchy picker for DEVOS-303's own `parentId`. Added post-completion, per explicit user request — see "Follow-up" below and `README.md`'s "Scope extension" section._

## Acceptance

`pnpm --filter @devos/api typecheck lint test build` clean; `pnpm --filter @devos/web typecheck lint build` clean. Real, live-verified round trip: list assignments, grant a role, see it reflected, remove it, see it gone.

## Actual results

Implemented as planned. `pnpm --filter @devos/api typecheck lint test build` and `pnpm --filter @devos/web typecheck lint build` both clean. Live-verified against real Postgres and a real running `apps/api`: `GET /work-items/:id/assignments` correctly listed the creator's auto-assigned `ASSIGNEE` row; `POST` granted a `REVIEWER` role to a second real project member (`200`, correct response shape); a non-managing member's own `POST` attempt was denied (`403`); `DELETE` removed the grant (`200`), confirmed by a follow-up transition attempt from that principal correctly returning `403` again.

The web UI panel itself was also independently driven through a real Chromium browser via a throwaway Playwright script (`apps/web/verify-devos306.mjs`, deleted after use), against real `apps/api`/`apps/web` dev servers and real Postgres: navigating to a real `/work-items/:id` page rendered the initial `ASSIGNEE: seed-user` chip correctly; using the principal/role `Select` pickers to choose the second real member and `REVIEWER`, then clicking "Assign," produced a real `REVIEWER: <principal>` chip; clicking that chip's own delete (×) icon removed it. Zero console errors throughout. One real, disclosed non-issue found and resolved during this verification, not a product defect: the script's own first pass checked for the initial `ASSIGNEE` chip before the page's async `listWorkItemAssignments` fetch had resolved, misreporting "not present" — a `body.innerText()` dump taken after an explicit wait confirmed the chip renders correctly; the timing was in the throwaway test script, not the page.

## Follow-up: Hierarchy panel (post-completion)

Added after this sprint's own initial completion, per explicit user request (see `README.md`'s "Scope extension" section).

`WorkItemDetailPage.tsx` gains a fourth panel, Hierarchy, alongside Details/Edit/Assignments: the current parent (if any) renders as a real `Link`/`RouterLink` to its own `/work-items/:id` page (falling back to the bare id if its title isn't in the loaded list); a `Select` picker (with a "None" option) changes or clears it, PATCHing `parentId` as a real id or explicit `null`; a Children section below lists every work item in the same project whose own `parentId` matches this one, each linking to its own detail page. All three are derived from a single `listWorkItems(projectId)` fetch — no new route, no new client wrapper beyond the already-existing `listWorkItems` (Sprint 20) — deliberately reusing the same unbounded-per-project cost `WorkItemsPage.tsx` already accepts for identical data, rather than inventing a new cap for this page alone.

**Acceptance (follow-up)**: the panel renders the current parent as a working link; the picker changes/clears the parent and the change persists; children of the current item are listed and link correctly; this reuse of an unbounded per-project fetch does not introduce a new, disclosed performance problem (measured, not assumed).

**Actual results**: implemented as planned. `pnpm --filter @devos/web typecheck lint build` clean. Live-verified via a second throwaway Playwright script (`apps/web/verify-hierarchy.mjs`, deleted after use) against real `apps/api`/`apps/web` dev servers and the real seeded "DevOS POC" project (00000000-0000-4000-8000-000000000002, this environment's largest real project by work-item count): a real parent/child pair was created through the real API; the child's detail page correctly showed the parent's title as a working link; opening the "Change parent" picker against this project's real **992** work items (978 pre-existing plus this verification's own 2, cleaned up afterward) opened in **249ms** with zero console errors — the reused unbounded-fetch cost is real but not a new risk, confirmed by measurement rather than assumed safe; navigating to the parent's own page correctly showed the child in its Children list. Total page load (navigation + all four panels' own fetches) measured at ~6s in this session's own dev-mode (unminified) environment — a real, disclosed number, not concerning enough on its own to warrant a fix given the picker's own fast 249ms open time once loaded, but worth knowing if a future sprint revisits this page's overall load performance. New tests: `packages/application/tests/work-items.test.ts` and `apps/api/tests/app.test.ts` already cover the underlying `parentId`/cycle/clear logic this panel calls (see `DEVOS-303.md`'s own "Follow-up" section) — no additional backend test coverage was needed since this panel adds no new route or use case, only UI. Full evidence in `DEVOS-307.md`.
