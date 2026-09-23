// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-284 (Sprint 46, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.1):
 * `principals`/`human_profiles` are new, additive tables — a durable
 * identity row behind every human actor id this codebase already writes as
 * a bare `text` string (`memberships.principal_id`, `audit_records.actor_id`).
 * `principals.id` is deliberately that same string, not a freshly-minted
 * UUID (see `packages/domain/src/principals/principal.ts`'s own doc
 * comment) — no existing membership/audit lookup changes, only gains a real
 * row to resolve through.
 *
 * The backfill excludes `'devos-agent-runtime'` (`SEED_AGENT_RUNTIME_
 * PRINCIPAL_ID`, `packages/database/src/seed-constants.ts`) by its known
 * literal value, duplicated here rather than imported per this migration
 * folder's own established self-contained-record convention (e.g. `0031`,
 * `0038`) — it is a system actor, not a human, and Sprint 46 is explicitly
 * scoped to human identity only (agents get their own `AGENT_PROFILE` in
 * Sprint 48, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.3).
 *
 * No email is resolvable for any backfilled row — neither `memberships` nor
 * `audit_records` has ever stored one — so every `human_profiles.email`
 * this migration writes is genuinely `null`, disclosed rather than
 * fabricated (`specs/sprints/sprint-46/DEVOS-284.md`).
 */
const SEED_AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('principals')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('principal_type', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('human_profiles')
    .addColumn('principal_id', 'text', (col) => col.primaryKey().references('principals.id'))
    .addColumn('email', 'text')
    .addColumn('display_name', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute();

  const now = new Date().toISOString();

  const membershipActorIds = await db
    .selectFrom('memberships')
    .select('principal_id')
    .distinct()
    .execute();
  const auditActorIds = await db
    .selectFrom('audit_records')
    .select('actor_id')
    .distinct()
    .where('actor_type', '=', 'USER')
    .execute();

  // A real, live-verified finding: `devos-agent-runtime`'s own audit records
  // are not consistently stamped `actor_type: 'SYSTEM'` — some carry `'USER'`
  // instead (a pre-existing inconsistency in callers that write audit
  // records, out of this migration's own scope to correct) — so the
  // exclusion is applied by literal actor id to both source queries, not
  // just the `memberships` one, or this system actor would be backfilled as
  // human via the `audit_records` branch alone.
  const humanActorIds = new Set<string>();
  for (const row of membershipActorIds as Array<{ principal_id: string }>) {
    if (row.principal_id !== SEED_AGENT_RUNTIME_PRINCIPAL_ID) humanActorIds.add(row.principal_id);
  }
  for (const row of auditActorIds as Array<{ actor_id: string }>) {
    if (row.actor_id !== SEED_AGENT_RUNTIME_PRINCIPAL_ID) humanActorIds.add(row.actor_id);
  }

  if (humanActorIds.size > 0) {
    await db
      .insertInto('principals')
      .values(
        [...humanActorIds].map((id) => ({
          id,
          principal_type: 'HUMAN',
          created_at: now,
          updated_at: now,
        })),
      )
      .onConflict((oc: any) => oc.column('id').doNothing())
      .execute();

    await db
      .insertInto('human_profiles')
      .values(
        [...humanActorIds].map((id) => ({
          principal_id: id,
          email: null,
          display_name: null,
          created_at: now,
          updated_at: now,
        })),
      )
      .onConflict((oc: any) => oc.column('principal_id').doNothing())
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('human_profiles').execute();
  await db.schema.dropTable('principals').execute();
}
