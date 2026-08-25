// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('tool_capabilities')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('risk_class', 'text', (col) => col.notNull())
    .addColumn('input_schema', 'jsonb', (col) => col.notNull())
    .addColumn('output_schema', 'jsonb', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('tool_capabilities_project_id_key_key', ['project_id', 'key'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('tool_capabilities').execute();
}
