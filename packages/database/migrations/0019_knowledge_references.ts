// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('knowledge_references')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('knowledge_source_id', 'uuid', (col) =>
      col.notNull().references('knowledge_sources.id'),
    )
    .addColumn('workflow_task_id', 'uuid', (col) => col.notNull().references('workflow_tasks.id'))
    .addColumn('agent_execution_id', 'uuid', (col) => col.references('agent_executions.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('knowledge_references_workflow_task_id_idx')
    .on('knowledge_references')
    .column('workflow_task_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('knowledge_references').execute();
}
