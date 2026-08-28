// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * Step A of a two-migration NOT NULL rollout (specs/architecture/
 * organisations-and-project-types.md §5.4): real project rows already exist
 * (the seeded project, plus every project created during this repo's own
 * prior testing), so a NOT NULL foreign key can't be added in one step.
 * This migration adds the column nullable, seeds the one 'software-
 * development' Project Type row every pre-existing project backfills to
 * (same fixed id as `SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID` in
 * `@devos/domain`'s `packages/domain/src/project-types/project-type.ts` —
 * duplicated as a literal here, not imported, so this migration stays a
 * self-contained historical record per this repo's existing migration
 * convention), then backfills every existing row. Migration 0032 tightens
 * the column to NOT NULL once this backfill has run.
 */
const SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID = '00000000-0000-4000-8000-000000000023';

export async function up(db: Kysely<any>): Promise<void> {
  const now = new Date().toISOString();

  await db.schema.alterTable('projects').addColumn('project_type_id', 'uuid').execute();

  await db
    .insertInto('project_types')
    .values({
      id: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID,
      key: 'software-development',
      name: 'Software Development',
      description: null,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc: any) => oc.column('id').doNothing())
    .execute();

  await db
    .updateTable('projects')
    .set({ project_type_id: SEED_SOFTWARE_DEVELOPMENT_PROJECT_TYPE_ID })
    .where('project_type_id', 'is', null)
    .execute();

  await db.schema
    .alterTable('projects')
    .addForeignKeyConstraint('projects_project_type_id_fkey', ['project_type_id'], 'project_types', [
      'id',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('projects').dropConstraint('projects_project_type_id_fkey').execute();
  await db.schema.alterTable('projects').dropColumn('project_type_id').execute();
}
