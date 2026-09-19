// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-145: a real, optional expiry for a `PENDING` approval. Nullable —
 * an approval with no `expires_at` never auto-expires, so every existing
 * approval is unaffected.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').addColumn('expires_at', 'timestamptz').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').dropColumn('expires_at').execute();
}
