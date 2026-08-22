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

    async create(membership) {
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
