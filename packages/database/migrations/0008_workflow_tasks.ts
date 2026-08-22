// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workflow_tasks')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('workflow_run_id', 'uuid', (col) => col.notNull().references('workflow_runs.id'))
    .addColumn('task_key', 'text', (col) => col.notNull())
    .addColumn('task_type', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('attempt', 'integer', (col) => col.notNull())
    .addColumn('input', 'jsonb', (col) => col.notNull())
    .addColumn('output', 'jsonb')
    .addColumn('error_code', 'text')
    .addColumn('error_message', 'text')
    .addColumn('started_at', 'timestamptz')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('workflow_tasks_workflow_run_id_task_key_key', [
      'workflow_run_id',
      'task_key',
    ])
    .execute();

  await db.schema
    .createIndex('workflow_tasks_status_idx')
    .on('workflow_tasks')
    .column('status')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workflow_tasks').execute();
}
