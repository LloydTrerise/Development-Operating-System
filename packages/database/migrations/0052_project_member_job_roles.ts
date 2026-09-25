// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-300 (Sprint 49, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.4):
 * `project_member_job_roles` — the per-project *active* subset of job roles
 * a principal already holds (`principal_job_roles`, migration `0051`).
 *
 * The composite foreign key `(principal_id, job_role_id)` referencing
 * `principal_job_roles`'s own primary key is the real, database-enforced
 * form of the source document's rule: a project can never activate a job
 * role for a principal who doesn't already hold it at organisation scope
 * (e.g. a Dev+BA can be activated as Dev on a project that only ever
 * granted them the Dev job role, never as BA there too, without first being
 * granted BA at organisation scope) — Postgres rejects the insert directly,
 * not just an application-layer check that could drift from the schema.
 *
 * No FK ties `project_id`'s organisation to `job_role_id`'s organisation
 * directly (Postgres cannot express a three-table conditional FK) —
 * `packages/application/src/job-roles/assign-project-member-job-role.ts`
 * checks that the project's `organisationId` matches the job role's
 * `organisationId` before inserting, the same class of application-layer
 * cross-check this codebase already relies on elsewhere (e.g.
 * `addMember` rejecting `ORGANISATION_ADMIN` at project scope).
 *
 * `onDelete('cascade')` on the composite FK: revoking a job role at
 * organisation scope (`principal_job_roles`) also deactivates it from every
 * project it was activated on — the correct real-world semantics (a
 * principal no longer holding a job role at all cannot remain "active" in
 * it on any project), not a workaround.
 *
 * `onDelete('cascade')` on `project_id`: a preventive real fix, applied
 * proactively rather than waiting to find it live — migration `0051`'s own
 * identical `job_roles`/`organisations` cascade gap was found the hard way
 * by this sprint's own required full `tests/e2e` run (several existing
 * pilot tests hard-delete their own test projects as cleanup); a
 * `project_member_job_roles` row has no independent meaning once its own
 * project is gone, so the same fix is applied here before any test
 * exercising this table hits the identical foreign-key violation.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('project_member_job_roles')
    .addColumn('project_id', 'uuid', (col: any) =>
      col.notNull().references('projects.id').onDelete('cascade'),
    )
    .addColumn('principal_id', 'text', (col: any) => col.notNull())
    .addColumn('job_role_id', 'text', (col: any) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col: any) => col.notNull())
    .addPrimaryKeyConstraint('project_member_job_roles_pkey', [
      'project_id',
      'principal_id',
      'job_role_id',
    ])
    .addForeignKeyConstraint(
      'project_member_job_roles_principal_job_role_fkey',
      ['principal_id', 'job_role_id'],
      'principal_job_roles',
      ['principal_id', 'job_role_id'],
      (cb: any) => cb.onDelete('cascade'),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('project_member_job_roles').execute();
}
