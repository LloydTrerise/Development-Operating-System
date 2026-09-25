// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

/**
 * DEVOS-304 (Sprint 50, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.5):
 * `work_item_assignments` — the source document's `WORK_ITEM_ASSIGNMENT`
 * table, recording that a principal holds one of `ASSIGNEE`/`REVIEWER`/
 * `APPROVER` on a work item. Many rows per item (a work item can have more
 * than one reviewer/approver, and in principle more than one assignee),
 * mirroring `principal_job_roles`'s own "many rows, one per grant" shape
 * (migration `0051`) rather than a single nullable column per role.
 *
 * `principal_id` FK's to `principals.id` (not left as a bare, unconstrained
 * `text` column the way `memberships.principal_id` still is) — a real,
 * deliberate choice to follow this epic's own newer, stricter convention
 * (`principal_job_roles`/`project_member_job_roles`, migrations `0051`/
 * `0052`) rather than the older, looser one `memberships` predates this
 * epic with. Verified safe against this environment's real data before
 * writing this migration: zero `work_items.created_by` values are missing
 * a `principals` row (every work item is created through
 * `packages/application/src/work-items/create-work-item.ts`, which already
 * requires a resolved project membership, and Sprint 46's own
 * `createMembershipRepository.create()` chokepoint already backfills a
 * `principals` row for every membership).
 *
 * `role` is a plain `text` column with a check constraint, not a Postgres
 * enum type — matching every other role/status-shaped column in this
 * schema (`memberships.role`, `work_items.status`, `agents.status`, …),
 * none of which use a native enum.
 *
 * The composite primary key `(work_item_id, principal_id, role)` allows the
 * same principal to hold more than one role on the same item (e.g.
 * `ASSIGNEE` and `REVIEWER` simultaneously) but not the same role twice,
 * and doubles as the natural target for the `create()`
 * `onConflict().doNothing()` idempotency `principal_job_roles.create()`
 * already established as this codebase's convention for a grant that may
 * be attempted twice.
 *
 * `onDelete('cascade')` on `work_item_id`: proactively applied, not found
 * the hard way — mirroring the exact lesson Sprint 48 (`agent_profiles`)
 * and Sprint 49 (`job_roles`/`principal_job_roles`/`project_member_job_roles`)
 * both had to learn from a live `tests/e2e` failure, applied here up front
 * instead: this codebase's e2e pilot tests routinely hard-delete their own
 * test work items/projects as cleanup, and an assignment row has no
 * independent meaning once its own work item is gone.
 *
 * The one-time backfill of `ASSIGNEE = created_by` for every work item that
 * already existed before this table did is DEVOS-305's own concern
 * (migration `0055`), not this one — kept as a separate migration so the
 * "table exists" and "existing data is backfilled before the new
 * restriction takes effect" steps stay independently reviewable, mirroring
 * migration `0043`/`0044`'s own established split for `notifications`.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('work_item_assignments')
    .addColumn('work_item_id', 'uuid', (col: any) =>
      col.notNull().references('work_items.id').onDelete('cascade'),
    )
    .addColumn('principal_id', 'text', (col: any) => col.notNull().references('principals.id'))
    .addColumn('role', 'text', (col: any) =>
      col.notNull().check(sql`role in ('ASSIGNEE', 'REVIEWER', 'APPROVER')`),
    )
    .addColumn('created_at', 'timestamptz', (col: any) => col.notNull())
    .addPrimaryKeyConstraint('work_item_assignments_pkey', ['work_item_id', 'principal_id', 'role'])
    .execute();

  await db.schema
    .createIndex('work_item_assignments_work_item_id_idx')
    .on('work_item_assignments')
    .column('work_item_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('work_item_assignments').execute();
}
