// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('audit_records')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col) => col.notNull().references('organisations.id'))
    .addColumn('project_id', 'uuid', (col) => col.references('projects.id'))
    .addColumn('actor_type', 'text', (col) => col.notNull())
    .addColumn('actor_id', 'text', (col) => col.notNull())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('target_type', 'text', (col) => col.notNull())
    .addColumn('target_id', 'uuid', (col) => col.notNull())
    .addColumn('outcome', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb')
    .addColumn('correlation_id', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('audit_records_organisation_id_idx')
    .on('audit_records')
    .column('organisation_id')
    .execute();
  await db.schema
    .createIndex('audit_records_project_id_idx')
    .on('audit_records')
    .column('project_id')
    .execute();
  await db.schema
    .createIndex('audit_records_actor_id_idx')
    .on('audit_records')
    .column('actor_id')
    .execute();
  await db.schema
    .createIndex('audit_records_created_at_idx')
    .on('audit_records')
    .column('created_at')
    .execute();
  await db.schema
    .createIndex('audit_records_correlation_id_idx')
    .on('audit_records')
    .column('correlation_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_records').execute();
}
