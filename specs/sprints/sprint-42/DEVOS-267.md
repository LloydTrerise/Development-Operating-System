# DEVOS-267 — Notification entity, table, and migration

**Priority:** P0 | **Estimate:** 1d
**Depends on:** none within this sprint.
**Depended on by:** DEVOS-268 (materialization), DEVOS-269 (routes).

## Scope

A new `notifications` table and matching domain entity/repository, following this codebase's existing entity/repository/migration conventions exactly — closest precedent is `audit_records`/`AuditRecord`/`AuditRecordRepository` (a per-recipient-ish, timestamped row referencing another entity), adapted per `README.md`'s grounding to carry only the columns this sprint's stories actually need.

## Implementation

- New `packages/contracts/src/ids.ts`: `NotificationId` branded type, added alongside the other `Brand<string, '...'>` declarations.
- New `packages/domain/src/notifications/notification.ts`:
  - `export interface Notification { id: NotificationId; recipientPrincipalId: string; type: EventType; referenceType: string; referenceId: string; read: boolean; createdAt: string; readAt?: string; }` — `type` reuses `EventType` from `@devos/contracts` directly (the real trigger-event type, not a new enum); `referenceType`/`referenceId` mirror `AuditRecord.targetType`/`targetId`'s exact shape, populated from the triggering `EventEnvelope`'s own `aggregateType`/`aggregateId`.
  - `export interface NotificationRepository { create: (notification: Notification) => Promise<void>; getById: (id: NotificationId) => Promise<Notification | null>; listForPrincipal: (principalId: string, limit?: number) => Promise<Notification[]>; markRead: (id: NotificationId, readAt: string) => Promise<void>; }` — `listForPrincipal` orders by `createdAt` descending, default `limit = 100`, mirroring `AuditRecordRepository.listForProject`'s own default-limit convention exactly.
- `packages/domain/src/index.ts`: barrel-export `./notifications/notification.js`.
- New `packages/database/migrations/0043_notifications.ts`: `createTable('notifications')` — `id uuid primary key`, `recipient_principal_id text not null`, `type text not null`, `reference_type text not null`, `reference_id text not null`, `read boolean not null`, `created_at timestamptz not null`, `read_at timestamptz` (nullable). Indexes: `notifications_recipient_principal_id_idx` on `recipient_principal_id` (the only column DEVOS-269's `GET /notifications` filters by), `notifications_created_at_idx` on `created_at` (ordering). `down()` drops the table.
- `packages/database/src/database.ts`: new `NotificationsTable` interface (snake_case columns matching the migration exactly) and a `notifications: NotificationsTable` entry on `Database`.
- New `packages/database/src/repositories/notifications.ts`: `createNotificationRepository(db: QueryExecutor): NotificationRepository`, mirroring `createAuditRecordRepository`'s exact `toDomain`/insert/select shape — `create` inserts all columns (`read_at: null`, `read: false` always at creation — nothing in this sprint ever creates a pre-read notification); `getById`/`listForPrincipal` select and map via `toDomain`; `markRead` is a single `updateTable('notifications').set({ read: true, read_at: readAt }).where('id', '=', id)`.
- `packages/database/src/index.ts`: barrel-export `./repositories/notifications.js`.

## Out of scope

Wiring `NotificationRepository` into `apps/worker`/`apps/api` (DEVOS-268/269). Any route. Any application-layer use case. Any `organisation_id`/`project_id` column (disclosed boundary, `README.md`'s grounding — no story in this sprint needs one).

## Acceptance

`pnpm --filter @devos/contracts --filter @devos/domain --filter @devos/database typecheck lint build` clean. No `packages/database` repository unit test added, matching this codebase's own established, disclosed precedent (DEVOS-261/DEVOS-254/DEVOS-256's identical precedent — no per-repository unit-test convention exists; live Postgres verification is this method's proof instead). Live-verified against real Postgres: the migration runs cleanly (`migration "0043_notifications" executed successfully`); a throwaway script creates a real notification row, lists it back for its recipient, and marks it read, confirming the real round trip end to end.

## Actual results

Implemented exactly as scoped. `NotificationId` added to `packages/contracts/src/ids.ts`; `Notification`/`NotificationRepository` added at `packages/domain/src/notifications/notification.ts` (`type: EventType`, `referenceType`/`referenceId` mirroring `AuditRecord`'s `targetType`/`targetId` shape), barrel-exported from `packages/domain/src/index.ts`. New migration `packages/database/migrations/0043_notifications.ts` creates the `notifications` table plus `notifications_recipient_principal_id_idx`/`notifications_created_at_idx`, mirroring `0034_approvals_separation_of_duties.ts`'s `defaultTo(false)` convention for `read`. `NotificationsTable`/`Database.notifications` added to `packages/database/src/database.ts`; `createNotificationRepository` added at `packages/database/src/repositories/notifications.ts`, mirroring `createAuditRecordRepository`'s exact `toDomain`/insert/select shape, barrel-exported from `packages/database/src/index.ts`.

No `packages/database` repository unit test was added, per this file's own disclosed acceptance criterion — matching DEVOS-261/DEVOS-254/DEVOS-256's identical precedent.

`pnpm --filter @devos/contracts --filter @devos/domain --filter @devos/database typecheck lint build`: clean (contracts required a rebuild before domain's typecheck could see the new `NotificationId` export — ordinary monorepo build-order, not a defect, matching DEVOS-261's own identical disclosed finding). Full monorepo `pnpm turbo run typecheck lint build --filter='!@devos/e2e-tests'`: **57/57 tasks successful** (turbo's own cached/uncached task count for this narrower `typecheck lint build` set, not the `+test` baseline DEVOS-270 will re-run). `prettier --write`/`--check` applied and re-verified clean across all 7 touched source files plus this sprint's own spec files.

**Live-verified against real Postgres**: migration ran cleanly (`migration "0043_notifications" executed successfully`); `\d notifications` confirms all 8 columns and both new indexes exist exactly as designed. A throwaway script (run from inside `apps/api`, deleted afterward) exercised the full real round trip: `create` → `listForPrincipal` (1 real row, correct `id`) → `getById` (`read: false`, `readAt: undefined`) → `markRead` → `getById` again (`read: true`, real `read_at` persisted) → cleanup delete → `getById` confirms `null`.

**One real, disclosed, pre-existing (not introduced by this task) finding surfaced while writing the verification script**: `node-postgres`'s default type parser returns `timestamptz` columns as JS `Date` objects at the Kysely row level, not strings, even though every `*Table` interface in `packages/database/src/database.ts` (including this new `NotificationsTable`) types them as `string` — confirmed by a strict `===` comparison against a freshly-generated ISO string failing while `new Date(...).getTime()` equality on the same two values succeeded. This is invisible in normal use (JSON serialization of a `Date` already produces an ISO string, which is why every existing DTO/API response has always looked correct) and is not specific to `Notification` — it is the same underlying behavior every other `timestamptz` column in this codebase (`created_at`, `decided_at`, `expires_at`, etc.) already has, unrelated to and not caused by this task. Disclosed here since it directly explains an initial confusing result in this task's own verification script, not fixed (out of scope — a pre-existing, codebase-wide characteristic, not a `Notification`-specific defect).
