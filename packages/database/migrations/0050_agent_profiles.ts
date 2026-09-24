// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * DEVOS-295/DEVOS-296 (Sprint 48, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md`
 * §6.3): `agent_profiles` — one row per existing `agents` row (decision
 * §9.4: one `PRINCIPAL` per named agent, shared across its own
 * `agent_versions` history), plus a real, resolved `accountable_owner_id`
 * where one can be found.
 *
 * `agent_id`/`principal_id` always hold the exact same string — `agent_id`
 * is a real `uuid` FK to `agents.id`, `principal_id` is a real `text` FK to
 * `principals.id` (the two tables' own native id types), matching
 * `HumanProfile.principalId`'s reuse convention from migration `0045`.
 *
 * This environment has 26,594 real `agents` rows (and as many
 * `agent_versions` rows) at the time this migration was written — a
 * per-row JS loop (the pattern `0048` used for organisations, at a much
 * smaller real scale) would not finish in reasonable time here, so both
 * backfill inserts below are set-based SQL, not a loop.
 *
 * `accountable_owner_id` resolves from each agent's own earliest
 * (`MIN(version)`) `agent_versions.created_by` — the only creator-
 * attribution field that exists for an agent anywhere in this schema
 * (`agents` itself has no `created_by` column, unlike `agent_versions`;
 * see DEVOS-025's own task report for why). Left `NULL`, not fabricated,
 * whenever that id does not resolve to an already-backfilled `principals`
 * row with `principal_type = 'HUMAN'` — disclosed per real result in
 * `specs/sprints/sprint-48/DEVOS-296.md`, not defaulted to anything.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('agent_profiles')
    .addColumn('agent_id', 'uuid', (col: any) =>
      // onDelete('cascade'): unlike every other principal-backed entity in
      // this codebase (nothing is ever hard-deleted in production, per
      // AGENTS.md §3), several real e2e test suites' own cleanup code does
      // hard-delete the real test `agents` rows they create — a real,
      // disclosed FK-violation regression found while running the full e2e
      // suite for this sprint's own required validation. A profile has no
      // independent existence once its own agent is gone, so cascading is
      // the correct semantics here, not a workaround.
      col.primaryKey().references('agents.id').onDelete('cascade'),
    )
    .addColumn('principal_id', 'text', (col: any) => col.notNull().references('principals.id'))
    .addColumn('accountable_owner_id', 'text', (col: any) => col.references('principals.id'))
    .addColumn('created_at', 'timestamptz', (col: any) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col: any) => col.notNull())
    .addUniqueConstraint('agent_profiles_principal_id_key', ['principal_id'])
    .execute();

  const now = new Date().toISOString();

  await sql`
    INSERT INTO principals (id, principal_type, created_at, updated_at)
    SELECT id::text, 'AGENT', ${now}, ${now}
    FROM agents
    ON CONFLICT (id) DO NOTHING
  `.execute(db);

  await sql`
    INSERT INTO agent_profiles (agent_id, principal_id, accountable_owner_id, created_at, updated_at)
    SELECT
      a.id,
      a.id::text,
      owner.id,
      ${now},
      ${now}
    FROM agents a
    LEFT JOIN LATERAL (
      SELECT av.created_by
      FROM agent_versions av
      WHERE av.agent_id = a.id
      ORDER BY av.version ASC
      LIMIT 1
    ) earliest_version ON true
    LEFT JOIN principals owner
      ON owner.id = earliest_version.created_by AND owner.principal_type = 'HUMAN'
    ON CONFLICT (agent_id) DO NOTHING
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('agent_profiles').execute();
  await db.deleteFrom('principals').where('principal_type', '=', 'AGENT').execute();
}
