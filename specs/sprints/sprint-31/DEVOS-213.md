# DEVOS-213 — Work item detail & edit

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-212 (the row link that reaches this view).
**Depended on by:** none within this sprint.

## Scope

Replace `WorkItemDetailPage.tsx`'s Sprint-29 scaffold with a real detail/edit view at `/work-items/:id`, using the already-existing, already-tested `GET`/`PATCH /work-items/:workItemId` routes. Per direct grounding (README), the backend gap the backlog names does not exist — the real gap is the missing frontend client wrapper and UI.

## Implementation

- `apps/web/src/api-client.ts`: add `getWorkItem(id): Promise<ApiResult<WorkItem>>` (`GET /api/v1/work-items/:id`) and `updateWorkItem(id, changes: { title?; description?; status?; priority?; metadata? }): Promise<ApiResult<WorkItem>>` (`PATCH /api/v1/work-items/:id`), mirroring the existing `listWorkItems`/`createWorkItem` wrappers' style exactly.
- `WorkItemDetailPage.tsx`: on mount, `getWorkItem(id)`; render via `DetailPageLayout` (title: the work item's own title, `backTo="/work-items"`), read-only fields (type, `externalRef`, `source`, `createdAt`, `updatedAt`), and an edit form (title, description, status, priority — plain text fields, since no closed enum exists for status/priority) that calls `updateWorkItem` on submit and re-fetches on success.
- Loading/error states via the same `LoadingState`/`ErrorAlert` components already used across every other page.

## Out of scope

A closed status/priority dropdown (no enum specified anywhere — free-text fields, disclosed here as the deliberate choice). Editing `type`/`externalRef`/`source` (the backend's own `UpdateWorkItemBody` does not accept these — create-only fields, confirmed by direct inspection of `apps/api/src/dto/work-item.ts`). Any change to the backend route or use case (already correct and already tested).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check: navigating to a real seeded work item's `/work-items/:id` shows its real data; editing status/priority/description and submitting persists via a real `PATCH` call, confirmed by a subsequent `GET` (or page reload) showing the new values.

## Actual results

`pnpm --filter @devos/web typecheck lint build` clean. `getWorkItem`/`updateWorkItem` added to `api-client.ts`, both covered by new tests in `apps/web/tests/api-client.test.ts` (DEVOS-216). Real dev-server check: navigated to a real work item's `/work-items/:id`, confirmed real data rendered (type, created/updated timestamps). **A real PATCH persistence round-trip was verified, not just a UI smoke test**: edited the Status field to a sentinel value (`DEVOS-217-CHECK`), saved, reloaded the page (a fresh `GET`), confirmed the sentinel value persisted server-side — then reverted it back to the work item's real original value (`OPEN`) to leave no test pollution behind.
