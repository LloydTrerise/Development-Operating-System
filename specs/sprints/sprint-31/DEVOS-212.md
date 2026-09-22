# DEVOS-212 — Work Items restyle

**Priority:** P1 | **Estimate:** 1d
**Depends on:** none (Sprint 29's `features/` structure and Nocturne theme already exist).
**Depended on by:** DEVOS-213 (row click navigates to the detail view DEVOS-213 builds).

## Scope

Restyle `WorkItemsPage.tsx`'s existing plain table into a denser, mockup-inspired layout on the same real data/logic already in place — no new backend route.

## Implementation

- Columns: Title (+ `externalRef` shown as a secondary line when present, else the item's own short id), Type, Status (`StatusChip`), Priority, Updated (`updatedAt`, formatted).
- Status filter chips: derived from the distinct `status` values actually present in the currently loaded `workItems` array (plus an "All" chip), not a hardcoded enum — `WorkItemStatus` remains an open-ended string (`packages/contracts/src/status.ts:79`). Selecting a chip filters the table client-side; no new request.
- Each row is clickable (`cursor: pointer`, hover highlight) and navigates to `/work-items/:id` (the real route DEVOS-213 fills in this same sprint).
- The existing "New work item" creation form is preserved unchanged below the table.
- No per-row stage-progress bar (see README grounding — N+1 cost across a potentially hundreds-of-rows table, same reasoning Sprint 30 used to omit one on Home).

## Out of scope

Any new backend route. A closed status/priority enum. A per-row stage-progress bar. Pagination (existing `listWorkItems` already returns the full project list unpaginated; not this task's concern).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. A real dev-server check confirms: the table renders real seeded work items with working status filter chips, and clicking a row navigates to `/work-items/<realId>`.

## Actual results

`pnpm --filter @devos/web typecheck lint build` clean. Real dev-server check against the real seeded project (576 real work items): the table renders Title/Type/Status/Priority/Updated columns with a secondary `externalRef`-or-id line under each title; status filter chips render correctly (one per distinct status actually present in the data, matching the "no closed enum" grounding); clicking a row navigates to `/work-items/<realId>` (confirmed with a real work item id, `cbc800f9-fe80-42d1-ae60-de30f71a4caa`). Zero console errors in either light or dark mode.
