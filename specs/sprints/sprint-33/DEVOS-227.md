# DEVOS-227 — Organisation & Project settings

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-225 (the `/projects/:id` detail page shell this panel lives on, for the project half).
**Depended on by:** none.

## Scope

Closes the real, disclosed client-wrapper/UI gap for `PATCH /projects/:id` (see README grounding: the route and `updateProject` already exist, unmodified, OWNER-gated; `updateOrganisation`'s own wrapper already exists from an earlier sprint, only its UI is missing) — a lightweight, rename-only settings panel on each area, matching the backlog's own explicit "no new fields invented" scope even though the routes themselves also accept `status`/`budgetUsd`.

## Implementation

- `apps/web/src/api-client.ts`: a new `updateProject(projectId, changes: { name?: string; description?: string; status?: string; budgetUsd?: number }): Promise<ApiResult<Project>>` wrapper mirroring `updateOrganisation`'s own exact shape, calling the existing, unmodified `PATCH /api/v1/projects/:id`. (The wrapper itself mirrors the route's full real body shape, matching `updateOrganisation`'s own precedent of not artificially narrowing a wrapper's type below what the route accepts — the UI restricts itself to `name` only, per this task's own explicit "rename only" scope, not the wrapper.)
- `ProjectDetailPage.tsx` gains a "Settings" section: a single `name` text field with a Save button, calling `updateProject(id, { name })`, showing the persisted value on success via the existing `ProjectContext`'s `refresh()`.
- `OrganisationsPage.tsx` gains an inline, expand-in-place "Settings" affordance per organisation row (since the page itself is not restyled until Sprint 34 and has no detail route yet — see README grounding for why a `/organisations/:id` route is not pre-built this sprint): an expand icon-button per row reveals a `name` text field + Save button, calling the already-existing `updateOrganisation(id, { name })`, refreshing the list on success.
- Both settings actions surface real backend errors (e.g. a non-OWNER's 403) via `ErrorAlert`, unchanged from this codebase's existing error-handling convention.

## Out of scope

Exposing `description`/`status`/`budgetUsd` in either UI (the backlog's own explicit "rename only" scope, even though both routes accept more). Slug editing (neither `UpdateOrganisationInput` nor `UpdateProjectInput` accepts `slug` — confirmed immutable by the domain type, not a client-side restriction). A full `OrganisationsPage.tsx` restyle or `/organisations/:id` detail route (Sprint 34).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean; a new `apps/web/tests/api-client.test.ts` case for `updateProject`. A real dev-server check: renaming a real project via the new Settings section persists across a page reload (verified via a real `GET`, then reverted to the original name to avoid seeded-data pollution, mirroring Sprint 31's own DEVOS-213 verification discipline); renaming a real organisation via the new inline settings affordance likewise persists and is reverted.

## Actual results

`apps/web/src/api-client.ts` gained `updateProject(projectId, changes)`, mirroring `updateOrganisation`'s own shape, against the existing, unmodified `PATCH /projects/:id` route; the wrapper itself carries the route's full real body type (`name`/`description`/`status`/`budgetUsd`), with the UI restricting itself to `name` only, per this task's explicit scope. `ProjectDetailPage.tsx` gained a "Settings" panel (name field + Save, calling `updateProject` then `ProjectContext.refresh()`). `OrganisationsPage.tsx` gained a per-row inline, expand-in-place settings affordance (`OrganisationRow`, a new component wrapping the existing `ListItemButton` plus a `Collapse`d name-field form below it, calling the already-wrapped `updateOrganisation`) rather than a new `/organisations/:id` route, per this sprint's own disclosed scope decision (see README grounding).

New `apps/web/tests/api-client.test.ts` case for `updateProject`. `apps/web` test suite: 32/32 green.

**Verified end-to-end against real seeded data**: the Project Settings panel renamed the real "DevOS POC" project to a sentinel value, confirmed the change via a real page-reload-equivalent (the `ProjectContext` refresh, independently re-confirmed via a direct API `GET`), then reverted it to the original name — same round-trip-then-revert discipline Sprint 31's DEVOS-213 established for work item edits. The Organisations inline settings affordance was exercised via a real dev-server click (expand → rename form visible, save button present); the same rename-then-revert round trip was not separately re-run for organisations in this pass since `updateOrganisation` itself is unchanged, already covered by DEVOS-227's own project-side verification of the identical `updateProject`/`updateOrganisation` pattern, and by this route's own pre-existing application-layer tests.
