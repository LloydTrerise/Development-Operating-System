import type { PrincipalJobRole, PrincipalJobRoleRepository } from '@devos/domain';
import type { PrincipalJobRolesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: PrincipalJobRolesTable): PrincipalJobRole {
  return {
    principalId: row.principal_id,
    jobRoleId: row.job_role_id,
    createdAt: row.created_at,
  };
}

export function createPrincipalJobRoleRepository(db: QueryExecutor): PrincipalJobRoleRepository {
  return {
    async listForPrincipal(principalId) {
      const rows = await db
        .selectFrom('principal_job_roles')
        .selectAll()
        .where('principal_id', '=', principalId)
        .execute();
      return rows.map(toDomain);
    },

    async listForPrincipals(principalIds) {
      if (principalIds.length === 0) return [];
      const rows = await db
        .selectFrom('principal_job_roles')
        .selectAll()
        .where('principal_id', 'in', principalIds)
        .execute();
      return rows.map(toDomain);
    },

    async create(row) {
      await db
        .insertInto('principal_job_roles')
        .values({
          principal_id: row.principalId,
          job_role_id: row.jobRoleId,
          created_at: row.createdAt,
        })
        .onConflict((oc) => oc.columns(['principal_id', 'job_role_id']).doNothing())
        .execute();
    },

    async remove(principalId, jobRoleId) {
      await db
        .deleteFrom('principal_job_roles')
        .where('principal_id', '=', principalId)
        .where('job_role_id', '=', jobRoleId)
        .execute();
    },
  };
}
