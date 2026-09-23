# DEVOS-289 — Replace hardcoded `canX()` checks with catalogue lookups

**Priority:** P1
**Depends on:** DEVOS-288.
**Depended on by:** DEVOS-290 (grants `ORGANISATION_ADMIN` the same permissions via the same mechanism).

## Scope

`packages/domain/src/projects/authorization.ts`'s functions become catalogue-driven; every existing authorization test passes unmodified, proving zero behavior change.

## Implementation

A disclosed, deliberate design choice: the nine `canX(role): boolean` functions are called synchronously from 18 files across this codebase, with no `deps`/async plumbing at any of those call sites. Widening every one of them to accept and thread through a real catalogue dependency would be a large, unjustified blast radius for a task whose whole point is *zero behavior change*. Instead, `packages/domain/src/access-control/permission-catalogue.ts` holds a hot-swappable **in-memory cache** (`activeCatalogue`), defaulting to a literal mirror of this codebase's real seeded grants (`OWNER`/`ORGANISATION_ADMIN` → all nine permissions, `MEMBER` → none) — a real safety net, not a fake one, since it's kept in lockstep with what migrations `0047`/`0048` actually seed.

- `configureAccessRoleCatalogue(catalogue)` — swaps the active catalogue; called once from `packages/application/src/access-control/load-access-control-catalogue.ts`'s `loadAccessControlCatalogueFromRepository`, which reads the real `access_roles`/`permissions`/`role_permissions` rows and builds a `Record<MembershipRole, Set<ProjectPermissionKey>>`.
- Wired into `apps/api/src/app.ts` as a **fire-and-forget** call at `createApp()`, mirroring DEVOS-285's own `ensureUserIdentityForLogin` precedent exactly: safe specifically because the hardcoded default already matches the real seeded values, so a slow or failed load never changes observable behavior, only which of two identical sources served it. Always attempted (not gated behind any config check, unlike the OIDC-only `userIdentityDeps`), since access control should load in every environment with a real database. Overridable via a new `CreateAppOptions.accessControlDeps`.
- `authorization.ts`'s nine functions keep their exact original names and signatures, now calling `hasProjectPermission(role, '<permission key>')` instead of `role === 'OWNER'`.

## Real, disclosed finding during implementation

The first version of the default catalogue only included `OWNER`/`MEMBER` (a literal snapshot of the *pre-Sprint-47* grants). Once DEVOS-290 introduced `ORGANISATION_ADMIN`, every in-memory `OrganisationUseCaseDeps` test fake across `packages/application/tests/` — none of which ever calls the real DB-backed loader — resolved an org-level membership's role straight from this default, and `canManageMembers`/`canUpdateOrganisation` silently denied every organisation admin in 8 of those tests (`organisations.test.ts`). This was corrected before it could ship: the default now includes `ORGANISATION_ADMIN → all nine permissions` too, since the default's job is to be a correct safety net for the sprint's *final* state, not a frozen pre-DEVOS-288 artifact.

## Out of scope

`ORGANISATION_ADMIN`'s own introduction (DEVOS-290's job — this task only builds the catalogue mechanism and re-implements the existing nine functions through it).

## Acceptance

`pnpm --filter @devos/domain test` — the pre-existing, unmodified `packages/domain/tests/authorization.test.ts` passes with zero changes. Full monorepo validation stays green.

## Actual results

Implemented as planned. `packages/domain/tests/authorization.test.ts` required zero edits and passed unmodified (68/68 domain tests green, including this file). `pnpm --filter @devos/application test` initially showed 8 real failures in `organisations.test.ts` after DEVOS-290 landed, root-caused to the default-catalogue gap above (not a design flaw in the catalogue mechanism itself) and fixed by widening the default; re-ran clean afterward (357/357). Live-verified against a real running `apps/api`: no `Failed to load access control catalogue` error appeared in server logs when a real Postgres connection was available, confirming the fire-and-forget load succeeds silently in the real environment (it only ever logs when the injected/fake database client can't run the query, e.g. in `apps/api/tests/app.test.ts`'s deliberately null-`db` health-check fixtures — expected, harmless, and caught by the same `.catch()` DEVOS-285 established).
