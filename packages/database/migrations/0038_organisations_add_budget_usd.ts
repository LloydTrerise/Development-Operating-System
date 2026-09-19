// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-155: mirrors migration `0027` (`projects.budget_usd`) exactly, at
 * the organisation level — closing the Core Platform spec's own named
 * "platform cost controls" gap at the tenant level, not just per-project.
 * Nullable: an organisation with no configured budget has no threshold to
 * check against, not a zero budget.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('organisations').addColumn('budget_usd', 'numeric').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('organisations').dropColumn('budget_usd').execute();
}
