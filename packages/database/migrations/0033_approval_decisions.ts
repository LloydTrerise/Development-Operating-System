// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-143: multi-approver (N-of-M) approval support. `approvals` gains
 * `required_approvers` (default 1, so every existing single-approver
 * approval is unaffected); a new `approval_decisions` table records every
 * individual decision (who, which way, when, why) — `approvals`' own
 * `decided_by`/`decision_reason`/`decided_at` continue to record only the
 * decision that actually finalizes the approval.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('approvals')
    .addColumn('required_approvers', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable('approval_decisions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('approval_id', 'uuid', (col) => col.notNull().references('approvals.id'))
    .addColumn('decided_by', 'text', (col) => col.notNull())
    .addColumn('decision', 'text', (col) => col.notNull())
    .addColumn('reason', 'text')
    .addColumn('decided_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('approval_decisions_approval_id_idx')
    .on('approval_decisions')
    .column('approval_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('approval_decisions').execute();
  await db.schema.alterTable('approvals').dropColumn('required_approvers').execute();
}
