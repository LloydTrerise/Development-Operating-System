# DEVOS-286 — `memberships.principal_id` resolves through real `PRINCIPAL` rows

**Priority:** P1
**Depends on:** DEVOS-284.
**Depended on by:** Sprint 47 (organisation owner/admin, `effective_project_access`).

## Scope

Existing authorization/lookup code paths resolve a human actor through the new `PRINCIPAL` row instead of a bare string, with identical results on every existing test — a resolution-path change, not a behavior change.

## Implementation

Grounding found exactly four real code paths that ever mint a *new* `membership.principal_id`, and all four already funnel through the same `createMembershipRepository(...).create(...)` call (`packages/application/src/projects/add-member.ts`, `packages/application/src/organisations/add-member.ts`, `packages/application/src/organisations/create-organisation.ts`, and `packages/database/src/repositories/create-project-with-clones.ts`'s own project-creation membership). Rather than widening every one of the ~15 separate `*UseCaseDeps` interfaces that also call the widely-shared `resolveMembership()` (66 call sites across `packages/application/src`) — which would demand updating every one of their own hand-built test fakes for zero behavioral benefit, since `resolveMembership()`'s own return value never needs to change — the real, minimal-surface fix lives at the one true chokepoint: `createMembershipRepository.create()` (`packages/database/src/repositories/memberships.ts`) now get-or-creates the backing `principals`+`human_profiles` rows for `membership.principalId` in the same call, before inserting the membership itself.

This makes the invariant DEVOS-284's migration only established retroactively hold permanently going forward: no `membership.principal_id` this codebase writes through the application layer is ever left without a backing `PRINCIPAL` row again. `packages/database/src/seed.ts`'s own direct inserts (bypassing this repository, per its own established convention) separately seed the same invariant for its fixed seed principals (see DEVOS-284).

Existing in-memory `MembershipRepository` test fakes used throughout `packages/application`'s own test suite are untouched and unaffected — they implement their own `create()` with no knowledge of `principals` at all, which is exactly what keeps this "identical results on every existing test": those tests exercise use-case *logic*, not this repository's own persistence side effects.

## Out of scope

Replacing `packages/domain/src/projects/authorization.ts`'s hardcoded `canX()` role checks with a catalogue lookup (Sprint 47's own job — this sprint changes nothing about *what* a role can do, only what backs a `principal_id`).

## Acceptance

`pnpm --filter @devos/database typecheck lint test build` clean. A real, brand-new `principal_id` — never seen before — gets a genuine `principals`+`human_profiles` row created the moment a membership referencing it is created, verified against real Postgres. Zero existing test's assertions change.

## Actual results

Implemented as planned. Live-verified against real Postgres with a throwaway script exercising the real `createMembershipRepository`: a never-before-seen `principal_id` had no backing `principals` row beforehand (confirmed `null`), creating a real membership referencing it produced a real `principals` row (`principalType: 'HUMAN'`) and a real `human_profiles` row in the same call, and the test data was fully cleaned up afterward (confirmed zero remaining rows). Every existing test across `@devos/database` (2/2), `@devos/application` (351/351, including this sprint's own new `principals.test.ts`, 5/5), and `@devos/api` (102/102) passed unmodified — proving "identical results on every existing test" empirically, not just asserted. Full monorepo validation and the full `tests/e2e` suite (see DEVOS-287) confirm zero regression end to end, including the several existing flows that create real memberships (project creation, add-member, organisation creation).
