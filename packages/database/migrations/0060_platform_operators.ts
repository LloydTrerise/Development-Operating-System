// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-325 (Sprint 56, `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md` §6.1,
 * candidate epic E31): `platform_operators` — a real, dormant grant recording
 * which principals hold platform-operator status, a tier that sits above and
 * outside every organisation (no existing table can represent a grant that
 * isn't scoped to exactly one organisation, see this sprint's own README
 * grounding). No row required to exist; a principal with no row is not a
 * platform operator.
 *
 * `principal_id` is the table's own primary key, not a separate surrogate id
 * — a principal can only ever hold platform-operator status once, mirroring
 * how `organisations.owner_principal_id` is a plain FK column rather than its
 * own entity. `granted_by_principal_id` is nullable specifically for the one
 * bootstrap grant (DEVOS-326) that has no human grantor; every subsequent
 * grant (DEVOS-327) populates it with the acting platform operator's own id.
 *
 * Dormant on creation: no route or use case reads/writes this table in this
 * sprint beyond its own narrowly-scoped management routes (DEVOS-327) —
 * mirrors DEVOS-311's own "dormant table" precedent exactly.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('platform_operators')
    .addColumn('principal_id', 'text', (col) => col.primaryKey().references('principals.id'))
    .addColumn('granted_at', 'timestamptz', (col) => col.notNull())
    .addColumn('granted_by_principal_id', 'text', (col: any) => col.references('principals.id'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('platform_operators').execute();
}
