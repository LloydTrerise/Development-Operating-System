// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-309 (Sprint 51's own reconciliation): the source document's
 * `workitem.comment` — genuinely new, no comment concept existed anywhere
 * on `WorkItem` before this. Every real project member (not just the
 * `ASSIGNEE`) may comment, matching the source document's own permission
 * table exactly (`workitem.comment` grants ✓ to "project member," unlike
 * `workitem.edit`/`workitem.transition`, which are assignment-gated).
 * `principal_id` is a plain `text` column (not FK-constrained to
 * `principals.id`), mirroring `work_items.created_by`'s own existing,
 * unconstrained shape — this table's own author field, not a new,
 * stricter convention.
 *
 * `onDelete('cascade')` on `work_item_id`: applied proactively, mirroring
 * migration `0054`'s own identical, explicitly-disclosed lesson (learned
 * the hard way by Sprints 48/49, applied up front from `0054` onward) —
 * this codebase's e2e pilot tests routinely hard-delete their own test work
 * items as cleanup, and a comment has no independent meaning once its own
 * work item is gone.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('work_item_comments')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('work_item_id', 'uuid', (col: any) =>
      col.notNull().references('work_items.id').onDelete('cascade'),
    )
    .addColumn('principal_id', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('work_item_comments_work_item_id_idx')
    .on('work_item_comments')
    .column('work_item_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('work_item_comments').execute();
}
