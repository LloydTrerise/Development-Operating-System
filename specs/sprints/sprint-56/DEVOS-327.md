# DEVOS-327 — Platform-operator management (grant/revoke)

**Priority:** P1
**Depends on:** DEVOS-325 (repository), DEVOS-326 (a real bootstrap operator must exist to grant a second one).
**Depended on by:** Sprint 57 (registration-token issuance routes reuse this sprint's platform-operator-only authorization gate).

## Scope

An API (+ minimal UI) letting an existing platform operator grant platform-operator status to another principal, or revoke an existing one — blocked from revoking the last remaining operator, mirroring `Organisation.ownerPrincipalId`'s existing "never leave zero owners" discipline (DEVOS-290).

## Implementation

`packages/application/src/principals/grant-platform-operator.ts` / `revoke-platform-operator.ts`: both take the acting principal's id, resolve it via `PlatformOperatorRepository.getByPrincipalId()`, and reject (a new `AuthorizationError`, matching this codebase's existing error-class convention) if the actor doesn't already hold platform-operator status. `revokePlatformOperator` additionally checks `PlatformOperatorRepository.count()` and rejects if it's `1` (the target would be the last remaining operator).

`apps/api/src/routes/platform-operators.ts` (new file, following the existing one-file-per-resource convention, e.g. `organisation-llm-providers.ts`): `GET /platform-operators` (list, platform-operator-only), `POST /platform-operators` (grant, body `{ principalId }`, platform-operator-only), `DELETE /platform-operators/:principalId` (revoke, platform-operator-only, the last-operator check above).

Minimal UI: a new `apps/web/src/features/platform/PlatformOperatorsPage.tsx`, reachable only by an already-known platform operator — no nav-item change needed beyond a route plus a conditional nav entry shown only when `GET /platform-operators` succeeds rather than 403s, mirroring how organisation-admin-only panels already condition their own visibility elsewhere in this codebase (e.g. `OrganisationsPage.tsx`'s AI Providers panel).

## Out of scope

Any request/approval workflow for becoming a platform operator beyond a direct grant by an existing one (backlog §4 — no self-service elevation). Any platform-wide analytics/billing/ops surface beyond this narrow grant/revoke management.

## Acceptance

`pnpm --filter @devos/application typecheck lint test build`; `apps/api` typecheck/lint/test/build clean, with new route tests covering: a non-operator is rejected (403) from every route; an operator can grant a second operator; an operator cannot revoke the sole remaining operator (blocked); an operator can revoke a non-sole operator. `apps/web` typecheck/lint/build clean. Live-verified against real Postgres in `DEVOS-328.md`.
