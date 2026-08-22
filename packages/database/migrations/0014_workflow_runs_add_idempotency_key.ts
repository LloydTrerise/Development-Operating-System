// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('workflow_runs').addColumn('idempotency_key', 'text').execute();

  await db.schema
    .alterTable('workflow_runs')
    .addUniqueConstraint('workflow_runs_workflow_version_id_idempotency_key_key', [
      'workflow_version_id',
      'idempotency_key',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('workflow_runs')
    .dropConstraint('workflow_runs_workflow_version_id_idempotency_key_key')
    .execute();
  await db.schema.alterTable('workflow_runs').dropColumn('idempotency_key').execute();
}
