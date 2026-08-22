// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workflow_runs')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('workflow_version_id', 'uuid', (col) =>
      col.notNull().references('workflow_versions.id'),
    )
    .addColumn('work_item_id', 'uuid', (col) => col.notNull().references('work_items.id'))
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('input', 'jsonb', (col) => col.notNull())
    .addColumn('started_at', 'timestamptz')
    .addColumn('completed_at', 'timestamptz')
    .addColumn('error_code', 'text')
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('workflow_runs_project_id_idx')
    .on('workflow_runs')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('workflow_runs_work_item_id_idx')
    .on('workflow_runs')
    .column('work_item_id')
    .execute();
  await db.schema
    .createIndex('workflow_runs_status_idx')
    .on('workflow_runs')
    .column('status')
    .execute();
  await db.schema
    .createIndex('workflow_runs_workflow_version_id_idx')
    .on('workflow_runs')
    .column('workflow_version_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workflow_runs').execute();
}
