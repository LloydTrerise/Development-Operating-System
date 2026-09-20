// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-188 (Sprint 25): an additive flag, not a new table — mirrors
 * migration `0039` (`agent_versions.shared_across_organisation`, DEVOS-177)
 * exactly. Default `false`: an existing knowledge source is not shared
 * until a project OWNER explicitly opts it in.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('knowledge_sources')
    .addColumn('shared_across_organisation', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('knowledge_sources')
    .dropColumn('shared_across_organisation')
    .execute();
}
