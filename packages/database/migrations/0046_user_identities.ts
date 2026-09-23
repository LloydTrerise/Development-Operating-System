// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-285 (Sprint 46, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.1):
 * one row per `(provider, provider_subject)` a human has ever authenticated
 * with — `provider_subject` is deliberately the exact same value as
 * `principal_id` (the OIDC `sub` claim; see `0045_principals.ts`'s own doc
 * comment for why `principals.id` reuses that same string), so this table
 * is a real login record layered on top of the existing identity, not a
 * second identity namespace requiring its own resolution.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_identities')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('principal_id', 'text', (col) => col.notNull().references('principals.id'))
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('provider_subject', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('user_identities_provider_subject_idx')
    .on('user_identities')
    .columns(['provider', 'provider_subject'])
    .unique()
    .execute();

  await db.schema
    .createIndex('user_identities_principal_id_idx')
    .on('user_identities')
    .column('principal_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_identities').execute();
}
