// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('outbox_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col) => col.notNull().references('organisations.id'))
    .addColumn('project_id', 'uuid', (col) => col.references('projects.id'))
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('aggregate_type', 'text', (col) => col.notNull())
    .addColumn('aggregate_id', 'uuid', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz')
    .addColumn('attempts', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('last_error', 'text')
    .execute();

  await db.schema
    .createIndex('outbox_events_published_at_created_at_idx')
    .on('outbox_events')
    .columns(['published_at', 'created_at'])
    .execute();
  await db.schema
    .createIndex('outbox_events_aggregate_type_aggregate_id_idx')
    .on('outbox_events')
    .columns(['aggregate_type', 'aggregate_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('outbox_events').execute();
}
