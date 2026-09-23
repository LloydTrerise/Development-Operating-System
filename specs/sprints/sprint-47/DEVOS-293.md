# DEVOS-293 — Minimal organisation admin UI

**Priority:** P1
**Depends on:** DEVOS-290.
**Depended on by:** DEVOS-294.

## Scope

Extends the existing `OrganisationsPage.tsx` membership UI with the new owner/co-admin distinction (list, add/remove co-admin, transfer ownership).

## Implementation

`MembersPanel` (`apps/web/src/features/organisations/OrganisationsPage.tsx`) changes:

- The role `<Select>` is gone — there is only one valid org-level role now (`ORGANISATION_ADMIN`, decision §9.3), so "Add member" becomes "Add admin" with no role choice.
- Each row shows an "Owner" `Chip` when `member.userId === organisation.ownerPrincipalId`.
- A new "Transfer ownership" icon action appears on every *other* row, visible only when the current viewer (resolved via `useSession()`, covering both dev-identity and real-OIDC modes) is the organisation's own `ownerPrincipalId`.
- The Remove action is disabled for the owner's own row (the backend's `assertNotRemovingCurrentOwner` guard would reject it anyway; disabling it client-side avoids a confusing round-trip).

`apps/web/src/api-client.ts`: `Membership.role` widens to include `'ORGANISATION_ADMIN'`; `addOrganisationMember`'s role parameter narrows to `'ORGANISATION_ADMIN'` only; `changeOrganisationMemberRole` is removed (no UI caller needs it — the backend route still exists for API/DTO continuity, per DEVOS-290's own disclosed reasoning, just with no client wrapper); a new `transferOrganisationOwnership` wrapper calls the new route. `Organisation` gains `ownerPrincipalId?: string`.

## Real bug found and fixed during implementation

See README's "real bugs found and fixed" item 3 — `OrganisationContext`'s `refresh()` (triggered by this task's own new `onOwnershipChanged` callback after a successful transfer) was silently collapsing the just-expanded Members panel, because it set `loading: true` on every refresh and `OrganisationsPage.tsx` only renders its organisation `<List>` while `!loading`. Fixed in `organisation-context.tsx`: a `hasLoadedOnce` ref means only the *first* load shows the loading state; background refreshes (rename, add/remove member, transfer ownership — all four now, not just this task's new one) leave the already-rendered list and every row's local expand/collapse state untouched.

## Out of scope

A dedicated `/organisations/:id` detail route (deliberately deferred since Sprint 33's DEVOS-227 — this page still has no such route).

## Acceptance

Live-verified via a real browser (Playwright/Chromium) against the real dev server and API, zero console errors: create an organisation, see the owner chip, add a co-admin, transfer ownership, and see the panel correctly reflect the new owner without losing its open/expanded state.

## Actual results

Implemented as planned, plus the real pre-existing bug above found and fixed. Live-verified via a real Playwright-driven Chromium browser against the real running dev server/API (`http://localhost:5173`/`:3000`), a throwaway script run from inside `apps/web` and deleted afterward: created a real organisation through the real form; confirmed the "Owner" chip renders on the creator's own row; added a real co-admin by principal id (network response confirmed `role: 'ORGANISATION_ADMIN'`); clicked "Transfer ownership" and confirmed — *after* the `organisation-context.tsx` fix — the panel stayed open, the co-admin's row now showed the "Owner" chip (`bob text count: 1`, `Owner chip count: 1`), and the "Add admin" form remained usable; zero console errors throughout. Before the fix, the identical flow left the panel empty (`bob text count: 0`, `Owner chip count: 0`) with the transfer itself still succeeding server-side — confirming this was purely a client-side state bug, not an API defect. All real test organisations/principals created during this task's own live verification (multiple iterations while diagnosing the bug) were cleaned up directly against real Postgres afterward, confirmed zero remaining rows.
