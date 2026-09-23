import type { MembershipId, OrganisationId, ProjectId } from '@devos/contracts';
import type { Membership, MembershipRepository, MembershipRole } from '@devos/domain';
import type { MembershipsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: MembershipsTable): Membership {
  return {
    id: row.id as MembershipId,
    organisationId: row.organisation_id as OrganisationId,
    projectId: row.project_id !== null ? (row.project_id as ProjectId) : null,
    principalId: row.principal_id,
    role: row.role as MembershipRole,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createMembershipRepository(db: QueryExecutor): MembershipRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('memberships')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getForPrincipalAndProject(principalId, projectId) {
      const row = await db
        .selectFrom('memberships')
        .selectAll()
        .where('principal_id', '=', principalId)
        .where('project_id', '=', projectId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForPrincipal(principalId) {
      const rows = await db
        .selectFrom('memberships')
        .selectAll()
        .where('principal_id', '=', principalId)
        .execute();
      return rows.map(toDomain);
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('memberships')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async listForOrganisation(organisationId) {
      const rows = await db
        .selectFrom('memberships')
        .selectAll()
        .where('organisation_id', '=', organisationId)
        .where('project_id', 'is', null)
        .execute();
      return rows.map(toDomain);
    },

    async create(membership) {
      // DEVOS-286: every membership.principal_id this codebase writes going
      // forward resolves through a real PRINCIPAL(+HUMAN_PROFILE) row from
      // the moment of creation, closing the gap DEVOS-284's own migration
      // backfill only closed retroactively — get-or-create, real writes
      // against the same real tables that migration populated, not a
      // parallel mechanism. `seed.ts`'s own direct inserts bypass this
      // repository (this codebase's established convention — see
      // `create-project-with-clones.ts`), so it separately seeds the same
      // invariant for its own fixed seed principals.
      const now = new Date().toISOString();
      await db
        .insertInto('principals')
        .values({
          id: membership.principalId,
          principal_type: 'HUMAN',
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      await db
        .insertInto('human_profiles')
        .values({
          principal_id: membership.principalId,
          email: null,
          display_name: null,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc) => oc.column('principal_id').doNothing())
        .execute();

      await db
        .insertInto('memberships')
        .values({
          id: membership.id,
          organisation_id: membership.organisationId,
          project_id: membership.projectId,
          principal_id: membership.principalId,
          role: membership.role,
          status: membership.status,
          created_at: membership.createdAt,
          updated_at: membership.updatedAt,
        })
        .execute();
    },

    async updateRole(id, role, updatedAt) {
      await db
        .updateTable('memberships')
        .set({ role, updated_at: updatedAt })
        .where('id', '=', id)
        .execute();
    },

    async remove(id) {
      await db.deleteFrom('memberships').where('id', '=', id).execute();
    },
  };
}
