// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-329 (Sprint 57, `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`
 * §6.2, candidate epic E31): `registration_tokens` — a platform-operator-
 * issued, single-use, expiring grant that DEVOS-330 requires
 * `createOrganisation` to redeem. Only the token's hash is ever stored,
 * never the raw value (`AGENTS.md` §22, backlog §9).
 *
 * `token_hash` is unique so a hash collision (cryptographically negligible,
 * but the database should never silently allow two distinct tokens to
 * resolve to the same lookup key) fails loudly at issuance rather than
 * corrupting redemption lookups.
 *
 * `redeemed_by_principal_id`/`redeemed_organisation_id` stay nullable until
 * `markRedeemed` populates both together — a token is never redeemed by a
 * principal without also recording which organisation that redemption
 * created, mirroring `platform_operators.granted_by_principal_id`'s own
 * "nullable until the one real event that populates it" shape.
 *
 * No `onDelete('cascade')` on `redeemed_organisation_id`: unlike migration
 * `0059`'s `organisation_llm_providers` (a live, org-owned resource that
 * has no meaning once its organisation is gone), a redeemed token is a
 * historical audit record of *how* that organisation came to exist — it
 * should outlive the organisation being deleted, the same way
 * `audit_records.organisation_id` (migration `0056`) is a plain nullable FK
 * with no cascade. `onDelete('set null')` is used instead, so a deleted
 * organisation's own redemption record is not itself blocked or silently
 * dropped.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('registration_tokens')
    .addColumn('id', 'uuid', (col) => col.primaryKey())
    .addColumn('token_hash', 'text', (col) => col.notNull().unique())
    .addColumn('issued_by_platform_operator_id', 'text', (col: any) =>
      col.notNull().references('principals.id'),
    )
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('redeemed_by_principal_id', 'text', (col: any) => col.references('principals.id'))
    .addColumn('redeemed_organisation_id', 'uuid', (col: any) =>
      col.references('organisations.id').onDelete('set null'),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('registration_tokens_issued_by_idx')
    .on('registration_tokens')
    .column('issued_by_platform_operator_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('registration_tokens').execute();
}
