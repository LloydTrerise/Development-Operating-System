// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-059: no unique constraint (unlike `workflow_runs`'s equivalent
 * idempotency-key column, DEVOS-014) — a "branch binding" violation
 * (DEVOS-059's own decision log) legitimately needs a second row carrying
 * the *same* `(tool_capability_id, idempotency_key)` pair, recording that
 * the key was replayed with different parameters and rejected. A hard
 * unique constraint would make that row impossible to persist. Real
 * idempotent-replay detection is enforced in application code
 * (`invokeTool`'s own lookup-before-insert), not by the database.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('tool_invocations').addColumn('idempotency_key', 'text').execute();

  await db.schema
    .createIndex('tool_invocations_capability_idempotency_key_idx')
    .on('tool_invocations')
    .columns(['tool_capability_id', 'idempotency_key'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('tool_invocations_capability_idempotency_key_idx').execute();
  await db.schema.alterTable('tool_invocations').dropColumn('idempotency_key').execute();
}
