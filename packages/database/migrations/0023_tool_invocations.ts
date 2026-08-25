// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tool_invocations')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('workflow_task_id', 'uuid', (col) => col.notNull().references('workflow_tasks.id'))
    .addColumn('tool_capability_id', 'uuid', (col) =>
      col.notNull().references('tool_capabilities.id'),
    )
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('input_metadata', 'jsonb', (col) => col.notNull())
    .addColumn('output_metadata', 'jsonb')
    .addColumn('provider_reference', 'text')
    .addColumn('started_at', 'timestamptz')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('error_code', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('tool_invocations_workflow_task_id_idx')
    .on('tool_invocations')
    .column('workflow_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tool_invocations').execute();
}
