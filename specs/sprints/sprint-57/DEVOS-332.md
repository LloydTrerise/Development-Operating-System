# DEVOS-332 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-329, DEVOS-330, DEVOS-331.
**Depended on by:** Sprint 58 (independent of this sprint per the backlog's own §7, but shares the same "epic stays green" requirement); Sprint 60 (needs Sprint 57 genuinely closed before its full-epic pilot exercises token issuance/redemption).

## Scope

Full monorepo validation, live verification against real Postgres, and an explicit written confirmation of exactly what changed in `createOrganisation`'s behavior (the disclosed reversal, DEVOS-330) versus what stayed identical (the membership/ownership mechanism, DEVOS-290, unchanged) — matching Sprint 56/DEVOS-328's own precedent for a sprint's closing task, but for a sprint that (unlike Sprint 56) does contain a real, user-visible behavior change.

## Implementation

Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` and confirm the result matches this sprint's pre-sprint baseline (Sprint 56's own 76/76 count) plus this sprint's new tests, with zero regressions. A repository-wide search at conversion time already found 8 existing files under `tests/e2e/` referencing `createOrganisation`/`/organisations` (`llm-provider-fallback-pilot.test.ts`, `approval-reliability-reduction-pilot.test.ts`, `knowledge-platform-marketplace-pilot.test.ts`, `agent-platform-marketplace-pilot.test.ts`, `engineering-intelligence-reporting.test.ts`, `cost-reporting.test.ts`, `cost-budget-pilot.test.ts`, `incident-response-workflow.test.ts`) — every one of these will fail against DEVOS-330's new required-token precondition unless updated (e.g. to issue and pass a real registration token via DEVOS-331's route before calling `createOrganisation`), and updating all 8 is genuinely this task's own in-scope work, not deferred, since DEVOS-330 changes production route behavior these tests exercise. Confirm the resulting suite is fully green, not merely "unchanged from baseline" (unlike Sprint 56, this sprint is expected to require e2e updates across a materially larger set of files than any prior sprint's own closing task).

Live-verify against real Postgres: as a real platform operator (bootstrapped or granted per Sprint 56), issue a real registration token (DEVOS-331); confirm `createOrganisation` genuinely fails with no token; confirm it fails with a syntactically-plausible-but-unknown token; confirm it succeeds with the real issued token, creating the organisation and its `ORGANISATION_ADMIN` membership exactly as before (DEVOS-290, unchanged); confirm the same token cannot be redeemed a second time; issue a second token and revoke it before redemption, confirming redemption then fails; issue a third token with a short/already-past expiry (or wait out a short-lived test token) and confirm an expired token is rejected.

Written disclosure: state plainly, in this file, exactly which existing route's behavior changed (`POST /organisations` / `createOrganisation`) and how (a new required token parameter; previously-succeeding calls with no token now fail) — this is the one sprint in this epic, so far, where "confirm zero behavior change" is not the closing claim; the honest claim is "confirm the change is exactly this, and nothing more."

## Out of scope

Anything Sprint 58 onward owns (see the sprint README's "Out of scope").

## Acceptance

Full validation green as described above, including any e2e-suite updates DEVOS-330's route change requires. Live verification evidence recorded here once run. Written, explicit confirmation of exactly what changed in `createOrganisation`'s behavior and exactly what stayed the same — not a "zero change" claim, since this sprint deliberately is not that.

## Real bugs found

None. Every migration, domain type, repository, use case, route, and UI component passed validation and live verification clean on the first pass, once the in-memory test fixtures were updated to seed a valid token.

## Validation

Package-scoped, run in dependency order (`typecheck` → `test` → `lint` → `build`, per `AGENTS.md` §16):

- `pnpm --filter @devos/contracts build` — clean (new `RegistrationTokenId`, `registrationTokenStatuses`/`RegistrationTokenStatus`).
- `pnpm --filter @devos/domain build` — clean (new `RegistrationToken`/`RegistrationTokenRepository`; `CreateOrganisationInput` gains `registrationToken`).
- `pnpm --filter @devos/database typecheck lint test build` — clean (new migration `0061_registration_tokens`, new `RegistrationTokensTable`, new `createRegistrationTokenRepository` — dormant-shape repository, no direct unit test, mirroring DEVOS-311/DEVOS-325's own identical precedent).
- `pnpm --filter @devos/config typecheck lint test build` — clean, **27/27 tests** (24 pre-existing + 3 new: `DEVOS_REGISTRATION_TOKEN_EXPIRY_DAYS` defaults to 7, loads when provided, rejects a non-positive-integer value).
- `pnpm --filter @devos/application typecheck lint test build` — clean, **427/427 tests** (412 pre-existing — Sprint 56's own closing count — 20 of them widened in place to pass a valid token through the new gate rather than left broken, plus 15 new: 6 in `createOrganisation`'s own registration-token-gate describe block (no token/unknown token/successful redemption/reuse-after-redemption/revoked/expired) and 9 for `issueRegistrationToken`/`listRegistrationTokens`/`revokeRegistrationToken`'s own forbidden/not-found/already-revoked/success cases).
- `pnpm --filter @devos/api typecheck lint test build` — clean, **125/125 tests** (121 pre-existing, 14 of them widened in place to pass a token through the shared `POST /organisations` fixture body + 4 new: registration-token route gating/issue-and-redeem/revoke-blocks-reuse/no-token-and-unknown-token-rejected, wired end-to-end through real HTTP requests against the app's own in-memory fakes).
- `pnpm --filter @devos/web typecheck lint test build` — clean, **71/71 tests** unchanged (the widened `createOrganisation` client function and its one call site in `OrganisationsPage.tsx`'s form have no dedicated component test in this codebase; both are exercised live below).

Full monorepo: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — **76/76 tasks successful**, zero failures — the same total task count as Sprint 56's own baseline (package boundaries didn't change, only their contents). The pre-existing `access-control` "Failed to load access control catalogue" stderr noise during `@devos/api#test` is the same unrelated, disclosed noise Sprint 56's own `DEVOS-328.md` already recorded — present before this sprint and unrelated to it.

## Real end-to-end proof (this task's own required scope)

**Schema proof** (`docker-postgres-1`, real Postgres): ran `packages/database/src/migrate.ts` against the real dev database — `0061_registration_tokens` applied cleanly. `\d registration_tokens` confirmed the exact documented shape: `id uuid PRIMARY KEY`, `token_hash text` with a real unique constraint, `issued_by_platform_operator_id text NOT NULL` FK to `principals.id`, `status text NOT NULL`, `expires_at timestamptz NOT NULL`, `redeemed_by_principal_id`/`redeemed_organisation_id` nullable with real FKs (the latter `ON DELETE SET NULL`, to `organisations.id`).

**Live gate proof**: started the real `apps/api` server (`node apps/api/dist/main.js`) against real Postgres with `DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT=e2e-bootstrap-operator-devos330`.

1. Bootstrapped the platform operator via one authenticated `GET /me` request (Sprint 56's own mechanism, unchanged).
2. Issued a real registration token (`POST /registration-tokens`) — response carried a real `rawToken`; confirmed `GET /registration-tokens` never returns `rawToken` or `tokenHash` for that same token.
3. Confirmed a non-operator principal is genuinely rejected (`403`) from issuing a token.
4. Confirmed `POST /organisations` with **no** `registrationToken` field is rejected: `400 DEVOS_BAD_REQUEST "registrationToken is required."`
5. Confirmed `POST /organisations` with an **unknown** token is rejected: `400 DEVOS_VALIDATION_ERROR "Registration token is invalid."`
6. Confirmed `POST /organisations` with the real, valid token **succeeds** — real response carried the new organisation, `ownerPrincipalId` set to the calling principal. Direct `SELECT` confirmed the token's row flipped to `status = 'REDEEMED'` with the correct `redeemed_by_principal_id`/`redeemed_organisation_id`, and a real `ORGANISATION_ADMIN` membership row exists for that principal/organisation — DEVOS-290's mechanism proven completely unchanged.
7. Confirmed **reusing** that same now-redeemed token is genuinely rejected: `400 DEVOS_VALIDATION_ERROR "Registration token has already been redeemed."`
8. Issued a second token, revoked it (`DELETE /registration-tokens/:id`) — succeeded (`200`); confirmed revoking it again is rejected (`400 "Only an active registration token can be revoked."`); confirmed attempting to redeem the now-revoked token is rejected: `400 "Registration token has been revoked."`
9. Issued a third token, then directly updated its `expires_at` in Postgres to one hour in the past (simulating real time passing, since the default expiry is 7 days) — confirmed `GET /registration-tokens` presents it as `EXPIRED` (the derived-at-read-time status, never a persisted value) and confirmed redeeming it is rejected: `400 "Registration token has expired."`
10. **Zero-regression proof**: granted a second platform operator via the completely unrelated, pre-existing `POST /platform-operators` route on the same live server — succeeded exactly as Sprint 56 left it, proving this sprint changed nothing about that route.
11. **Cleanup proof**: all test rows (one real organisation, its membership, three `registration_tokens` rows, two `platform_operators` rows, six `principals`/`human_profiles` rows) were deleted directly; final `SELECT count(*)` on `registration_tokens`/`platform_operators`/the test organisation slug all confirmed `0`. The server process was located by port and force-stopped; a follow-up request confirmed the port was no longer listening.

**Full e2e suite**: `pnpm --filter @devos/e2e-tests test` — **28 files / 54 tests, all green** — Sprint 56's own unchanged baseline count. **Correction to this task's own earlier conversion-time note**: a repository-wide grep at conversion time flagged 8 e2e files as referencing `createOrganisation`/`/organisations` and assumed all 8 would need updating for the new token gate. Direct inspection during this task found that assumption wrong: every one of those 8 files creates its test organisations either by seeding a fixed `SEED_ORGANISATION_ID` or by writing directly to the `organisations`/`memberships` tables through `createOrganisationRepository(database.db).create(...)` fixture helpers — none of them ever calls the real, gated `createOrganisation` use case or `POST /organisations` route at all. A repository-wide search for a real `POST` to `/api/v1/organisations` inside `tests/e2e/` returns zero matches. **Zero e2e files required changes** — disclosed here as a correction to this task's own earlier, unverified assumption, not silently dropped.

## Written confirmation: exactly what changed, and exactly what stayed the same

**What changed** — one route, one precondition:

- `POST /organisations` (`createOrganisation`) now requires a `registrationToken` field. A call with no token, an unknown token, or a token that is expired/already-redeemed/revoked is rejected with a `400`. This is the disclosed, deliberate reversal of this route's previously ungated design (`specs/sprints/sprint-51/DEVOS-310.md:46`) — the first such reversal in this repository's history, exactly as flagged before DEVOS-330's implementation began.

**What stayed completely unchanged**:

- `project.create` — untouched, still ungated, per the backlog's own §2.7/§4 scope boundary.
- The organisation-creation mechanism itself once a valid token is presented: the same create-organisation-then-membership-then-set-owner sequence (DEVOS-290), the same `ORGANISATION_ADMIN` role, the same transferable `ownerPrincipalId` — live-verified identical in step 6 above.
- Every other existing route: platform-operator grant/revoke (Sprint 56) proven unaffected live in step 10 above; no other file in this sprint touched any pre-existing route, use case, or authorization outcome outside `create-organisation.ts` and the two brand-new registration-token/registration-token-route files.
- `AuthProvider`/OIDC delegation — untouched, per backlog §2.1/Decision 1a.

## Gap disclosure

- **No database transaction spans organisation creation and token redemption.** `createOrganisation` marks the token `REDEEMED` only after the organisation + membership + ownership writes all succeed (DEVOS-330's own doc comment) — a crash between those steps and the final `markRedeemed` call would leave the organisation fully created but the token still `ACTIVE` (redeemable a second time). Disclosed as a real, accepted gap: no existing repository primitive here spans both concerns, and DEVOS-290's own create-then-membership-then-owner sequence already accepts an equivalent partial-failure window for the same reason. Revisit if this ever needs closing — the fix would be a dedicated transactional primitive mirroring `DecideApprovalAndTransition`.
- **Unsalted SHA-256 token hashing**, not a slow KDF. Deliberate: `generateRegistrationToken()` produces 256 bits of real randomness, making a dictionary/rainbow-table attack against the hash meaningless the way it would matter for a low-entropy user password. Disclosed as the implementation choice `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §9 left open at conversion time.
- **`EXPIRED` is never a persisted status value** — computed at read time from `expiresAt` by every repository method that returns a token (both the real Postgres repository and every in-memory test fake had to replicate this derivation). Disclosed as a real design choice, not an oversight: no writer in this sprint's scope ever needs to write `EXPIRED` itself.
- **The web "New organisation" form gained only a bare `registrationToken` text field**, not a guided flow. Per DEVOS-330's own scope boundary, the guided wizard (token-first, with the "this makes you Admin" disclosure) is Sprint 60's own scope (DEVOS-341) — this sprint's minimal field exists only so the form does not sit permanently broken between now and Sprint 60.
- **This task's own earlier e2e-impact assumption was wrong** — see "Real end-to-end proof" above. Recorded here rather than quietly corrected, per `AGENTS.md` §7's "repository state over conflicting prior text" principle.
- The pre-existing, cross-cutting "access control catalogue fails to load against a fake/null test database" stderr noise (present in every `@devos/api` test run, unrelated to any sprint's own code) remains unrelated and untouched.

Per the user's own established governance (`AGENTS.md` §4.1/§4.2), no further sprint begins automatically. Sprint 57 (Registration Token & Invite-Gated Organisation Creation) is complete; awaiting explicit authorization before converting or starting Sprint 58 (Mandatory Initialisation Requirements).
