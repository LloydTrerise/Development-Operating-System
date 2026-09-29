# DEVOS-349 — Validation, documentation, and closing disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-345, DEVOS-346, DEVOS-347, DEVOS-348.
**Depended on by:** none.

## Scope

Full monorepo validation (including the full real `tests/e2e` suite), and a closing disclosure covering this standalone sprint and its relationship to candidate Epic E31's own six-item consolidated gap list.

## Real bugs found

None in the shipped code. One real, significant finding during implementation, already fully accounted for in `DEVOS-347.md`: DEVOS-347's own originally-planned fix was built on a factually inaccurate premise inherited from `DEVOS-340.md`/`DEVOS-344.md`'s own prior disclosure ("disabling your only LLM provider loses INITIALISED status") — `hasLlmProvider` has always checked row existence, never `status`, so that scenario never reproduces. Caught by this task's own route-level test failing, investigated per `AGENTS.md` §17, resolved by explicit user decision to revert the fix and correct the record rather than ship a change for a non-existent bug. See `DEVOS-347.md` for the full account.

## Validation

Package-scoped validation for every touched package was run as each task completed (`@devos/contracts`, `@devos/domain`, `@devos/database`, `@devos/application`, `@devos/api`, `@devos/web`, `@devos/e2e-tests` — typecheck/lint/test/build each clean at the time).

**Full monorepo:** `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests' --force` — **76/76 tasks successful, zero failures** — exactly matching Sprint 60's own baseline (no package added or removed this sprint; `@devos/database`'s new migration/repository files and `@devos/application`'s new principals/organisations files are additions within existing packages). The pre-existing `access-control` "Failed to load access control catalogue" stderr noise during `@devos/api#test` is the same unrelated, disclosed noise every prior sprint has already recorded (gap 6 — confirmed still present, still untouched, still out of scope).

**Full e2e suite:** `pnpm --filter @devos/e2e-tests test` — **29 files / 57 tests, all green** — one file and three tests more than the epic's own established 28-file/54-test baseline (Sprint 58/59/60), a deliberate, disclosed addition: DEVOS-346's own new `organisation-creation-atomicity.test.ts`, mirroring `approval-atomicity.test.ts`'s established real-Postgres atomicity-proof pattern. No existing e2e file needed updating — direct inspection confirms why: DEVOS-345 added a new, additive route and table with no existing caller; DEVOS-346 changed `createOrganisation`'s internal write mechanism but not its external behavior or signature (proven by the pre-existing `organisations.test.ts` registration-token-gate tests passing unchanged); DEVOS-347 was fully reverted; DEVOS-348 is `apps/web`-only.

`pnpm --filter @devos/e2e-tests typecheck lint` — both clean, run separately (outside the `--filter='!@devos/e2e-tests'` full-monorepo pass above, per that pass's own established exclusion).

`npx prettier --check` on every file this sprint touched or added — five files needed one `--write` pass (test files and the two new small route/use-case files); all clean on re-check, and every affected test suite (`@devos/application`, `@devos/api`, the new e2e file) was re-run afterward to confirm the reformatting changed nothing behaviorally.

## Real end-to-end proof

DEVOS-345: a real, live route-level test (`apps/api/tests/app.test.ts`) proves `grantPlatformOperator`/`revokePlatformOperator` each write a real `platform_audit_records` row, and `GET /platform-audit-records` returns them in order, gated to platform operators only.

DEVOS-346: `tests/e2e/organisation-creation-atomicity.test.ts` proves, against real Postgres: (a) a real success commits the organisation, membership, ownership, and token redemption together; (b) a real forced crash mid-transaction (after three of the four writes genuinely executed) leaves *none* of them applied — the organisation row does not exist, the token is still `ACTIVE`; (c) the real `createOrganisation` use case, exercised end-to-end through its new transactional path, still correctly rejects reusing an already-redeemed token.

DEVOS-347: reverted — no fix to prove. Its replacement test proves the *actual* (previously misunderstood) behavior: disabling an organisation's only LLM provider does not lose `INITIALISED` status.

DEVOS-348: both `apps/api` and `apps/web` dev servers were started for real; a temporary real organisation was created, exercised via a real headless-Chromium Playwright session against the live app (confirming the exact `scrollIntoView({behavior: 'smooth', block: 'nearest'})` call fired, plus a full-page screenshot confirming the panel opened correctly), then the temporary organisation and its one membership row were fully deleted — verified zero residue left. Full account and evidence in `DEVOS-348.md`.

Gap 4 (dev-database residue): resolved separately, outside this sprint's own scope, before any implementation began (see `specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §2.4) — the one confirmed `organisations` row and its 4 dependent `job_roles` rows were deleted with the user's explicit approval, verified gone by re-query.

## Written confirmation: what this sprint added, and what stayed the same

**What was added:**

- A new, separate `platform_audit_records` table/domain type/repository/route (`DEVOS-345`) — `AuditRecord`'s own shape and invariants are completely untouched.
- A real database transaction spanning organisation creation, membership creation, ownership assignment, and token redemption (`DEVOS-346`), via a new `CreateOrganisationTransactionally` port mirroring this codebase's own established `withTransaction` adapter pattern.
- One new permanent e2e regression test file (`organisation-creation-atomicity.test.ts`) and one new permanent api-level regression test (disabling an organisation's only LLM provider does not lose `INITIALISED` status).
- A corrected, more precise record for gap 3, replacing three sprints' worth of an inaccurate disclosure.
- A small `apps/web` UX fix (`DEVOS-348`) — the setup checklist's "Configure an AI provider" action now scrolls its own row into view first.

**What stayed completely unchanged:** `AuditRecord`'s shape and every one of its 113 existing call sites; `createOrganisation`'s external behavior, signature, and error messages (only its internal write mechanism changed); the initialisation-status computation (`getOrganisationInitialisationStatus`, Sprint 58) and the enforcement guard (`requireOrganisationInitialised`, Sprint 59) — neither was touched, per Decision 2's explicit scope boundary; every one of the 47 gated / 3 exempt-setup / 12 exempt-unscoped routes' own disposition (Sprint 59, `DEVOS-338.md`'s audit table) — unchanged, confirmed by DEVOS-347's own full revert leaving `apps/api/src/http/organisation-scope.ts` and `apps/api/src/routes/organisation-llm-providers.ts` byte-identical to their pre-sprint state.

## Gaps disclosed at this sprint's close

Consolidated against `DEVOS-344.md`'s own six-item list:

1. **Gap 1 (no platform-operator audit trail) — CLOSED** by `DEVOS-345`.
2. **Gap 2 — PARTIALLY CLOSED.** 2a (organisation creation + token redemption transaction) closed by `DEVOS-346`. 2b (the initialisation guard's own read vs. the gated route handler's own write, across all 47 gated routes) remains an accepted, disclosed race — per Decision 2, deliberately not attempted this sprint; closing it for real would require threading a shared transaction through every one of those 47 handlers' own dependency injection, realistically its own multi-sprint effort.
3. **Gap 3 — CORRECTED, not closed, because there was nothing to close.** The scenario `DEVOS-340.md`/`DEVOS-344.md` disclosed does not reproduce against the real code. Full account in `DEVOS-347.md`.
4. **Gap 4 (dev-database residue) — RESOLVED**, separately, outside this sprint's own scope, before implementation began.
5. **Gap 5 (checklist scroll-to) — CLOSED** by `DEVOS-348`.
6. **Gap 6 (pre-existing `@devos/api` test stderr noise) — still open, still unrelated to this epic, still untouched**, exactly as every prior sprint has already disclosed.

**New finding, disclosed but not acted on (out of this sprint's own scope):** while investigating real organisation data for DEVOS-348's live verification, a direct query found the real dev Postgres database's `seed-user` principal holds roughly 100 duplicate `memberships` rows on the real `DevOS Development` organisation (mostly `OWNER`, a few `ORGANISATION_ADMIN`), evidently accumulated from repeated pilot/manual-verification runs across many prior sessions — `createMembershipRepository.create()`'s own get-or-create-principal logic does not also deduplicate the membership row itself. This is real, shared dev-database state, not something this sprint created or is scoped to fix — surfaced here for the user's own awareness, deliberately not touched, mirroring the same caution gap 4 itself received before any deletion happened.

Per the user's own established governance (`AGENTS.md` §4.1/§4.2/§19/§31), Sprint 61 is implemented and fully validated. Marking it COMPLETE in `DEVOS-ROADMAP.md`/`DEVOS-BUILD-STATE.md` requires the user's own separate, explicit approval — not assumed here.
