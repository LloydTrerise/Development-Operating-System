// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

/**
 * DEVOS-309 (Sprint 51's own reconciliation): the source document's
 * `agent.manage` permission ("create, configure, revoke credentials"),
 * scoped down to "create, configure" — no `AGENT_CREDENTIAL` was ever built
 * (deliberately, per `AGENTS.md`/decision §9.7), so "revoke credentials"
 * has no meaning here. Granted to `PROJECT:OWNER` and
 * `ORGANISATION:ORGANISATION_ADMIN`, mirroring every other consequential
 * project-wide permission's own bar (`agent.publish`, `workflow.publish`)
 * — the *creation* of a brand-new agent has no existing
 * `AGENT_PROFILE.accountableOwnerId` to defer to yet (see
 * `packages/domain/src/projects/authorization.ts`'s `canManageAgent`),
 * so it uses this role-based permission only; a *configure* action
 * (drafting a new version of an existing agent) additionally accepts the
 * agent's own resolved accountable owner, checked directly against
 * `AgentProfile.accountableOwnerId`, not through this catalogue, mirroring
 * `division.transfer_ownership`'s own "checked against ... not against a
 * role" precedent.
 */
const AGENT_MANAGE_PERMISSION_KEY = 'agent.manage';
const PROJECT_OWNER_ACCESS_ROLE_ID = 'PROJECT:OWNER';
const ORGANISATION_ADMIN_ACCESS_ROLE_ID = 'ORGANISATION:ORGANISATION_ADMIN';

export async function up(db: Kysely<any>): Promise<void> {
  const now = new Date().toISOString();

  await db
    .insertInto('permissions')
    .values({
      id: AGENT_MANAGE_PERMISSION_KEY,
      key: AGENT_MANAGE_PERMISSION_KEY,
      name: AGENT_MANAGE_PERMISSION_KEY,
      created_at: now,
    })
    .execute();

  await db
    .insertInto('role_permissions')
    .values([
      { access_role_id: PROJECT_OWNER_ACCESS_ROLE_ID, permission_id: AGENT_MANAGE_PERMISSION_KEY },
      {
        access_role_id: ORGANISATION_ADMIN_ACCESS_ROLE_ID,
        permission_id: AGENT_MANAGE_PERMISSION_KEY,
      },
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db
    .deleteFrom('role_permissions')
    .where('permission_id', '=', AGENT_MANAGE_PERMISSION_KEY)
    .execute();
  await db.deleteFrom('permissions').where('id', '=', AGENT_MANAGE_PERMISSION_KEY).execute();
}
