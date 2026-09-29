# DEVOS-325 — `platform_operators` table + domain/repository

**Priority:** P1
**Depends on:** None (candidate epic E31's first sprint).
**Depended on by:** DEVOS-326 (bootstrap grant), DEVOS-327 (management routes), Sprint 57 (registration-token issuance, gated to platform operators).

## Scope

A real, dormant table recording which principals hold platform-operator status — a grant that exists above and outside every organisation (see the sprint README's grounding). No row required to exist; a principal with no row is not a platform operator. Zero change to any existing route, use case, or authorization outcome.

## Implementation

Migration `0060_platform_operators.ts` creates `platform_operators`:

- `principal_id` (text, PK, FK → `principals.id`) — the grant's own natural key; a principal can only ever hold platform-operator status once, so no separate surrogate id is needed (mirrors how `organisations.owner_principal_id` is a plain FK column, not its own entity).
- `granted_at` (timestamptz).
- `granted_by_principal_id` (text, nullable, FK → `principals.id`) — nullable specifically for the one bootstrap grant (DEVOS-326) that has no human grantor; every subsequent grant (DEVOS-327) populates it with the acting platform operator's own id.

`packages/domain/src/principals/platform-operator.ts` defines:

```ts
export interface PlatformOperator {
  principalId: string;
  grantedAt: string;
  grantedByPrincipalId?: string;
}

export interface PlatformOperatorRepository {
  getByPrincipalId: (principalId: string) => Promise<PlatformOperator | null>;
  list: () => Promise<PlatformOperator[]>;
  count: () => Promise<number>; // DEVOS-326 needs this to detect "zero platform operators exist yet" without fetching every row
  create: (platformOperator: PlatformOperator) => Promise<void>;
  delete: (principalId: string) => Promise<void>; // DEVOS-327's revoke
}
```

`packages/database/src/repositories/platform-operators.ts` implements it against real Postgres, following the existing repository-factory convention (`createPlatformOperatorRepository(client)`).

## Out of scope

Bootstrap grant logic (DEVOS-326). Grant/revoke API routes and the "never revoke the last operator" rule (DEVOS-327). Any wiring into `createOrganisation` or any other existing use case — this table has no reader anywhere in production code yet, mirroring DEVOS-311's own "dormant table" precedent.

## Acceptance

`pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck lint test build` clean. (Decide at implementation time whether `principal_id`/`granted_by_principal_id` need a branded contracts type — `Principal.id`'s own existing plain-string convention suggests none is needed here either, matching how `Membership.principalId` also stays a bare `string`.) A fresh migration creates the table with the documented shape and constraints. Zero existing route, use case, or authorization outcome changes — confirmed by the full monorepo/e2e suites re-running at their existing baseline (see `DEVOS-328.md`).
