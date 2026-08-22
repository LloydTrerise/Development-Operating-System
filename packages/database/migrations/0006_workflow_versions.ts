// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('workflow_versions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('workflow_definition_id', 'uuid', (col) =>
      col.notNull().references('workflow_definitions.id'),
    )
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('definition', 'jsonb', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_by', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('workflow_versions_workflow_definition_id_version_key', [
      'workflow_definition_id',
      'version',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('workflow_versions').execute();
}
