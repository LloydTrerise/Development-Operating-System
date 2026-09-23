# DEVOS-287 — Validation, documentation, and gap disclosure

**Priority:** P1
**Depends on:** DEVOS-284, DEVOS-285, DEVOS-286.

## Scope

Full monorepo validation green; explicit written confirmation that no existing route's authorization outcome changed.

## Validation results

- `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — **76/76 tasks green**, exactly matching Sprint 45's own baseline (no new task added; `@devos/database`/`@devos/domain`/`@devos/application`/`@devos/api` all re-ran clean with this sprint's additions).
- `pnpm --filter @devos/e2e-tests test` — **27/27 files, 52/52 tests green**, matching the same established baseline.
- `prettier --check` clean across every file this sprint touched (four files needed `--write`: `packages/database/src/seed.ts`, `packages/database/migrations/0045_principals.ts`, `apps/api/src/app.ts`, `apps/api/tests/app.test.ts` — all re-verified clean afterward).
- Real Postgres migration run: `0045_principals`/`0046_user_identities` both executed successfully against this environment's own real, accumulated dev database.

## A real, disclosed environmental finding — investigated, not a code defect

The first full `tests/e2e` run showed 8/27 files failing (10/52 tests) with symptoms unrelated to this sprint's own code (`No handler registered for task type "AGENT_TASK"`; several core pre-existing flows unexpectedly reaching `FAILED` instead of `AWAITING_APPROVAL`). Rather than assume a regression, this was investigated directly: `Get-CimInstance Win32_Process` found roughly 30 stray `apps/api`/`apps/worker` dev-server processes already running before this session began (`tsx watch` instances, evidently accumulated from a prior session's own `pnpm dev`), all sharing this environment's one real Postgres database and task queue with the e2e suite's own spawned processes — the exact same class of contention this codebase has disclosed and resolved before (Sprint 19, Sprint 41, Sprint 43). Stopping every stray process and re-running produced a fully clean **27/27 files, 52/52 tests green**, confirming the failures were pre-existing session-environment contention this sprint's own code did not cause and does not need to fix.

## Confirmation: no existing route's authorization outcome changed

- `packages/domain/src/projects/authorization.ts`'s `canX()` functions are byte-for-byte unchanged — this sprint added no new authorization rule and removed none.
- `resolveMembership()` (the one function called by all 66 project-scoped authorization call sites) is byte-for-byte unchanged.
- The only runtime behavior change under real OIDC configuration (inert for every existing test and this environment's own dev setup, both of which use `createLocalAuthProvider`) is a new, best-effort, fire-and-forget side effect (`ensureUserIdentityForLogin`) that never affects the request's own response, status code, or authorization decision.
- The only runtime behavior change for membership creation is a new, additive persistence side effect (`principals`/`human_profiles` upsert) inside `createMembershipRepository.create()` — the `Membership` object returned, and every existing caller's own behavior built on top of it, is unchanged.

## Real, disclosed gaps and assumptions carried forward (not fixed — deliberately out of this sprint's scope)

- **No email is populated for any backfilled principal.** Neither `memberships` nor `audit_records` has ever stored one; DEVOS-284's own "keyed by email where resolvable" resolves to `null` for all 231 real pre-existing human actor ids in this environment. Going forward, only a real OIDC login (DEVOS-285) will ever populate `human_profiles.email` for a given principal, and only once — an existing profile's email is never overwritten by a later, different login.
- **`memberships.principal_id`/`audit_records.actor_id` carry no hard foreign-key constraint to `principals.id`.** Not every historical actor id is backed yet by design (`devos-agent-runtime` deliberately excluded, per DEVOS-284's own human-only scope) — adding one now would either break real seeded data or require fabricating an agent principal ahead of Sprint 48's own scope.
- **No live OIDC identity provider is configured in this environment**, matching this codebase's own established precedent for external-credential-dependent work (e.g. Sprint 27's GitHub/GitLab pilot). DEVOS-285's login hook is real code, verified via injected-override tests, not verified against a genuine IdP.
- **Agent identity remains entirely out of this sprint's scope.** `devos-agent-runtime` gets no `PRINCIPAL` row this sprint — Sprint 48 (`AGENT_PROFILE`) is what gives agents their own identity for attribution/ownership, never a login/credential of any kind, per the backlog's own §9.7 resolution.
- **`packages/domain/src/projects/authorization.ts`'s hardcoded `OWNER`/`MEMBER` checks are completely untouched.** This sprint changes what backs a `principal_id`, never what a role can do — Sprint 47 is the catalogue-driven replacement.

## Sprint 46 (DEVOS-284–287) is COMPLETE

Every task's own acceptance criteria are met, live-verified against real Postgres and the full real `tests/e2e` suite, with zero regression and zero visible behavior change to any existing route, use case, or test.
