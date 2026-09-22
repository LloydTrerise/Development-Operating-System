// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

// DEVOS-261: one GIN expression index per table gaining a real
// `searchForProject` method this migration accompanies, closing DEVOS-187's
// own disclosed sequential-scan limitation for these four tables. Each
// index's expression matches its own repository method's `to_tsvector(...)`
// call exactly, so the query planner can actually use it.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createIndex('work_items_search_idx')
    .on('work_items')
    .column(sql`to_tsvector('english', title || ' ' || description)`)
    .using('gin')
    .execute();

  await db.schema
    .createIndex('artifacts_search_idx')
    .on('artifacts')
    .column(sql`to_tsvector('english', name)`)
    .using('gin')
    .execute();

  await db.schema
    .createIndex('workflow_definitions_search_idx')
    .on('workflow_definitions')
    .column(sql`to_tsvector('english', name || ' ' || coalesce(description, ''))`)
    .using('gin')
    .execute();

  await db.schema
    .createIndex('agents_search_idx')
    .on('agents')
    .column(sql`to_tsvector('english', name || ' ' || coalesce(description, ''))`)
    .using('gin')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('work_items_search_idx').execute();
  await db.schema.dropIndex('artifacts_search_idx').execute();
  await db.schema.dropIndex('workflow_definitions_search_idx').execute();
  await db.schema.dropIndex('agents_search_idx').execute();
}
