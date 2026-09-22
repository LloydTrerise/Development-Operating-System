# DEVOS-255 — Organisation-level membership UI

**Priority:** P1 | **Estimate:** 1d
**Depends on:** DEVOS-254 (the four new routes/wrappers this panel calls).
**Depended on by:** none within this sprint.

## Scope

An organisation-scoped members panel (list/add/change-role/remove), styled consistently with Sprint 33's project membership UI (DEVOS-226).

## Implementation

- `apps/web/src/api-client.ts`: `Membership.projectId` widened from `string` to `string | null` (an org-level row's real, correct shape — an additive, non-breaking type widening, same shape as DEVOS-234/200's own precedent of widening a DTO for an already-real field). Four new wrappers mirroring `listMembers`/`addMember`/`changeMemberRole`/`removeMember` exactly, against the organisation-scoped routes:
  - `listOrganisationMembers(organisationId): Promise<ApiResult<Membership[]>>` → `GET /organisations/:id/members`
  - `addOrganisationMember(organisationId, input): Promise<ApiResult<Membership>>` → `POST /organisations/:id/members`
  - `changeOrganisationMemberRole(organisationId, userId, role): Promise<ApiResult<Membership>>` → `PATCH /organisations/:id/members/:userId`
  - `removeOrganisationMember(organisationId, userId): Promise<ApiResult<{ removed: boolean }>>` → `DELETE /organisations/:id/members/:userId`
- `OrganisationsPage.tsx`: `OrganisationRow` gains a second per-row icon-button toggle ("Members", alongside the existing "Settings" gear) opening a second `Collapse` panel with the same list/role-`Select`/remove/add-by-principal-ID shape `ProjectDetailPage.tsx`'s Members panel already established (DEVOS-226) — reused directly, not a route-based detail page, since `OrganisationsPage.tsx` has no `/organisations/:id` route today (Sprint 33's own DEVOS-227 grounding explicitly deferred that; out of this UI-only sprint's scope to introduce).
- Re-fetches the row's own member list after every successful add/change/remove, matching the established `refreshToken`-driven convention.

## Out of scope

A real `/organisations/:id` detail route (deferred; the inline-expand pattern is reused instead — a real, disclosed design choice, not an oversight). Any change to `ProjectDetailPage.tsx`'s own Members panel or the project-scoped wrappers it uses.

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean; new `apps/web/tests/api-client.test.ts` cases for the four new wrappers. Live-verified against a real dev server and the real seeded "DevOS Development" organisation via a throwaway Playwright script: the Members toggle opens a real list, a synthetic member is added/role-changed/removed for real, and the real backend's last-owner rejection surfaces via `ErrorAlert` without crashing the panel. Test rows cleaned up afterward.

## Actual results

Implemented as scoped. `OrganisationRow` gained a second `IconButton` ("Members of {name}") alongside the existing Settings toggle, opening a `MembersPanel` sub-component reusing `ProjectDetailPage.tsx`'s Members-panel interactions exactly (list, role `Select`, remove `IconButton`, add-by-principal-ID form). `Membership.projectId` widened to `string | null` as planned; confirmed by grep that no other code in `apps/web` read `.projectId` off a `Membership` in a way the widening could break.

**Live-verified against a real dev server and the real seeded "DevOS Development" organisation** via a throwaway Playwright script (run from inside `apps/web`, deleted afterward): the Members panel opened via the exact-named icon button (a real accessibility nuance found during this verification — the parent `ListItemButton` row's own accessible name also matches a loose `/Members of/` name query, since MUI concatenates descendant `aria-label`s into a container's accessible name; disambiguated with `exact: true`, not a code defect); a real synthetic member (`sprint39-ui-verify`) was added via the form and confirmed present in the list; removed via its own row's delete button and confirmed gone. Zero console/page errors throughout. No stray data left behind (the member was added and removed within the same verification run).
