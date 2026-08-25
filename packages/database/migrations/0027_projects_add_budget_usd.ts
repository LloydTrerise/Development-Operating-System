// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-098: not in specs/database/poc-database-schema.md's documented
 * `projects` column list — §51 explicitly defers "advanced cost/budget
 * contracts", the same deferral DEVOS-089's `usage_metadata`/
 * `estimated_cost_usd` migration (0026) already flagged for this feature's
 * other half. Added as a flagged assumption, the same reconciliation
 * pattern DEVOS-025/DEVOS-059/DEVOS-089 already used. Nullable: a project
 * with no configured budget has no threshold to check against, not a zero
 * budget.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('projects').addColumn('budget_usd', 'numeric').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('projects').dropColumn('budget_usd').execute();
}
