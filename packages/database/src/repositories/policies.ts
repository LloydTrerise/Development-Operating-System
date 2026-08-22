import type { OrganisationId, PolicyId, PolicyStatus, ProjectId } from '@devos/contracts';
import type { Policy, PolicyRepository } from '@devos/domain';
import type { PoliciesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: PoliciesTable): Policy {
  return {
    id: row.id as PolicyId,
    organisationId: row.organisation_id as OrganisationId,
    ...(row.project_id !== null ? { projectId: row.project_id as ProjectId } : {}),
    key: row.key,
    version: row.version,
    status: row.status as PolicyStatus,
    definition: row.definition as Record<string, unknown>,
    createdBy: row.created_by,
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    createdAt: row.created_at,
  };
}

export function createPolicyRepository(db: QueryExecutor): PolicyRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('policies')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKeyAndVersion(projectId, key, version) {
      const row = await db
        .selectFrom('policies')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .where('version', '=', version)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getLatestForProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('policies')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .orderBy('version', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('policies')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('key', 'asc')
        .orderBy('version', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(policy) {
      await db
        .insertInto('policies')
        .values({
          id: policy.id,
          organisation_id: policy.organisationId,
          project_id: policy.projectId ?? null,
          key: policy.key,
          version: policy.version,
          status: policy.status,
          definition: JSON.stringify(policy.definition),
          created_by: policy.createdBy,
          published_at: policy.publishedAt ?? null,
          created_at: policy.createdAt,
        })
        .execute();
    },

    async publish(id, publishedAt) {
      await db
        .updateTable('policies')
        .set({ status: 'PUBLISHED', published_at: publishedAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
