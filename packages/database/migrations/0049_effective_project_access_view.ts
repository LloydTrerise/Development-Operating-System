// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * DEVOS-291 (Sprint 47, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.2):
 * the source document's `effective_project_access` view, with its
 * "division admin"/"division owner" `UNION` branches applied at
 * organisation scope instead — no `DIVISION` tier exists in this codebase
 * (backlog §9.2, Organisation and Division are the same thing here). One
 * `(principal_id, project_id)` row for every project a principal can
 * reach, from three sources:
 *
 * 1. A direct project-level membership row (`memberships.project_id`
 *    matches the project) — today's existing, unchanged access.
 * 2. An org-level `ORGANISATION_ADMIN` membership row — reaches every
 *    project in that same organisation (migration `0048`'s co-admin pool).
 * 3. The organisation's own `owner_principal_id` — reaches every project
 *    in that organisation even without an explicit membership row of
 *    their own (the "caller-supplied principal" case `0048`'s own doc
 *    comment names, defensive against real data today, which always gives
 *    the owner a membership row too).
 *
 * `packages/database/src/repositories/effective-project-access.ts` queries
 * this view; `packages/application/src/projects/list-projects-for-principal.ts`
 * (DEVOS-292) is its first real consumer.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE VIEW effective_project_access AS
      SELECT principal_id, project_id
      FROM memberships
      WHERE project_id IS NOT NULL

      UNION

      SELECT m.principal_id, p.id AS project_id
      FROM memberships m
      JOIN projects p ON p.organisation_id = m.organisation_id
      WHERE m.project_id IS NULL AND m.role = 'ORGANISATION_ADMIN'

      UNION

      SELECT o.owner_principal_id AS principal_id, p.id AS project_id
      FROM organisations o
      JOIN projects p ON p.organisation_id = o.id
      WHERE o.owner_principal_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP VIEW effective_project_access`.execute(db);
}
