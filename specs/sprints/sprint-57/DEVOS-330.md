# DEVOS-330 — `createOrganisation` gated behind a valid, unredeemed registration token

**Priority:** P1
**Depends on:** DEVOS-329 (`registration_tokens` table/repository).
**Depended on by:** DEVOS-332 (validation of the gate); Sprint 59 (server-side enforcement builds on an organisation now only ever being created through a controlled path); Sprint 60 (guided redemption UI).

## ⚠ This task is the disclosed reversal — re-read before starting

`packages/application/src/organisations/create-organisation.ts:6-12`'s own doc comment states: _"Any authenticated principal may create an organisation (matches today's ungated project creation)."_ `specs/sprints/sprint-51/DEVOS-310.md:46` reconfirmed this as recently as 2026-09-27, calling it _"this codebase's own longstanding, symmetric convention for both entity types."_ This task deliberately reverses that — for `organisation.create` only, `project.create` is untouched — per the user's resolved Decision 1b/2.7 in `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`. **This is real, user-visible behavior change to an existing, working route.** Confirm the user still wants to proceed with implementing this specific task now, even if Sprint 57 was authorized as a whole earlier — per that backlog's own §3 delivery principle, the reversal must be disclosed "at the exact sprint that makes it real... not buried in a later sprint's incidental change," and per this epic's own governance, at the exact task that makes it real.

## Scope

Widen `createOrganisation` to require a registration token argument. An invalid, expired, already-redeemed, or revoked token is rejected with a clear, generic error (mirroring `CredentialResolver`'s existing "never leak the secret value in an error" discipline, `AGENTS.md` §22 — the error names _why_ redemption failed, e.g. "already redeemed" vs. "expired," without echoing back the token value). A successful call atomically creates the organisation + `ORGANISATION_ADMIN` membership (DEVOS-290's existing mechanism, completely unchanged) and marks the token `Redeemed`, recording which principal and organisation redeemed it.

## Implementation

`packages/application/src/organisations/create-organisation.ts` gains a new required parameter, e.g. `registrationToken: string` (the raw token, hashed on receipt — the raw value is never persisted, matching DEVOS-329's own hash-only storage). The use case:

1. Hashes the incoming token the same way DEVOS-331's issuance does, and looks it up via `RegistrationTokenRepository.getByTokenHash()`.
2. Rejects (a new, specific `ValidationError` message — reusing the existing `ValidationError` class already imported here, not inventing a new one, per `AGENTS.md` §7 and Sprint 56's own established-convention precedent) if: no matching token exists; `status !== 'ACTIVE'`; or `expiresAt` is in the past.
3. On success, performs the existing organisation-creation sequence (DEVOS-290's create-organisation-then-membership-then-set-owner ordering, unchanged) and, in the same logical operation, calls `RegistrationTokenRepository.markRedeemed()` with the new organisation's id and the calling principal's id. Decide at implementation time whether this needs a real database transaction spanning both the organisation-creation writes and the token-redemption write (this codebase's existing transactional primitives — e.g. `DecideApprovalAndTransition` — are the precedent to follow if a partial-failure window between "organisation created" and "token marked redeemed" is judged unacceptable); disclose whichever choice is made.

`apps/api`'s organisation-creation route (`apps/api/src/routes/organisations.ts` or equivalent) is widened to accept the token in the request body, and to map the new rejection cases to a distinct, clear HTTP error (e.g. `400`/`403` — decide and disclose the exact status/error-code shape at implementation time, consistent with this codebase's existing route error-mapping conventions).

## Out of scope

Any UI for entering a token (Sprint 60's guided flow) — the API-level gate alone is this task's scope; a bare API-level token argument (no dedicated UI yet) is acceptable for this sprint, mirroring how Sprint 56's management routes shipped with only a minimal UI. Issuing/listing/revoking tokens (DEVOS-331). Any change to `project.create`.

## Acceptance

`pnpm --filter @devos/application typecheck lint test build` clean, with new tests proving: creation succeeds with a valid, unredeemed, unexpired token and the token is marked `Redeemed` recording the right principal/organisation; creation fails with no token; creation fails with an unknown token; creation fails with an already-`Redeemed` token; creation fails with a `Revoked` token; creation fails with an expired token. `apps/api` typecheck/lint/test/build clean, with a route-level test confirming the same outcomes through a real HTTP request shape. Live-verified against real Postgres in DEVOS-332 that organisation creation now genuinely fails with no token, fails with an already-redeemed/expired/revoked token, and succeeds exactly once per valid token.
