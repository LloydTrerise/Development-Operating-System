# DEVOS-290 — `organisations.owner_principal_id` + `ORGANISATION_ADMIN` access role

**Priority:** P1
**Depends on:** DEVOS-288/289.
**Depended on by:** DEVOS-291 (the view's owner/admin `UNION` branches), DEVOS-293 (the transfer-ownership UI).

## Scope

Existing org-level `OWNER`-role `memberships` rows migrate to the new `ORGANISATION_ADMIN` access role (the co-admin pool); one of them (or a caller-supplied principal) is set as the single transferable `owner_principal_id`, transferable only by the current owner. Existing org-level `MEMBER`-role rows are dropped per §9.3 — disclosed, not silently deleted without record.

## Implementation

Migration `0048_organisations_owner_and_admin_role.ts`:

- Adds `organisations.owner_principal_id text references principals(id)`, nullable.
- Seeds a new `ORGANISATION:ORGANISATION_ADMIN` access role and grants it the same nine permissions `0047` granted `PROJECT:OWNER` — an org admin/owner needs project-OWNER-equivalent authority on every project in their organisation, matching the `resolveMembership()` org-level fallback these permissions are checked through.
- Per organisation: finds existing org-level (`project_id IS NULL`) `OWNER` rows; if any exist, the earliest (by `created_at`, tie-broken by `id`) becomes `owner_principal_id` and *all* such rows convert to `ORGANISATION_ADMIN` (the whole co-admin pool, not just the elected owner). If none exist (a real gap the pre-existing `resolveOrganisationMembership` fallback already named), falls back to the earliest project-level `OWNER` within that organisation's own projects, excluding the known system actor (`'devos-agent-runtime'`, by literal value, matching migration `0045`'s own established exclusion convention), and synthesizes a real new org-level `ORGANISATION_ADMIN` row for that principal.
- Deletes every org-level `MEMBER` row (decision §9.3).

`packages/domain/src/projects/membership.ts`'s `membershipRoles` widens to `['OWNER', 'MEMBER', 'ORGANISATION_ADMIN']`. `ORGANISATION_ADMIN` is rejected at project scope (`projects/add-member.ts`/`change-member-role.ts`) and is the *only* accepted role at organisation scope (`organisations/add-member.ts`/`change-member-role.ts`, both now throw `ValidationError` for anything else). `packages/application/src/organisations/membership-access.ts`'s `assertNotLastOrganisationOwner` is renamed `assertNotLastOrganisationAdmin` (checks `ORGANISATION_ADMIN`, the only org-level role left) and a new `assertNotRemovingCurrentOwner` guards the specific owner row separately (a 3-admin pool could still lose its *current owner* member while two other admins remain, which the last-admin guard alone wouldn't catch). A new `transferOrganisationOwnership` use case enforces "transferable only by the current owner, to an existing `ORGANISATION_ADMIN`" and a new `POST /organisations/:id/transfer-ownership` route exposes it.

`createOrganisation` now creates the org, then the `ORGANISATION_ADMIN` membership (creating the backing principal as a side effect), then sets `owner_principal_id` — see README's "real bugs found and fixed" item 1 for why this ordering is load-bearing. `packages/database/src/seed.ts` was updated to seed the same org-level admin/owner invariant directly (see README item 2).

## Real, disclosed live-verification evidence

Against the real dev database (one organisation, one pre-existing org-level `OWNER` row for `seed-user` from Sprint 39's own live verification): the migration correctly picked `seed-user` as owner and converted that one row to `ORGANISATION_ADMIN`; zero org-level `MEMBER` rows existed to delete.

The fallback branch (no org-level row at all) was **not exercisable against real data** in this environment, so it was verified against a real, disposable Postgres database instead: a fresh `devos_fresh_verify` database was created, migrated up through `0047` only (`0048`/`0049` temporarily moved out of the migrations folder), seeded with a synthetic "legacy" organisation carrying only a project-level `OWNER` membership (the exact pre-Sprint-39 shape), then `0048`/`0049` were restored and run. Result, confirmed by direct query: `organisations.owner_principal_id` was set to the legacy project owner, and a real new org-level `ORGANISATION_ADMIN` row was inserted for them — the fallback branch works correctly. The disposable database was dropped afterward.

## Out of scope

The `effective_project_access` view itself (DEVOS-291). Any UI (DEVOS-293).

## Acceptance

`pnpm --filter @devos/database typecheck build` clean; `pnpm --filter @devos/application test` clean (with `organisations.test.ts` updated to reflect the new model, not "unmodified" — a deliberate, disclosed behavior change, unlike DEVOS-286/289's own "identical results" bar). Live-verified against real Postgres and a disposable throwaway database.

## Actual results

Implemented as planned, including both real bugs disclosed in the README (organisation-creation FK ordering; `seed.ts`'s ownerless-org gap), both found and fixed during this task's own live verification, not left as disclosed-but-unfixed gaps. `organisations.test.ts` was substantially rewritten (8 of its pre-existing tests updated for the new model; 6 new tests added for the co-admin/owner-removal guards and ownership transfer) — 20/20 tests in that file pass, 357/357 across the whole `@devos/application` package. `apps/api/tests/app.test.ts`'s two organisation-membership route tests were similarly rewritten to exercise `ORGANISATION_ADMIN`-only add, the owner-removal guard, the last-admin guard, and a real `POST /transfer-ownership` round trip — 102/102 api tests pass. Full end-to-end live verification against a real running `apps/api` (create org as alice → owner alice; reject `role: 'MEMBER'` at org scope, 400; add bob as `ORGANISATION_ADMIN`; alice tries to remove herself, 400 "transfer ownership first"; transfer to bob, 200; bob removes alice, 200; bob tries to remove himself (now sole admin and owner), 400) — every guard fired exactly as designed. All live-verification test data (organisations, memberships, principals, cloned project/workflow/agent rows) fully cleaned up afterward, confirmed zero remaining rows.
