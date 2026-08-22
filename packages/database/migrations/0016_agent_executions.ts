// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('agent_executions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('workflow_task_id', 'uuid', (col) => col.notNull().references('workflow_tasks.id'))
    .addColumn('agent_version_id', 'uuid', (col) => col.notNull().references('agent_versions.id'))
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('input', 'jsonb', (col) => col.notNull())
    .addColumn('output', 'jsonb')
    .addColumn('uncertainty', 'jsonb')
    .addColumn('model_reference', 'text')
    .addColumn('started_at', 'timestamptz')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('error_code', 'text')
    // Not in specs/database/poc-database-schema.md §9.3's documented column
    // list (only error_code is listed there) — added so a failed execution
    // carries a human-readable message, matching every other error-capturing
    // table in this schema (workflow_tasks, workflow_runs) having both.
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('agent_executions_workflow_task_id_idx')
    .on('agent_executions')
    .column('workflow_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('agent_executions').execute();
}
