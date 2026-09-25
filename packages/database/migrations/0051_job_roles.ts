// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-299 (Sprint 49, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.4):
 * `job_roles`/`principal_job_roles` — a real, seeded job-role catalogue,
 * explicitly distinct from the existing agent workflow-role dispatch key
 * (decision §9.5) and from `MembershipRole` (`OWNER`/`MEMBER`/
 * `ORGANISATION_ADMIN`, an access-role axis, `packages/domain/src/
 * projects/membership.ts`) — job roles are a separate, orthogonal axis.
 *
 * `job_roles` is seeded per-organisation (not a single global catalogue) so
 * a future sprint could let an organisation define its own equivalent set
 * without a schema change — this sprint only ever seeds the default four
 * (`PO`/`BA`/`DEV`/`QA`) for every organisation that exists at migration
 * time; `packages/database/src/repositories/job-roles.ts`'s
 * `ensureDefaultJobRolesForOrganisation` is the real, ongoing counterpart
 * wired into `createOrganisationRepository.create()` so a newly created
 * organisation gets the same four going forward. This environment's real
 * organisation count is small (a handful, not agent/project scale), so a
 * per-row loop is fine here, unlike migration `0050`'s set-based approach.
 *
 * `principal_job_roles` records that a principal (`HUMAN` or `AGENT`,
 * decision §9.5's dependency on Sprint 48) holds a job role at organisation
 * scope. Its primary key `(principal_id, job_role_id)` is deliberately the
 * same pair migration `0052`'s `project_member_job_roles` composite-FKs
 * against — the real, database-enforced form of "a project can only
 * activate a job role the principal already holds."
 *
 * `onDelete('cascade')` on both FKs below: a real, disclosed fix found
 * while running this sprint's own required full `tests/e2e` suite — two
 * existing pilot tests (`cost-budget-pilot.test.ts`,
 * `knowledge-platform-marketplace-pilot.test.ts`) hard-delete their own
 * test organisations as part of cleanup, and `ensureDefaultJobRolesForOrganisation`
 * now gives every organisation, including theirs, a real `job_roles` row —
 * without cascading, that organisation delete fails with a foreign-key
 * violation, the identical class of gap Sprint 48's `agent_profiles` FK
 * already found and fixed for agent-hard-delete cleanup. A job role (and
 * any grant of it) has no independent meaning once its own organisation is
 * gone, so cascading is the correct semantics here, not a workaround.
 */
const DEFAULT_JOB_ROLES = [
  { key: 'PO', name: 'Product Owner' },
  { key: 'BA', name: 'Business Analyst' },
  { key: 'DEV', name: 'Developer' },
  { key: 'QA', name: 'Quality Assurance' },
] as const;

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('job_roles')
    .addColumn('id', 'text', (col: any) => col.primaryKey())
    .addColumn('organisation_id', 'uuid', (col: any) =>
      col.notNull().references('organisations.id').onDelete('cascade'),
    )
    .addColumn('key', 'text', (col: any) => col.notNull())
    .addColumn('name', 'text', (col: any) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col: any) => col.notNull())
    .addUniqueConstraint('job_roles_organisation_id_key_key', ['organisation_id', 'key'])
    .execute();

  await db.schema
    .createTable('principal_job_roles')
    .addColumn('principal_id', 'text', (col: any) => col.notNull().references('principals.id'))
    .addColumn('job_role_id', 'text', (col: any) =>
      col.notNull().references('job_roles.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col: any) => col.notNull())
    .addPrimaryKeyConstraint('principal_job_roles_pkey', ['principal_id', 'job_role_id'])
    .execute();

  const now = new Date().toISOString();
  const organisations = await db.selectFrom('organisations').select('id').execute();

  for (const { id: organisationId } of organisations as Array<{ id: string }>) {
    await db
      .insertInto('job_roles')
      .values(
        DEFAULT_JOB_ROLES.map(({ key, name }) => ({
          id: `${organisationId}:${key}`,
          organisation_id: organisationId,
          key,
          name,
          created_at: now,
        })),
      )
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('principal_job_roles').execute();
  await db.schema.dropTable('job_roles').execute();
}
