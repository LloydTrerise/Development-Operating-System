// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-345 (Sprint 61, Epic E31 gap closure, `specs/DEVOS-E31-GAP-CLOSURE-
 * SPRINT.md` §6 Decision 1): a separate, dedicated audit concept for
 * platform-operator grant/revoke — deliberately carries no `organisation_id`
 * column at all, unlike `audit_records` (migration `0012`), since a platform
 * operator sits above and outside every organisation by design (migration
 * `0060`'s own doc comment). Mirrors `platform_operators`/`registration_tokens`'s
 * own established precedent of a new table for a new tier.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('platform_audit_records')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('actor_principal_id', 'text', (col) => col.notNull().references('principals.id'))
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('target_principal_id', 'text', (col) => col.notNull().references('principals.id'))
    .addColumn('outcome', 'text', (col) => col.notNull())
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('platform_audit_records_created_at_idx')
    .on('platform_audit_records')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('platform_audit_records').execute();
}
