// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('integrations')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('configuration', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('integrations_project_id_idx')
    .on('integrations')
    .column('project_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('integrations').execute();
}
