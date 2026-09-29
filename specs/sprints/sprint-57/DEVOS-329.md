# DEVOS-329 — `registration_tokens` table, migration

**Priority:** P1
**Depends on:** Sprint 56 (DEVOS-325–328) — a real platform operator must exist to be the token's issuer.
**Depended on by:** DEVOS-330 (redemption), DEVOS-331 (issue/list/revoke routes).

## Scope

A new table recording issued registration tokens — never the raw token value itself, only its hash — that DEVOS-330 checks on `createOrganisation` and DEVOS-331 manages. Dormant until DEVOS-330/331 wire it in; this task is schema + domain/repository only.

## Implementation

Migration `0061_registration_tokens.ts` creates `registration_tokens`:

- `id` (uuid, PK).
- `token_hash` (text, unique, not null) — a salted hash (e.g. SHA-256 with a server-side pepper, or a KDF such as scrypt — decided and disclosed at implementation time; the raw token is never persisted anywhere, per `AGENTS.md` §22 and the backlog's own §9 "stored only as a hash" resolution). The raw token itself is only ever returned once, in DEVOS-331's issuance response.
- `issued_by_platform_operator_id` (text, FK → `principals.id`, not null) — reuses `PlatformOperator.principalId`'s own type/convention (DEVOS-325).
- `status` (text, not null, one of `ACTIVE` / `REDEEMED` / `REVOKED` / `EXPIRED` — decide at implementation time whether `EXPIRED` is a real stored status transitioned by a scheduled/lazy check, or a derived value computed from `expires_at` at read time; the backlog's own §9 leaves token lifetime/format as a disclosed, non-blocking implementation detail).
- `expires_at` (timestamptz, not null) — a sensible configurable default (the backlog's own §9 suggests 7 days), not hardcoded without a config knob.
- `redeemed_by_principal_id` (text, nullable, FK → `principals.id`) — populated by DEVOS-330 on successful redemption.
- `redeemed_organisation_id` (uuid, nullable, FK → `organisations.id`) — populated by DEVOS-330 on successful redemption.
- `created_at`, `updated_at` (timestamptz, not null).

`packages/domain/src/principals/registration-token.ts` (or `packages/domain/src/organisations/registration-token.ts` — decide at implementation time based on which existing domain folder the concept more naturally sits beside; it is read by both an organisation use case (DEVOS-330) and a principal-scoped management API (DEVOS-331), so either placement is defensible) defines:

```ts
export interface RegistrationToken {
  id: RegistrationTokenId;
  tokenHash: string;
  issuedByPlatformOperatorId: string;
  status: RegistrationTokenStatus;
  expiresAt: string;
  redeemedByPrincipalId?: string;
  redeemedOrganisationId?: OrganisationId;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationTokenRepository {
  getByTokenHash: (tokenHash: string) => Promise<RegistrationToken | null>;
  list: () => Promise<RegistrationToken[]>;
  create: (token: RegistrationToken) => Promise<void>;
  markRedeemed: (
    id: RegistrationTokenId,
    redeemedByPrincipalId: string,
    redeemedOrganisationId: OrganisationId,
    updatedAt: string,
  ) => Promise<void>;
  markRevoked: (id: RegistrationTokenId, updatedAt: string) => Promise<void>;
}
```

`RegistrationTokenId` is a new branded id in `packages/contracts/src/ids.ts` (mirrors `OrganisationLlmProviderId`'s existing convention); `RegistrationTokenStatus` is a new status union in `packages/contracts/src/status.ts` (mirrors `OrganisationLlmProviderStatus`'s existing convention).

`packages/database/src/repositories/registration-tokens.ts` implements the repository against real Postgres, following the existing `createXRepository(client)` factory convention.

## Out of scope

Token generation/hashing logic and the issuance route itself (DEVOS-331). The `createOrganisation` redemption check (DEVOS-330). Any UI.

## Acceptance

`pnpm --filter @devos/contracts build`; `pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck lint test build` clean. A fresh migration creates the table with the documented shape, constraints, and FKs. Zero existing route, use case, or authorization outcome changes — this table has no reader anywhere in production code yet, mirroring DEVOS-325's own "dormant table" precedent.
