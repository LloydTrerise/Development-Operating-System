# DEVOS-285 — `USER_IDENTITY` wired to the existing OIDC provider

**Priority:** P1
**Depends on:** DEVOS-284.
**Depended on by:** none within this sprint.

## Scope

New `user_identities` table records `(provider, provider_subject)` per login; the existing generic `createOidcAuthProvider` path populates/looks up `USER_IDENTITY` on login without behavior change to authentication itself.

## Implementation

- Migration `0046_user_identities.ts` — `user_identities(id uuid pk, principal_id text fk -> principals.id, provider text, provider_subject text, created_at)`, unique on `(provider, provider_subject)`.
- `provider_subject` is deliberately identical to `principal_id`/the OIDC `sub` claim — a real login record layered on the existing identity, not a second identity namespace.
- `provider` is a fixed literal (`'oidc'`), not per-issuer — this codebase's OIDC verifier is already generic (works against any issuer without a branded implementation), and one DevOS deployment has exactly one configured issuer, so there is nothing a second provider value would distinguish.
- `packages/application/src/principals/ensure-human-principal.ts`/`ensure-user-identity.ts` — `ensureHumanPrincipal` (get-or-create `PRINCIPAL`+`HUMAN_PROFILE`) and `ensureUserIdentityForLogin` (calls the former, then get-or-creates the `USER_IDENTITY` row).
- `apps/api/src/app.ts` — `createOidcAuthProvider`'s own verification logic is completely untouched. A new, separate, best-effort hook fires right after `authProvider.authenticate(...)` resolves a non-null principal: `void ensureUserIdentityForLogin(...).catch(...)`, fire-and-forget so a recording failure can never fail the real request. Constructed (`userIdentityDeps`) only when a real OIDC provider is actually active (`AUTH_ISSUER_URL`/`AUTH_AUDIENCE` both configured) — never for `createLocalAuthProvider`'s dev-mode bearer-token-as-id path, so every existing test (none of which sets those two variables) never reaches this code at all.
- `packages/identity` stays dependency-free of `@devos/database` — the hook lives in `apps/api`'s own composition root (where the real DB dependency already legitimately lives), not inside the pure `createOidcAuthProvider` factory, per `AGENTS.md` §13's package-boundary discipline.

## Out of scope

Any per-organisation SSO configuration UI (the backlog's own §4 exclusion — the underlying OIDC provider is already generic). Multi-provider support beyond the single fixed `'oidc'` literal.

## Acceptance

`pnpm --filter @devos/api typecheck build` clean. A real authenticated OIDC request records exactly one `USER_IDENTITY` row (idempotent across repeated logins). Zero existing test reaches the new code path (none configure a real OIDC provider).

## Actual results

Implemented as planned. No live OIDC identity provider is configured in this environment (matching this codebase's own established precedent — e.g. Sprint 27's GitHub/GitLab credential disclosure), so end-to-end verification against a genuine IdP is unverified here; the request-path wiring itself is real code, not a stub, and was verified for real via three new `apps/api/tests/app.test.ts` cases using `CreateAppOptions.userIdentityDeps` as an injected override (the same override-for-testability convention every other deps bag in this file already uses): a real authenticated request records exactly one `USER_IDENTITY`+backing `PRINCIPAL`, an unauthenticated request records nothing, and — the default configuration every other test in this suite already exercises — no real OIDC provider wired means the hook never fires at all. `pnpm --filter @devos/api typecheck lint test build` clean (102/102 tests green, up from 99, zero regression). Full monorepo validation and the full `tests/e2e` suite (see DEVOS-287) confirm zero behavior change for every existing test, which never configures `AUTH_ISSUER_URL`/`AUTH_AUDIENCE`.
