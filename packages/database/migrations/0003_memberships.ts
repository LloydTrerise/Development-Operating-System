// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('memberships')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col) => col.notNull().references('organisations.id'))
    .addColumn('project_id', 'uuid', (col) => col.references('projects.id'))
    .addColumn('principal_id', 'text', (col) => col.notNull())
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('memberships_organisation_id_idx')
    .on('memberships')
    .column('organisation_id')
    .execute();
  await db.schema
    .createIndex('memberships_project_id_idx')
    .on('memberships')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('memberships_principal_id_idx')
    .on('memberships')
    .column('principal_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('memberships').execute();
}
