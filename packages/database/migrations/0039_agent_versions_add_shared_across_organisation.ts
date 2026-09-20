// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-177 (Sprint 23): an additive flag, not a new table — the user's
 * own accepted default from `specs/DEVOS-AGENT-PLATFORM-BACKLOG.md` §10,
 * mirroring migration `0027`/`0038` (`Project.budgetUsd`/`Organisation.budgetUsd`)'s
 * own additive-optional-column pattern exactly. Default `false`: an
 * existing agent version is not shared until a project OWNER explicitly
 * opts it in.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('agent_versions')
    .addColumn('shared_across_organisation', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('agent_versions').dropColumn('shared_across_organisation').execute();
}
