// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * Gap revisit (post-Sprint-16): DEVOS-143's own N-of-M design disclosed a
 * hardcoded fail-fast rejection rule ("any single REJECTED decision fails
 * the whole approval") as a flagged assumption, not a spec-mandated design.
 * This makes it real, configurable policy rather than a hardcoded
 * constant — default `1` preserves the exact existing fail-fast behaviour
 * for every approval that doesn't set it.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('approvals')
    .addColumn('required_rejections', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').dropColumn('required_rejections').execute();
}
