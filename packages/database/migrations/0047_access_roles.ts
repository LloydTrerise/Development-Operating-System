// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-288 (Sprint 47, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.2):
 * `access_roles`/`permissions`/`role_permissions` are new, additive tables —
 * a real, seeded catalogue backing `packages/domain/src/projects/
 * authorization.ts`'s catalogue-driven `canX()` functions (DEVOS-289).
 *
 * Seeded here (in the migration itself, not `packages/database/src/seed.ts`)
 * because this is baseline reference data every environment needs to
 * function correctly the moment it migrates — not optional demo data.
 *
 * The permission set reproduces today's nine hardcoded `canX()` grants
 * exactly: `PROJECT:OWNER` gets all nine, `PROJECT:MEMBER` gets none —
 * see `packages/domain/src/access-control/permission-catalogue.ts`'s own
 * `projectPermissionKeys`/`DEFAULT_ACCESS_ROLE_CATALOGUE`, which this
 * migration's seed data is a literal, real-table mirror of.
 */
const PROJECT_PERMISSION_KEYS = [
  'project.manage_members',
  'project.update',
  'organisation.update',
  'approval.decide',
  'policy.publish',
  'integration.register',
  'agent.publish',
  'workflow.publish',
  'tool_capability.manage',
] as const;

const PROJECT_OWNER_ACCESS_ROLE_ID = 'PROJECT:OWNER';
const PROJECT_MEMBER_ACCESS_ROLE_ID = 'PROJECT:MEMBER';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('access_roles')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('scope_type', 'text', (col) => col.notNull())
    .addColumn('key', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('permissions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('key', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('role_permissions')
    .addColumn('access_role_id', 'text', (col) => col.notNull().references('access_roles.id'))
    .addColumn('permission_id', 'text', (col) => col.notNull().references('permissions.id'))
    .addPrimaryKeyConstraint('role_permissions_pkey', ['access_role_id', 'permission_id'])
    .execute();

  const now = new Date().toISOString();

  await db
    .insertInto('access_roles')
    .values([
      {
        id: PROJECT_OWNER_ACCESS_ROLE_ID,
        scope_type: 'PROJECT',
        key: 'OWNER',
        name: 'Project Owner',
        created_at: now,
      },
      {
        id: PROJECT_MEMBER_ACCESS_ROLE_ID,
        scope_type: 'PROJECT',
        key: 'MEMBER',
        name: 'Project Member',
        created_at: now,
      },
    ])
    .execute();

  await db
    .insertInto('permissions')
    .values(
      PROJECT_PERMISSION_KEYS.map((key) => ({
        id: key,
        key,
        name: key,
        created_at: now,
      })),
    )
    .execute();

  await db
    .insertInto('role_permissions')
    .values(
      PROJECT_PERMISSION_KEYS.map((key) => ({
        access_role_id: PROJECT_OWNER_ACCESS_ROLE_ID,
        permission_id: key,
      })),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('role_permissions').execute();
  await db.schema.dropTable('permissions').execute();
  await db.schema.dropTable('access_roles').execute();
}
