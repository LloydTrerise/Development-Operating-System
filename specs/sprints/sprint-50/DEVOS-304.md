# DEVOS-304 — `WORK_ITEM_ASSIGNMENT` table (ASSIGNEE/REVIEWER/APPROVER)

**Priority:** P1
**Depends on:** Sprint 46 (real `PRINCIPAL` rows, the FK target for `principal_id`).
**Depended on by:** DEVOS-305 (backfill + the assignment-gated edit/transition rule), DEVOS-306 (UI/routes).

## Scope

A real table recording that a principal holds one of `ASSIGNEE`/`REVIEWER`/`APPROVER` on a work item — the source document's `WORK_ITEM_ASSIGNMENT` table. Many rows per item (a work item can have more than one reviewer/approver, and in principle more than one assignee), one row per (work item, principal, role) grant.

## Implementation

Migration `0054_work_item_assignments.ts` creates `work_item_assignments`:

- `work_item_id` uuid, FK → `work_items.id`, `ON DELETE CASCADE` (applied proactively, not found the hard way — directly incorporating the lesson Sprint 48/49 each had to learn from a live `tests/e2e` failure the first time).
- `principal_id` text, FK → `principals.id` — a deliberate choice to follow this epic's own newer, stricter convention (`principal_job_roles`/`project_member_job_roles`) rather than the older, unconstrained `memberships.principal_id` shape; verified safe beforehand via a direct Postgres query confirming zero `work_items.created_by` values are missing a `principals` row in this environment's real data.
- `role` text with a check constraint (`role in ('ASSIGNEE', 'REVIEWER', 'APPROVER')`) — a plain `text` + check, not a native Postgres enum, matching every other role/status-shaped column in this schema.
- `created_at` timestamptz.
- Primary key `(work_item_id, principal_id, role)` — allows the same principal to hold more than one role on the same item (e.g. `ASSIGNEE` and `REVIEWER` simultaneously) but not the same role twice; doubles as the natural `onConflict().doNothing()` idempotency target, mirroring `principal_job_roles.create()`'s own established convention.
- An index on `work_item_id`.

`packages/domain/src/work-items/work-item-assignment.ts` defines `workItemAssignmentRoles`/`WorkItemAssignmentRole`, `WorkItemAssignment`, and `WorkItemAssignmentRepository` (`listForWorkItem`/`create`/`remove`). `packages/database/src/repositories/work-item-assignments.ts` implements it, following `principal-job-roles.ts`'s exact shape.

## Out of scope

The backfill of every pre-existing work item's initial `ASSIGNEE` row (DEVOS-305's own migration `0055`). Any use case wiring — `assignWorkItem`/`removeWorkItemAssignment`/`listWorkItemAssignments` and the assignment-gated `updateWorkItem` check are DEVOS-305's scope. Routes/UI (DEVOS-306).

## Acceptance

`pnpm --filter @devos/domain build`; `pnpm --filter @devos/database typecheck build` clean. A direct Postgres insert for a non-existent `principal_id` is rejected by the real FK. A duplicate `(work_item_id, principal_id, role)` insert is a no-op, not an error.

## Actual results

Implemented as planned. `pnpm --filter @devos/domain build` and `pnpm --filter @devos/database typecheck build` both clean. Live-verified against real Postgres: a direct `psql INSERT` for a nonexistent `principal_id` was rejected with `ERROR: insert or update on table "work_item_assignments" violates foreign key constraint "work_item_assignments_principal_id_fkey"`. The backfill migration (`0055`, DEVOS-305) confirmed exactly 3,601 `ASSIGNEE` rows exist for this environment's real 3,601 pre-existing work items — a 1:1 match, with zero duplicates or gaps. Full evidence in `DEVOS-307.md`.
