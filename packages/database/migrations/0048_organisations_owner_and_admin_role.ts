// Migrations run against a schema mid-construction, before it matches the
// final Database type — Kysely's own migration examples use Kysely<any> here.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';

/**
 * DEVOS-290 (Sprint 47, `specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §6.2):
 * `organisations.owner_principal_id` + a new `ORGANISATION_ADMIN` access
 * role, replacing Sprint 39's org-level `OWNER`/`MEMBER` `memberships` rows
 * per the epic's resolved decisions (§9.2/§9.3):
 *
 * - Every organisation's existing org-level (`project_id IS NULL`) `OWNER`
 *   rows become the `ORGANISATION_ADMIN` co-admin pool (all of them, not
 *   just one) — one is picked (earliest `created_at`, tie-broken by `id`)
 *   as the single transferable `owner_principal_id`.
 * - An organisation with no org-level `OWNER` row at all (a real gap
 *   `packages/application/src/organisations/membership-access.ts`'s own
 *   `resolveOrganisationMembership` already discloses falling back to "any
 *   project-level OWNER") gets one synthesized from its earliest
 *   project-level `OWNER` membership, excluding the known system actor
 *   (`'devos-agent-runtime'`, duplicated here by literal value per this
 *   migration folder's own established self-contained-record convention —
 *   see `0045`) — mirroring Sprint 39's own live-verification precedent of
 *   adding a real org-level `OWNER` row where one was missing.
 * - Org-level `MEMBER` rows are dropped entirely (decision §9.3: a plain
 *   org member with no admin role and no project membership gets no access
 *   under the new model).
 *
 * `ORGANISATION_ADMIN` is granted the same nine permissions `0047` granted
 * `PROJECT:OWNER` — an organisation admin/owner needs project-OWNER-
 * equivalent authority on every project in their organisation, matching the
 * `resolveMembership()` org-level fallback these permissions are checked
 * through (`packages/application/src/projects/membership-access.ts`).
 */
const SEED_AGENT_RUNTIME_PRINCIPAL_ID = 'devos-agent-runtime';
const ORGANISATION_ADMIN_ACCESS_ROLE_ID = 'ORGANISATION:ORGANISATION_ADMIN';
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

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('organisations')
    .addColumn('owner_principal_id', 'text', (col: any) => col.references('principals.id'))
    .execute();

  const now = new Date().toISOString();

  await db
    .insertInto('access_roles')
    .values({
      id: ORGANISATION_ADMIN_ACCESS_ROLE_ID,
      scope_type: 'ORGANISATION',
      key: 'ORGANISATION_ADMIN',
      name: 'Organisation Admin',
      created_at: now,
    })
    .execute();

  await db
    .insertInto('role_permissions')
    .values(
      PROJECT_PERMISSION_KEYS.map((key) => ({
        access_role_id: ORGANISATION_ADMIN_ACCESS_ROLE_ID,
        permission_id: key,
      })),
    )
    .execute();

  const organisations = await db.selectFrom('organisations').select('id').execute();

  for (const { id: organisationId } of organisations as Array<{ id: string }>) {
    const orgLevelOwnerRows = await db
      .selectFrom('memberships')
      .select(['id', 'principal_id'])
      .where('organisation_id', '=', organisationId)
      .where('project_id', 'is', null)
      .where('role', '=', 'OWNER')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .execute();

    let ownerPrincipalId: string | null = null;

    if (orgLevelOwnerRows.length > 0) {
      ownerPrincipalId = (orgLevelOwnerRows[0] as { principal_id: string }).principal_id;

      await db
        .updateTable('memberships')
        .set({ role: 'ORGANISATION_ADMIN', updated_at: now })
        .where('organisation_id', '=', organisationId)
        .where('project_id', 'is', null)
        .where('role', '=', 'OWNER')
        .execute();
    } else {
      const fallbackOwner = await db
        .selectFrom('memberships')
        .select(['principal_id'])
        .where('organisation_id', '=', organisationId)
        .where('project_id', 'is not', null)
        .where('role', '=', 'OWNER')
        .where('principal_id', '!=', SEED_AGENT_RUNTIME_PRINCIPAL_ID)
        .orderBy('created_at', 'asc')
        .orderBy('id', 'asc')
        .executeTakeFirst();

      if (fallbackOwner) {
        ownerPrincipalId = (fallbackOwner as { principal_id: string }).principal_id;

        await db
          .insertInto('memberships')
          .values({
            id: randomUUID(),
            organisation_id: organisationId,
            project_id: null,
            principal_id: ownerPrincipalId,
            role: 'ORGANISATION_ADMIN',
            status: 'ACTIVE',
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
      // Else: a genuinely ownerless organisation (no membership of any kind
      // exists for it) — `owner_principal_id` stays null, disclosed in
      // `specs/sprints/sprint-47/DEVOS-290.md` rather than fabricated;
      // `createOrganisation` (application layer) always creates one going
      // forward, so this should not occur against real data.
    }

    if (ownerPrincipalId !== null) {
      await db
        .updateTable('organisations')
        .set({ owner_principal_id: ownerPrincipalId, updated_at: now })
        .where('id', '=', organisationId)
        .execute();
    }
  }

  // Decision §9.3: the org-level MEMBER concept is dropped entirely — a
  // plain org member with no admin role and no project membership now gets
  // no access under the new model.
  await db
    .deleteFrom('memberships')
    .where('project_id', 'is', null)
    .where('role', '=', 'MEMBER')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Best-effort schema/role reversal — the org-level MEMBER rows this
  // migration deletes above cannot be restored (a genuine, disclosed data
  // loss on rollback, consistent with this migration folder's own
  // established practice of not attempting full data-state restoration on
  // `down`, e.g. `0044`).
  await db
    .updateTable('memberships')
    .set({ role: 'OWNER' })
    .where('role', '=', 'ORGANISATION_ADMIN')
    .execute();

  await db
    .deleteFrom('role_permissions')
    .where('access_role_id', '=', ORGANISATION_ADMIN_ACCESS_ROLE_ID)
    .execute();
  await db.deleteFrom('access_roles').where('id', '=', ORGANISATION_ADMIN_ACCESS_ROLE_ID).execute();

  await db.schema.alterTable('organisations').dropColumn('owner_principal_id').execute();
}
