// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

/**
 * DEVOS-339 (Sprint 59, `specs/DEVOS-ORGANISATION-ONBOARDING-BACKLOG.md`
 * §6.4, candidate epic E31 part 4): the disclosed backfill mechanism
 * recorded in full in `specs/sprints/sprint-59/README.md`'s own "⚠ Disclosed
 * decision" section — re-read it before changing this migration.
 *
 * Sprint 58 (DEVOS-333) deliberately persists nothing for `INITIALISED`
 * itself; it is computed live from `projects`/`organisation_llm_providers`/
 * `policies`. That leaves no stored value for this sprint's own new
 * enforcement guard to "backfill" in the literal sense migration `0055`'s
 * own `ASSIGNEE = created_by` precedent used. This migration instead adds a
 * new, narrow, nullable column recording a categorically different fact —
 * "was this organisation exempted from a rule that did not exist when it
 * was created" — which, unlike a derived status, never goes stale once set.
 *
 * Every organisation that exists at the moment this migration runs is
 * backfilled with a real, non-null timestamp in one set-based `UPDATE`,
 * mirroring migration `0055`'s own precedent exactly. Every organisation
 * `createOrganisation` creates from this point forward leaves the column
 * `NULL` (no default) — per backlog §4, there is no grandfathering path for
 * an organisation created after this epic ships.
 *
 * Runs *before* Sprint 59's own new initialisation-gate guard is wired into
 * the live route surface (DEVOS-338) in the same deploy, so no organisation
 * that could mutate a moment ago is suddenly blocked the instant the guard
 * goes live — the same ordering discipline migration `0055` established for
 * `work_item_assignments`.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('organisations')
    .addColumn('initialisation_enforcement_exempt_at', 'timestamptz')
    .execute();

  const now = new Date().toISOString();
  await sql`
    update organisations
    set initialisation_enforcement_exempt_at = ${now}
    where initialisation_enforcement_exempt_at is null
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // DEVOS-339: dropping the column is safe and fully reversible (unlike
  // migration `0055`'s own deliberate no-op `down()`) — this column has no
  // other writer anywhere in this codebase's scope, so no real data outside
  // this migration's own backfill could ever be lost by removing it.
  await db.schema
    .alterTable('organisations')
    .dropColumn('initialisation_enforcement_exempt_at')
    .execute();
}
