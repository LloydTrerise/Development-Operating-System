# DEVOS-326 — Deploy-time bootstrap platform operator

**Priority:** P1
**Depends on:** DEVOS-325 (`platform_operators` table/repository).
**Depended on by:** DEVOS-327 (there must be a first operator able to grant a second one); Sprint 57 (registration-token issuance needs at least one real platform operator to exist).

## Scope

A single, optional, deploy-time environment variable naming a bootstrap principal. On that principal's first authenticated request after this sprint ships, if `platform_operators` has zero rows, they are automatically granted platform-operator status (`grantedByPrincipalId: undefined`, the one ungranted-by-anyone row DEVOS-325's schema explicitly allows for). This is the disclosed, resolved assumption from `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §9 — the lowest-invention option consistent with this codebase's existing single-env-var-secret precedent (`GEMINI_API_KEY`, that document's §2.10). If the user wants a different bootstrap mechanism (e.g. a one-time CLI/migration command instead), that document's §9 already flags this as open to correction — confirm before implementing this task if so.

## Implementation

`packages/config/src/config.ts` gains a new optional value, `platformOperatorBootstrapSubject` (read via the existing `optional(raw.DEVOS_BOOTSTRAP_PLATFORM_OPERATOR_SUBJECT)` pattern, mirroring `geminiApiKey`), threaded through `DevosConfig` the same additive way.

A new application-layer use case, `packages/application/src/principals/ensure-bootstrap-platform-operator.ts` (`ensureBootstrapPlatformOperator(deps, principalId)`), is called once per authenticated request from `apps/api`'s existing auth middleware — the same chokepoint where `Principal`/`HumanProfile` get-or-create already runs (DEVOS-284/286), reused rather than adding a second one. It is a cheap no-op once bootstrapping has happened: if `platformOperatorBootstrapSubject` is unset, or the requesting principal doesn't match it, or `PlatformOperatorRepository.count()` is already non-zero, it does nothing. Only when all three conditions align (configured, matching principal, zero existing operators) does it call `PlatformOperatorRepository.create()`.

Documented in `.env.example` alongside `GEMINI_API_KEY`, with an explicit comment that this variable should be unset (or the bootstrap principal's identity kept private) once the real first platform operator has been granted, since it remains live for any future moment `platform_operators` is ever fully empty again (mitigated by DEVOS-327's own "never revoke the last operator" rule, but disclosed here as the mechanism's own known edge condition, not silently assumed safe).

## Out of scope

Any UI for this — it is a config value, not a user-facing flow. Any mechanism other than the disclosed env-var-triggered auto-grant. Revoking or rotating the bootstrap subject itself.

## Acceptance

`pnpm --filter @devos/config typecheck lint test build`; `pnpm --filter @devos/application typecheck lint test build` clean, with a new test proving: (a) with the env var unset, no grant ever happens; (b) with it set but `platform_operators` already non-empty, no second bootstrap grant happens even for the matching principal; (c) with it set, an empty table, and a matching principal's first request, exactly one `platform_operators` row is created with `grantedByPrincipalId: undefined`. Live-verified against real Postgres in `DEVOS-328.md`.
