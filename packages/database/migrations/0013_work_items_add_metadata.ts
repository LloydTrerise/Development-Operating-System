// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('work_items').addColumn('metadata', 'jsonb').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('work_items').dropColumn('metadata').execute();
}
