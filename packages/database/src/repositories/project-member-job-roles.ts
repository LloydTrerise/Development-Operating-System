import type { ProjectId } from '@devos/contracts';
import type { ProjectMemberJobRole, ProjectMemberJobRoleRepository } from '@devos/domain';
import type { ProjectMemberJobRolesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ProjectMemberJobRolesTable): ProjectMemberJobRole {
  return {
    projectId: row.project_id as ProjectId,
    principalId: row.principal_id,
    jobRoleId: row.job_role_id,
    createdAt: row.created_at,
  };
}

export function createProjectMemberJobRoleRepository(
  db: QueryExecutor,
): ProjectMemberJobRoleRepository {
  return {
    async listForProject(projectId) {
      const rows = await db
        .selectFrom('project_member_job_roles')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(row) {
      await db
        .insertInto('project_member_job_roles')
        .values({
          project_id: row.projectId,
          principal_id: row.principalId,
          job_role_id: row.jobRoleId,
          created_at: row.createdAt,
        })
        .onConflict((oc) => oc.columns(['project_id', 'principal_id', 'job_role_id']).doNothing())
        .execute();
    },

    async remove(projectId, principalId, jobRoleId) {
      await db
        .deleteFrom('project_member_job_roles')
        .where('project_id', '=', projectId)
        .where('principal_id', '=', principalId)
        .where('job_role_id', '=', jobRoleId)
        .execute();
    },
  };
}
