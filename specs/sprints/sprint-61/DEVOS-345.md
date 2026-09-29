# DEVOS-345 — Platform-operator grant/revoke audit trail

**Priority:** P2 | **Estimate:** 1d
**Depends on:** none.
**Depended on by:** DEVOS-349.

## Scope

Close gap 1 (`specs/sprints/sprint-60/DEVOS-344.md`'s closing disclosure; `specs/sprints/sprint-56/DEVOS-328.md`): `grantPlatformOperator`/`revokePlatformOperator` (`packages/application/src/principals/grant-platform-operator.ts`/`revoke-platform-operator.ts`) currently write no audit record — `AuditRecord.organisationId` (`packages/domain/src/audit/audit-record.ts:15`) is required and backed by a `NOT NULL` FK (migration `0012`), and a platform operator has no organisation by design. Per Decision 1 (`specs/DEVOS-E31-GAP-CLOSURE-SPRINT.md` §6), this is closed with a **new, separate, dedicated concept** — `platform_audit_records` — not a change to the existing `AuditRecord` shape, mirroring `platform_operators`/`registration_tokens`' own established precedent (Sprint 56/57) of a new table for a new tier rather than widening an existing organisation-scoped one.

## Implementation

- New migration `packages/database/migrations/0063_platform_audit_records.ts`: `platform_audit_records` table — `id` (uuid, PK), `actor_principal_id` (text, references `principals.id`, not null), `action` (text, not null — `'platform_operator.granted'` | `'platform_operator.revoked'`), `target_principal_id` (text, references `principals.id`, not null), `outcome` (text, not null), `metadata` (jsonb, nullable), `created_at` (timestamptz, not null). Index on `created_at`. No `organisation_id` column at all — the whole point of the new concept.
- New domain type `packages/domain/src/audit/platform-audit-record.ts`: `PlatformAuditRecord` (`id: PlatformAuditId`, `actorPrincipalId: string`, `action: string`, `targetPrincipalId: string`, `outcome: AuditOutcome` reused from `audit-record.ts`, `metadata?: Record<string, unknown>`, `createdAt: string`) and `PlatformAuditRecordRepository` (`create`, `list(limit?)`). New `PlatformAuditId` branded id in `packages/contracts/src/ids.ts`, mirroring `AuditId`.
- New repository `packages/database/src/repositories/platform-audit-records.ts` (`createPlatformAuditRecordRepository`), mirroring `audit-records.ts`'s own `toDomain`/`create`/`list` shape.
- `grant-platform-operator.ts`/`revoke-platform-operator.ts` each write one `PlatformAuditRecord` after their own successful write (`action: 'platform_operator.granted'`/`'platform_operator.revoked'`, `actorPrincipalId` = the acting operator, `targetPrincipalId` = the affected principal, `outcome: 'SUCCESS'`). `PlatformOperatorUseCaseDeps` (`packages/application/src/principals/deps.ts`) gains a `platformAuditRecords: PlatformAuditRecordRepository` field.
- New route `GET ${prefix}/platform-audit-records` (`apps/api/src/routes/platform-audit-records.ts`, new file) — gated the same way `listPlatformOperators` already is (existing-platform-operator-only, `ForbiddenError` otherwise), reusing `platformOperatorDeps`. New `toPlatformAuditRecordDto` in `apps/api/src/dto/platform-audit-record.ts`.
- Wire into `apps/api/src/app.ts`: construct `createPlatformAuditRecordRepository(database.db)`, add to `platformOperatorDeps`, add the new route to the route list next to `createPlatformOperatorRoutes`.

## Out of scope

Any change to the existing `AuditRecord`/`audit_records` shape or its `organisationId` invariant. A general-purpose platform-operator activity feed beyond grant/revoke.

## Acceptance

`grantPlatformOperator`/`revokePlatformOperator` each write a real `platform_audit_records` row on success, verified against real Postgres. `GET /platform-audit-records` returns them, gated to platform operators only (a non-operator gets `403`). Package-scoped `pnpm --filter @devos/domain --filter @devos/database --filter @devos/application --filter @devos/api typecheck lint test build` clean.
