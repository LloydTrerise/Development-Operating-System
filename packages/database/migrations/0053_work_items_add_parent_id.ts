// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-303 (Sprint 50, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.5):
 * `work_items.parent_id` — a self-referencing FK, constrained to the same
 * `project_id` as its parent, matching the source document's hierarchy
 * rule. Postgres cannot express "same project_id as the referenced row"
 * with a plain single-column FK, so this migration first adds a real
 * unique constraint on `(id, project_id)` — trivially satisfiable since
 * `id` is already the primary key — purely so a composite FK can target it,
 * the identical technique migration `0052`'s
 * `project_member_job_roles_principal_job_role_fkey` already established
 * for the same class of problem ("a row may only reference another row
 * that already shares one of its own scope columns").
 *
 * `onDelete('set null')`, not `cascade`: a parent work item being removed
 * should not delete its children — it should merely detach them, matching
 * this codebase's own "archive, don't cascade-destroy user content" bias
 * (`AGENTS.md` §3, "Nothing is hard-deleted"). Nothing in this codebase
 * hard-deletes a `work_items` row today, so this branch is not exercised by
 * any current code path, but is the correct semantics if one is ever added.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('work_items')
    .addUniqueConstraint('work_items_id_project_id_key', ['id', 'project_id'])
    .execute();

  await db.schema.alterTable('work_items').addColumn('parent_id', 'uuid').execute();

  await db.schema
    .alterTable('work_items')
    .addForeignKeyConstraint(
      'work_items_parent_id_project_id_fkey',
      ['parent_id', 'project_id'],
      'work_items',
      ['id', 'project_id'],
      (cb: any) => cb.onDelete('set null'),
    )
    .execute();

  await db.schema
    .createIndex('work_items_parent_id_idx')
    .on('work_items')
    .column('parent_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('work_items_parent_id_idx').execute();
  await db.schema
    .alterTable('work_items')
    .dropConstraint('work_items_parent_id_project_id_fkey')
    .execute();
  await db.schema.alterTable('work_items').dropColumn('parent_id').execute();
  await db.schema.alterTable('work_items').dropConstraint('work_items_id_project_id_key').execute();
}
