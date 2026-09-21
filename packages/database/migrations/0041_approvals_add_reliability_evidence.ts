// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-199: records whether an `APPROVAL` node's own optional
 * `reliabilityReduction` config was checked at creation time, and its
 * outcome — mirroring `evidence_reference`'s own nullable-JSONB shape.
 * Nullable: every pre-existing approval, and any new approval from a node
 * with no `reliabilityReduction` configured, leaves this unset and is
 * completely unaffected.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').addColumn('reliability_evidence', 'jsonb').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('approvals').dropColumn('reliability_evidence').execute();
}
