// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * Step B of the two-migration rollout begun in 0031 — tightens
 * `project_type_id` to NOT NULL now that every existing row has been
 * backfilled.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('projects')
    .alterColumn('project_type_id', (col) => col.setNotNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('projects')
    .alterColumn('project_type_id', (col) => col.dropNotNull())
    .execute();
}
