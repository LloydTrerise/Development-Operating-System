# Sprint 47 — Access Role Catalogue & Organisation Owner/Admin

**Source:** `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §5/§6.2 (candidate epic E29, Identity & Access Control Redesign).
**Conversion date:** 2026-09-23
**Status:** Converted and executed per explicit user authorization ("Proceed with sprint. Run through sprint fully without waiting for authorisation after each task. Stop once sprint is done", 2026-09-23), in direct response to a position report confirming Sprint 46 complete and Sprint 47 the recorded next item, per `AGENTS.md` §35/§4.2.

## Goal

Replace `packages/domain/src/projects/authorization.ts`'s hardcoded `role === 'OWNER'` checks with a real, seeded `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` catalogue (zero behavior change), then build the organisation owner/admin model on top of it: a single transferable `owner_principal_id` plus an `ORGANISATION_ADMIN` co-admin pool replacing Sprint 39's org-level `OWNER`/`MEMBER` rows, and a real `effective_project_access` view giving admins/owner organisation-wide project reach.

## Grounding (confirmed by direct code inspection and live Postgres verification at implementation time)

- `packages/domain/src/projects/authorization.ts` had nine functions, each `return role === 'OWNER'` — no catalogue of any kind existed.
- `listProjectsForPrincipal` (`packages/application/src/projects/list-projects-for-principal.ts`) already treated *any* org-level (`projectId: null`) membership row as organisation-wide list access regardless of role — meaning dropping the org-level `MEMBER` concept (decision §9.3) needed no code change there, only removing the rows themselves (migration `0048`).
- `createOrganisation` (Sprint 39-era, predates this sprint) always creates exactly one org-level `OWNER` membership row for the creator — confirmed by reading the function and by a live Postgres query showing the one real organisation ("DevOS Development") has exactly one org-level row, role `OWNER`, principal `seed-user`.
- `resolveOrganisationMembership`'s existing "any org-level row, else fall back to a project-level `OWNER`" logic (`packages/application/src/organisations/membership-access.ts`) needed zero changes — it is already role-agnostic for the org-level branch.

## Real bugs found and fixed during implementation (not just disclosed)

1. **`organisations.owner_principal_id` FK-ordering bug** — `organisations.owner_principal_id` has a real FK to `principals.id`, but `createOrganisation`'s original draft set it inline on the same `INSERT` that creates the organisation, before the creator's `principals` row exists (that row is only get-or-created inside `createMembershipRepository.create()`, which itself needs the organisation to already exist for `memberships.organisation_id`'s own FK). A real Postgres foreign-key violation surfaced this during live HTTP verification (`POST /organisations` returned a 500). Fixed by creating the organisation without an owner, then the membership (creating the backing principal as a side effect), then setting `owner_principal_id` via the same `setOwnerPrincipalId` method the ownership-transfer use case uses.
2. **`seed.ts`'s ownerless-org gap** — found while fixing bug 1: a genuinely fresh `migrate`+`seed` database (no prior history for migration `0048`'s own backfill to find) would leave the seeded organisation with `owner_principal_id: null` and zero org-level `ORGANISATION_ADMIN` rows, since `seed.ts` inserts memberships directly (bypassing the repository) and never created an org-level row at all. Fixed by adding a real org-level `ORGANISATION_ADMIN` membership for `SEED_PRINCIPAL_ID` plus an `owner_principal_id` update to `seed.ts`, mirroring Sprint 46's own identical fix for `principals`. Verified live: running `seed` again against this already-migrated real environment (which already had a pre-existing org-level row from Sprint 39's own live verification) produced one harmless duplicate co-admin row for the same principal — found, understood, and cleaned up directly against real Postgres; disclosed as a real observation, not silently hidden.
3. **`OrganisationsPage.tsx`'s full-list-remount-on-refresh bug** — pre-existing since DEVOS-227/255 (a rename or add-member `onSaved()` call already triggered it), only made newly consequential by DEVOS-293's own transfer-ownership action. `OrganisationContext`'s `refresh()` set `loading: true` on every call, and `OrganisationsPage.tsx` only renders its `<List>` while `!loading` — so every background refresh briefly unmounted (and reset the local expand/collapse state of) every `OrganisationRow`. Found live in a real Chromium browser via Playwright: transferring ownership made the just-expanded Members panel silently vanish with no visible confirmation. Root-caused via a minimal reproduction (rename also collapses the panel, independent of anything Sprint 47 added) and fixed at the source: `OrganisationProvider` now only shows the loading state on the very first load (`hasLoadedOnce` ref), not on background refreshes.

## In scope

- **DEVOS-288** — `access_roles`/`permissions`/`role_permissions` tables, migration `0047`, seeded to reproduce today's nine `canX()` grants exactly.
- **DEVOS-289** — `authorization.ts`'s functions become catalogue-driven via a hot-swappable in-memory cache (`packages/domain/src/access-control/permission-catalogue.ts`), loaded from the real tables at `apps/api` boot; every existing call site and the pre-existing `packages/domain/tests/authorization.test.ts` are unmodified and pass unchanged.
- **DEVOS-290** — `organisations.owner_principal_id` (migration `0048`) + a new `ORGANISATION_ADMIN` access role; org-level `OWNER` rows migrate to it (co-admin pool), org-level `MEMBER` rows are dropped (decision §9.3); a new `transferOrganisationOwnership` use case and `POST /organisations/:id/transfer-ownership` route.
- **DEVOS-291** — `effective_project_access` Postgres view (migration `0049`), the source document's view applied at organisation scope (no `DIVISION` tier, decision §9.2).
- **DEVOS-292** — `listProjectsForPrincipal` wired to the view via an optional `listEffectiveProjectIdsForPrincipal` dependency, confirmed to return identical results for existing project members and additionally surface every project in an organisation for its admins/owner.
- **DEVOS-293** — `OrganisationsPage.tsx`'s Members panel: an "Owner" badge, a role-picker-free add-admin form (only `ORGANISATION_ADMIN` is valid at org scope now), and a "Transfer ownership" action visible to the current owner.
- **DEVOS-294** — Validation, documentation, and gap disclosure.

## Out of scope

Agent principal/attribution (Sprint 48). Job role catalogue (Sprint 49). Work item assignment/hierarchy (Sprint 50). Any `DIVISION`/tenant tier (resolved as unnecessary, backlog §9.2). Any change to `AGENT_CREDENTIAL`/agent authentication (resolved as unnecessary, backlog §9.7).

## Task index

| ID        | Story                                                           | File           |
| --------- | ---------------------------------------------------------------- | -------------- |
| DEVOS-288 | `ACCESS_ROLE`/`PERMISSION`/`ROLE_PERMISSION` tables, seeded       | `DEVOS-288.md` |
| DEVOS-289 | Replace hardcoded `canX()` checks with catalogue lookups          | `DEVOS-289.md` |
| DEVOS-290 | `organisations.owner_principal_id` + `ORGANISATION_ADMIN` role    | `DEVOS-290.md` |
| DEVOS-291 | `effective_project_access` view                                   | `DEVOS-291.md` |
| DEVOS-292 | Wire the view into project-list/authorization middleware          | `DEVOS-292.md` |
| DEVOS-293 | Minimal organisation admin UI                                     | `DEVOS-293.md` |
| DEVOS-294 | Validation, documentation, and gap disclosure                     | `DEVOS-294.md` |
