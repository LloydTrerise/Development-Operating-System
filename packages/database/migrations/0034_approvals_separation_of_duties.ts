// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-144: a per-approval opt-in separation-of-duties flag (default
 * false, so every existing approval — decidable by its own requester today
 * — is unaffected).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('approvals')
    .addColumn('enforce_separation_of_duties', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').dropColumn('enforce_separation_of_duties').execute();
}
