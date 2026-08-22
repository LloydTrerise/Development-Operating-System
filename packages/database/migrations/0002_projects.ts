// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('projects')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col) => col.notNull().references('organisations.id'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('repository_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('projects_organisation_id_slug_key', ['organisation_id', 'slug'])
    .execute();

  await db.schema
    .createIndex('projects_organisation_id_idx')
    .on('projects')
    .column('organisation_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('projects').execute();
}
