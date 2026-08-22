// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('artifact_versions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('artifact_id', 'uuid', (col) => col.notNull().references('artifacts.id'))
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('content_type', 'text', (col) => col.notNull())
    .addColumn('content_uri', 'text', (col) => col.notNull())
    .addColumn('content_hash', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb')
    .addColumn('created_by', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('artifact_versions_artifact_id_version_key', ['artifact_id', 'version'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('artifact_versions').execute();
}
