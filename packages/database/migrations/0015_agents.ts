// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('agents')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('project_id', 'uuid', (col) => col.notNull().references('projects.id'))
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('agents_project_id_key_key', ['project_id', 'key'])
    .execute();

  await db.schema
    .createTable('agent_versions')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('agent_id', 'uuid', (col) => col.notNull().references('agents.id'))
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('configuration', 'jsonb', (col) => col.notNull())
    .addColumn('prompt_reference', 'text')
    // Not in specs/database/poc-database-schema.md §9.2's documented column
    // list (unlike workflow_versions.created_by) — added to match every
    // other create/publish action in this schema being attributable to an
    // actor. See DEVOS-025's task report for the full rationale.
    .addColumn('created_by', 'text', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addUniqueConstraint('agent_versions_agent_id_version_key', ['agent_id', 'version'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('agent_versions').execute();
  await db.schema.dropTable('agents').execute();
}
