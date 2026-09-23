// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-268: a real, disclosed data backfill, mirroring `0031_projects_add_
 * project_type_id.ts`'s own "backfill existing rows before a new feature
 * starts reading them" precedent. `outbox_events` has accumulated a real,
 * confirmed backlog (27,178 unpublished rows found via direct Postgres
 * query against this environment's own real accumulated data) — every
 * event ever written since Sprint 1, since nothing ever drained the outbox
 * before this sprint gave `publishPendingEvents()` its first real caller.
 * Materializing that entire historical backlog into real per-member
 * `Notification` rows the moment the worker's new drain loop starts would
 * flood every real project member with tens of thousands of historical,
 * already-resolved notifications — not what this feature is for. This
 * one-time bulk update marks the pre-existing backlog published (bypassing
 * the notification sink entirely, notifying nobody) so the real
 * interval-based drain loop (`apps/worker/src/main.ts`) only ever
 * materializes notifications for events genuinely written after this
 * migration runs — "notifications start from here forward," the same
 * semantics any real notification system's first deployment needs.
 *
 * `down()` is a deliberate, disclosed no-op: which rows were originally
 * unpublished before this migration ran is information this migration
 * itself destroys — there is nothing correct to restore.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db
    .updateTable('outbox_events')
    .set({ published_at: new Date().toISOString() })
    .where('published_at', 'is', null)
    .execute();
}

export async function down(): Promise<void> {
  // Intentional no-op — see this file's own doc comment.
}
