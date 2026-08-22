// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('artifacts')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('artifact_type', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('workflow_run_id', 'uuid', (col) => col.references('workflow_runs.id'))
    .addColumn('workflow_task_id', 'uuid', (col) => col.references('workflow_tasks.id'))
    .addColumn('created_by', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('artifacts_project_id_idx')
    .on('artifacts')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('artifacts_workflow_run_id_idx')
    .on('artifacts')
    .column('workflow_run_id')
    .execute();
  await db.schema
    .createIndex('artifacts_workflow_task_id_idx')
    .on('artifacts')
    .column('workflow_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('artifacts').execute();
}
