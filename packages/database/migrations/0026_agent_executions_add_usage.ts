// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-089: not in specs/database/poc-database-schema.md §9.3's documented
 * column list (usage/cost telemetry is not named anywhere in the spec
 * corpus, and §51 explicitly defers "advanced cost/budget contracts") —
 * added as a flagged assumption, the same reconciliation pattern DEVOS-025
 * (`error_message`) and DEVOS-059 (`idempotency_key`) already used for this
 * same table's neighbours. `usage_metadata` mirrors the real provider's own
 * token counts; `estimated_cost_usd` is a derived, approximate estimate,
 * not an authoritative billing figure — both nullable, since most historic
 * rows (and any execution whose provider never returns usage data) will
 * never have them.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('agent_executions').addColumn('usage_metadata', 'jsonb').execute();
  await db.schema
    .alterTable('agent_executions')
    .addColumn('estimated_cost_usd', 'numeric')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('agent_executions').dropColumn('estimated_cost_usd').execute();
  await db.schema.alterTable('agent_executions').dropColumn('usage_metadata').execute();
}
