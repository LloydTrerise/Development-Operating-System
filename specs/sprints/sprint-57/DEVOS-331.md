# DEVOS-331 — Platform-operator UI/API: issue, list, revoke registration tokens

**Priority:** P1
**Depends on:** DEVOS-329 (`registration_tokens` table/repository); Sprint 56's platform-operator-only authorization gate (`grantPlatformOperator`/`revokePlatformOperator`/`listPlatformOperators`'s own `ForbiddenError`-on-non-operator pattern, `apps/api/src/routes/platform-operators.ts`).
**Depended on by:** DEVOS-330 needs at least one real token issuable before its own redemption path can be exercised end-to-end; DEVOS-332 (full-sprint validation).

## Scope

Let an existing platform operator issue a new registration token (raw value shown exactly once), list all tokens with their status, and revoke an `ACTIVE` token before it's redeemed. Mirrors E30's `organisation_llm_providers` UI conventions (a value shown once at creation and never again, per `AGENTS.md` §22) and Sprint 56's own platform-operator-only route/UI pattern (`apps/api/src/routes/platform-operators.ts`, `apps/web/src/features/platform/PlatformOperatorsPage.tsx`).

## Implementation

`packages/application/src/organisations/issue-registration-token.ts` / `list-registration-tokens.ts` / `revoke-registration-token.ts` (or under `packages/application/src/principals/`, matching wherever DEVOS-329 placed the domain type): each resolves the acting principal via `PlatformOperatorRepository.getByPrincipalId()` (reusing Sprint 56's repository unchanged) and rejects with the real, established `ForbiddenError` (`@devos/domain`/`@devos/application` — not a new `AuthorizationError`, per Sprint 56's own disclosed precedent, `specs/sprints/sprint-56/DEVOS-328.md`'s gap disclosure, and `AGENTS.md` §7) if the actor doesn't hold platform-operator status.

`issueRegistrationToken` generates a cryptographically random opaque token (e.g. `randomBytes` from `node:crypto`, matching `createOrganisation`'s own existing use of `randomUUID` from the same module for id generation), hashes it the same way DEVOS-330's redemption check does, persists only the hash via `RegistrationTokenRepository.create()`, and returns the **raw** token value in its own response only — never persisted, never re-derivable, never shown again after this one response, mirroring the backlog's own §9 "opaque random token, stored only as a hash" resolution.

`apps/api/src/routes/registration-tokens.ts` (new file, following the existing one-file-per-resource convention): `GET /registration-tokens` (list, platform-operator-only, returns status/expiry/issuer but never the raw value or hash), `POST /registration-tokens` (issue, platform-operator-only, returns the raw token value exactly once in this response), `DELETE /registration-tokens/:id` (revoke, platform-operator-only, rejects if not `ACTIVE`).

Minimal UI: extend `apps/web/src/features/platform/PlatformOperatorsPage.tsx` (or a new sibling page under the same `features/platform/` folder, e.g. `RegistrationTokensPage.tsx` — decide at implementation time based on whether the two management surfaces read better combined or separate) with an issue action that displays the raw token value in a one-time, copyable, clearly-labeled-as-shown-once dialog, a list of existing tokens with status/expiry, and a revoke action for `ACTIVE` tokens — reachable only by an already-known platform operator, matching Sprint 56's own conditional-nav-visibility pattern.

## Out of scope

Any invitation mechanism for joining an existing organisation (backlog §4 — untouched, separate `addMember` path). Any self-service request/approval workflow for obtaining a token without a platform operator directly issuing it (backlog §4 — no self-service elevation/issuance). The redemption/consumption side (DEVOS-330) and any redemption-facing UI (Sprint 60).

## Acceptance

`pnpm --filter @devos/application typecheck lint test build` clean, with new tests covering: a non-operator is rejected (`ForbiddenError`) from issue/list/revoke; an operator can issue a token and the raw value is returned exactly once; an operator can list tokens without ever seeing a raw value or hash in the response; an operator can revoke an `ACTIVE` token; revoking an already-`Redeemed`/`Revoked`/`Expired` token is rejected. `apps/api` typecheck/lint/test/build clean, with route tests covering the same outcomes through real HTTP request/response shapes, confirming the raw token never appears in the list response. `apps/web` typecheck/lint/build clean. Live-verified against real Postgres in DEVOS-332.
