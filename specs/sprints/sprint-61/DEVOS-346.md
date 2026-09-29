# DEVOS-346 — Transactional organisation creation + token redemption

**Priority:** P2 | **Estimate:** 0.5d
**Depends on:** none.
**Depended on by:** DEVOS-349.

## Scope

Close gap 2a (`specs/sprints/sprint-60/DEVOS-344.md`'s closing disclosure; `specs/sprints/sprint-57/DEVOS-332.md`): `createOrganisation` (`packages/application/src/organisations/create-organisation.ts:76-101`) currently runs `organisations.create` → `memberships.create` → `organisations.setOwnerPrincipalId` → `registrationTokens.markRedeemed` as four separate, sequentially-committed writes, with a disclosed crash window between them. This codebase already has an established, precedented pattern for exactly this shape — `createDecideApprovalAndTransition` (`packages/database/src/repositories/decide-approval-and-transition.ts`, DEVOS-111) and `createOrganisationLlmProviderReorderer` (`organisation-llm-providers.ts:91-124`, DEVOS-321) both wrap a multi-repository-call sequence in one `withTransaction` block via a port declared in `@devos/application` and implemented in `@devos/database`. Per Decision 2 (`specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §6), only this piece (2a) is fixed — the initialisation guard's read vs. the gated handler's write (2b) stays an accepted, disclosed race; no code change there.

## Implementation

- New port type in `packages/application/src/organisations/deps.ts`: `CreateOrganisationTransactionally = (organisation: Organisation, membership: Membership, tokenId: string, now: string) => Promise<void>`, added as a required field on `OrganisationUseCaseDeps`, mirroring `ReorderOrganisationLlmProviders`'s own declared-port precedent exactly.
- New real implementation `packages/database/src/repositories/create-organisation.ts` (`createOrganisationTransactionCreator(db: Kysely<Database>): CreateOrganisationTransactionally`) — inside one `withTransaction(db, ...)` call: `createOrganisationRepository(trx).create(organisation)`, `createMembershipRepository(trx).create(membership)`, `createOrganisationRepository(trx).setOwnerPrincipalId(organisation.id, membership.principalId, now)`, `createRegistrationTokenRepository(trx).markRedeemed(tokenId, membership.principalId, organisation.id, now)` — same four calls `create-organisation.ts` (application) makes today, same order, now one atomic commit.
- `createOrganisation` (application) keeps its own existing validation and token-lookup-by-hash exactly as-is (a read, not part of the write-atomicity concern this task closes), then replaces its four sequential `await deps.*` write calls with one `await deps.createOrganisationTransactionally(organisation, membership, token.id, now)`.
- Wire into `apps/api/src/app.ts`: `organisationDeps.createOrganisationTransactionally: createOrganisationTransactionCreator(database.db)`.
- Update `packages/application/tests/organisations.test.ts`'s existing fake `OrganisationUseCaseDeps` to implement the new port (an in-memory fake performing the same four steps against its own fakes, non-transactionally — consistent with how every other fake port in this test suite already works).

## Out of scope

Gap 2b (the initialisation guard's read vs. the gated route handler's write, across all 47 gated routes) — per Decision 2, explicitly not attempted this sprint.

## Acceptance

A real, live test proving: a simulated failure between the transaction's own internal steps leaves neither the organisation nor the token-redemption committed (or, at minimum, unit/integration coverage proving the four writes now execute inside one `Kysely` transaction, consistent with `decide-approval-and-transition.test.ts`'s own established atomicity-proof pattern if one exists, else a direct equivalent). `createOrganisation`'s own existing behavior (validation errors, token-status errors, the resulting `Organisation` shape) is completely unchanged for the success path. Package-scoped `pnpm --filter @devos/application --filter @devos/database --filter @devos/api typecheck lint test build` clean.
