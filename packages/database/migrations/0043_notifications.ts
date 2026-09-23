// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

// DEVOS-267: a per-recipient materialization of a triggering EventEnvelope
// (DEVOS-268 gives this its first real writer). `reference_type`/
// `reference_id` mirror the envelope's own `aggregateType`/`aggregateId`;
// `type` stores the real `EventType` that fired. No `organisation_id`/
// `project_id` column — nothing in this sprint's stories needs one (see
// specs/sprints/sprint-42/README.md's grounding).
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notifications')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('recipient_principal_id', 'text', (col) => col.notNull())
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('reference_type', 'text', (col) => col.notNull())
    .addColumn('reference_id', 'text', (col) => col.notNull())
    .addColumn('read', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('read_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('notifications_recipient_principal_id_idx')
    .on('notifications')
    .column('recipient_principal_id')
    .execute();
  await db.schema
    .createIndex('notifications_created_at_idx')
    .on('notifications')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notifications').execute();
}
