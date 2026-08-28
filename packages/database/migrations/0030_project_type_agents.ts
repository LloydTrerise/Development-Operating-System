// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('project_type_agents')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_type_id', 'uuid', (col) => col.notNull().references('project_types.id'))
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('configuration', 'jsonb', (col) => col.notNull())
    .addColumn('prompt_reference', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('project_type_agents_project_type_id_key_key', ['project_type_id', 'key'])
    .execute();

  await db.schema
    .createIndex('project_type_agents_project_type_id_idx')
    .on('project_type_agents')
    .column('project_type_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('project_type_agents').execute();
}
