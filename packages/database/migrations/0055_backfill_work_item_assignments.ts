// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';

/**
 * DEVOS-305 (Sprint 50, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.5,
 * decision §9.6): backfills every work item that already existed before
 * migration `0054`'s `work_item_assignments` table did with its own
 * `ASSIGNEE` row, sourced from `work_items.created_by` — the real column
 * this codebase has always used for "who made this," standing in for the
 * source document's own `reporter_id` (a real, disclosed correction: no
 * `reporter_id` column has ever existed anywhere in this schema, confirmed
 * by inspecting both `0004_work_items.ts` and `0013_work_items_add_metadata.ts`
 * — `created_by` is the only creator-attribution field a work item has,
 * the identical class of gap Sprint 48 (DEVOS-296) already found and
 * resolved the same way for `agents.accountable_owner_id`).
 *
 * Runs *before* `packages/application/src/work-items/update-work-item.ts`'s
 * own new assignment-gated restriction goes live in the same deploy, so no
 * work item that was editable by any project member a moment ago becomes
 * uneditable by everyone the instant this ships — the specific ordering
 * decision §9.6 requires. A single set-based `INSERT ... SELECT` handles
 * this environment's real 3,601 existing work items in one statement,
 * mirroring migration `0050`'s own set-based precedent for a larger table
 * (26,594 agents) rather than a per-row loop.
 *
 * `ON CONFLICT DO NOTHING` against the composite primary key: harmless and
 * correct if this migration is ever re-run against a database that already
 * has some `ASSIGNEE` rows (e.g. from `createWorkItem`'s own new
 * self-assignment, for any work item created between `0054` deploying and
 * this migration running) — never double-inserts, never errors.
 */
export async function up(db: Kysely<any>): Promise<void> {
  const now = new Date().toISOString();

  await sql`
    insert into work_item_assignments (work_item_id, principal_id, role, created_at)
    select id, created_by, 'ASSIGNEE', ${now}
    from work_items
    on conflict (work_item_id, principal_id, role) do nothing
  `.execute(db);
}

export async function down(): Promise<void> {
  // Intentional no-op: cannot distinguish this migration's own backfilled
  // rows from a real assignment a user made afterward that happens to have
  // the same (work_item_id, principal_id, 'ASSIGNEE') shape — deleting all
  // `ASSIGNEE` rows on `down` would be a genuine, silent data-loss risk for
  // real usage, mirroring migration `0044`'s own established "no full
  // data-state restoration on rollback" precedent for this class of
  // backfill migration.
}
