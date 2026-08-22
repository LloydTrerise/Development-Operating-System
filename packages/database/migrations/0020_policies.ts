// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('policies')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col) => col.notNull().references('organisations.id'))
    .addColumn('project_id', 'uuid', (col) => col.references('projects.id'))
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('definition', 'jsonb', (col) => col.notNull())
    .addColumn('created_by', 'text', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('policies_project_id_key_version_key', ['project_id', 'key', 'version'])
    .execute();

  await db.schema
    .createIndex('policies_project_id_key_idx')
    .on('policies')
    .columns(['project_id', 'key'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('policies').execute();
}
