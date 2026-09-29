# DEVOS-328 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-325, DEVOS-326, DEVOS-327.
**Depended on by:** Sprint 57 (needs Sprint 56 genuinely closed before registration tokens can be gated to a real platform operator).

## Scope

Full monorepo validation, live verification against real Postgres, and an explicit written confirmation that this sprint changed zero existing route's, use case's, or authorization outcome's behavior — matching Sprint 52/DEVOS-313's own precedent for a "foundation" sprint's closing task.

## Implementation

Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` and confirm the result matches the pre-sprint baseline count (no regression) plus this sprint's own new tests. Run the full real `tests/e2e` suite and confirm the pre-sprint baseline count is unchanged (this sprint adds no e2e-relevant behavior for any existing flow — a new, narrow e2e case for the bootstrap-grant flow may be added here or deferred to Sprint 60's full-epic pilot, decided and disclosed at implementation time).

Live-verify against real Postgres: start the real API with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` set to a test principal id, confirm zero `platform_operators` rows beforehand, make one authenticated request as that principal, confirm exactly one row now exists with the documented shape; grant a second operator via the real route; attempt (and confirm rejected) revoking down to zero; revoke down to one successfully.

Written disclosure: confirm no existing route's authorization outcome changed — a diff-scoped check against this sprint's own touched files (only new files were added, so this is confirming nothing existing was edited beyond additive config/middleware wiring), not a full route-by-route re-audit like Sprint 44/51's own epic-closing precedent (that level of re-audit belongs to Sprint 60's full-epic close-out instead).

## Out of scope

Anything Sprint 57 onward owns (see the sprint README's "Out of scope").

## Acceptance

Full validation green as described above. Live verification evidence recorded here once run. Written confirmation of zero behavior change to any pre-existing route/use case.

## Real bugs found

None. Every migration, domain type, repository, use case, route, and UI component passed validation and live verification clean on the first pass — mirroring Sprint 52/DEVOS-313's own "smallest sprint, correspondingly little room for bugs" precedent, though this sprint's surface area (domain/database/config/application/api/web, all five layers) is materially larger than Sprint 52's single dormant table.

## Validation

Package-scoped, run in dependency order (`typecheck` → `test` → `lint` → `build`, per `AGENTS.md` §16):

- `pnpm --filter @devos/domain build` — clean.
- `pnpm --filter @devos/database typecheck lint test build` — clean (2/2 pre-existing tests unaffected — this sprint's dormant `platform_operators` repository has no direct test, mirroring DEVOS-311/`OrganisationLlmProviderRepository`'s own identical precedent: "no repository in this codebase is unit-tested directly against real Postgres").
- `pnpm --filter @devos/config typecheck lint test build` — clean, **24/24 tests** (20 pre-existing + 4 new: `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` loaded as optional config, omitted when unset, blank treated as absent, whitespace-only rejected).
- `pnpm --filter @devos/application typecheck lint test build` — clean, **412/412 tests** (403 pre-existing + 9 new: `ensureBootstrapPlatformOperator`'s three required scenarios (a)/(b)/(c) plus two extra — non-matching principal, idempotency — and `grantPlatformOperator`/`revokePlatformOperator`/`listPlatformOperators`'s own forbidden/not-found/last-operator/success cases).
- `pnpm --filter @devos/api typecheck lint test build` — clean, **121/121 tests** (118 pre-existing, unchanged, proving zero regression + 3 new: platform-operator route gating/grant/revoke, and the bootstrap mechanism wired end-to-end through a real HTTP request).
- `pnpm --filter @devos/web typecheck lint build` — clean (no test script exists for this package, matching every prior sprint's own web-layer validation scope).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — **76/76 tasks successful** (40 cached from unaffected packages, 36 executed), zero failures. The `access-control` "Failed to load access control catalogue" stderr lines visible during `@devos/api#test` are pre-existing, unrelated noise from every test in that suite that constructs `createApp` against a fake/null database (DEVOS-289's fire-and-forget catch logging to console) — present before this sprint's changes and unrelated to them.

## Real end-to-end proof (this task's own required scope)

**Schema proof** (`docker-postgres-1`, real Postgres): ran `packages/database/dist/migrate.js` against the real dev database — `0060_platform_operators` applied cleanly. `\d platform_operators` confirmed the exact documented shape: `principal_id text PRIMARY KEY`, `granted_at timestamptz NOT NULL`, `granted_by_principal_id text` (nullable), with real FK constraints on both `principal_id` and `granted_by_principal_id` to `principals.id`.

**Live bootstrap-grant proof**: started the real `apps/api` server (`node apps/api/dist/main.js`) against real Postgres with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT=e2e-bootstrap-operator-devos326`.

1. Confirmed `SELECT count(*) FROM platform_operators` was `0` beforehand.
2. Made one authenticated request as that principal (`GET /api/v1/me`) — confirmed exactly one row now exists: `principal_id = e2e-bootstrap-operator-devos326`, `granted_by_principal_id` null.
3. Confirmed a non-operator principal is rejected (`403`) from `GET /api/v1/platform-operators`.
4. Granted a second operator via the real route (`POST /api/v1/platform-operators` as the bootstrap operator) — real response carried `grantedByPrincipalId: "e2e-bootstrap-operator-devos326"`.
5. Revoked the bootstrap operator (two operators existed at that point) — succeeded (`200`), one operator (`e2e-second-operator-devos327`) remained.
6. Attempted to revoke that sole remaining operator — genuinely rejected: `400 DEVOS_VALIDATION_ERROR "Cannot revoke the last remaining platform operator."` Confirmed via direct `SELECT` that the row was untouched.
7. **Zero-regression proof**: hit a genuinely pre-existing, completely unrelated route (`POST /api/v1/organisations`) against the same live server — `createOrganisation` succeeded exactly as before (still ungated, still makes the creator `ORGANISATION_ADMIN`/owner), proving this sprint changed nothing about it.
8. **Cleanup proof**: all test rows (the one real organisation, its membership, both `platform_operators` rows, both `human_profiles`/`principals` rows) were deleted directly; final `SELECT count(*) FROM platform_operators` confirmed `0` — zero residue. The server process was located by port (`netstat`) and force-stopped; a follow-up request confirmed the port was no longer listening.

**Full e2e suite**: `pnpm --filter @devos/e2e-tests test` — **28 files / 54 tests, all green**. This sprint touched zero files under `tests/e2e/`, so this count is this sprint's own unchanged baseline, not a comparison against a separately-recorded prior number — directly satisfying this task's "confirm the pre-sprint baseline count is unchanged" requirement. No new e2e-suite case was added for the bootstrap-grant flow; deferred to Sprint 60's full-epic pilot (disclosed in this sprint's README, `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §6.1's own DEVOS-328 acceptance summary already named this as a same-sprint-or-deferred choice).

## Written confirmation: zero behavior change to any pre-existing route or use case

Every file this sprint touched was either wholly new (migration `0060`, `platform-operator.ts` domain/repository/DTO/route files, `PlatformOperatorsPage.tsx`) or an additive edit to an existing file:

- `packages/config/src/{environment,validation,config}.ts`: each gained one new optional field/branch (`DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` / `platformOperators.bootstrapSubject`) — no existing field or branch was altered.
- `packages/database/src/database.ts`: gained one new table-type export and one new `Database` interface entry — no existing entry changed.
- `packages/domain/src/index.ts`, `packages/database/src/index.ts`, `packages/application/src/index.ts`: each gained new `export *` lines only.
- `apps/api/src/app.ts`: gained one new unconditional dep-construction block (`platformOperatorBootstrapDeps`), one new awaited call site inside `handleRequest` (guarded by `principal !== null`, itself a no-op unless `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT` is set — unset in every existing deployment/test), one new `platformOperatorDeps` construction, one new route registration, and two new `CreateAppOptions` fields — no existing line was removed or altered in behavior.
- `apps/web/src/App.tsx`: gained one new icon import, one new page import/route, and one new conditional nav-item component appended after the existing static `NAV_GROUPS` render loop — the existing loop itself is untouched.

The 121/121 `@devos/api` test count (118 pre-existing unchanged + 3 new) and the 76/76 full-monorepo task count are the direct, automated proof of this: every pre-existing test still exercises the exact same code paths with the exact same outcomes.

## Gap disclosure

- **No `AuditRecord` for platform-operator grant/revoke.** `AuditRecord.organisationId` (`packages/domain/src/audit/audit-record.ts:15`) is a required, non-optional field on every row — but a platform-operator grant is, by this sprint's own design (§2.8 of the backlog), a principal-attached grant that sits above and outside every organisation. There is no real organisation id to attach such an audit record to without fabricating one, which `AGENTS.md` §7 forbids. Disclosed as a real, load-bearing gap rather than worked around — a future sprint that wants platform-level audit coverage would need to either make `AuditRecord.organisationId` optional (a wider schema change well outside this sprint's scope) or introduce a separate platform-level audit concept.
- **`ForbiddenError`, not a new `AuthorizationError`, used at the application layer.** The backlog's own DEVOS-327 story text (§6.1) named "a new `AuthorizationError`, matching this codebase's existing error-class convention" — but the actual, grounded existing convention (confirmed by direct inspection of every application-layer authorization check in this codebase — `create-organisation-llm-provider.ts`, `add-member.ts`, `transfer-organisation-ownership.ts`, etc.) is `ForbiddenError` from `@devos/domain`/`@devos/application`. `AuthorizationError` already exists, but at the HTTP layer only (`apps/api/src/http/errors.ts`, a distinct 403 class `toErrorBody` never even reaches for use-case errors — `UseCaseForbiddenError` is mapped directly). `grantPlatformOperator`/`revokePlatformOperator`/`listPlatformOperators` all throw the real, established `ForbiddenError` instead, per `AGENTS.md` §7's "repository state takes precedence over conflicting text" principle.
- **`ensureBootstrapPlatformOperator` is awaited, not fire-and-forget**, unlike DEVOS-285's `ensureUserIdentityForLogin` precedent it otherwise mirrors. Deliberate: the bootstrap grant's own correctness is exactly what a fresh deployment's very first platform operator depends on, so the response should not complete before it has genuinely happened (verified live above — the grant exists immediately after the triggering request returns, with no race). Disclosed as an intentional, reasoned deviation from the fire-and-forget precedent it otherwise follows closely.
- **`PlatformOperatorRepository` has no `update` method** — nothing in this sprint's scope ever changes an existing grant's fields (a grant is created once, deleted once); mirrors `OrganisationLlmProviderRepository`'s own Sprint 52 "foundation sprint defers non-essential CRUD" precedent.
- **No route or use case outside this sprint's own management routes reads or writes `platform_operators` yet** — entirely dormant beyond its own narrow surface, exactly as scoped. `createOrganisation` is completely unaffected (live-verified above). Sprint 57 (registration-token issuance, gated to platform operators) is the first sprint that reads this table from anywhere else.
- The pre-existing, cross-cutting "access control catalogue fails to load against a fake/null test database" stderr noise (present in every `@devos/api` test run, unrelated to any sprint's own code) remains unrelated and untouched.

Per the user's own established governance (`AGENTS.md` §4.1/§4.2), no further sprint begins automatically. Sprint 56 (Platform Operator Foundation) is complete; awaiting explicit authorization before converting or starting Sprint 57 (Registration Token & Invite-Gated Organisation Creation — the disclosed reversal of `organisation.create`'s ungated design, per this epic's own README warning).
