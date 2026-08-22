import type { KnowledgeSourceId, ProjectId } from '@devos/contracts';
import type { KnowledgeSource, KnowledgeSourceRepository } from '@devos/domain';
import type { KnowledgeSourcesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: KnowledgeSourcesTable): KnowledgeSource {
  return {
    id: row.id as KnowledgeSourceId,
    projectId: row.project_id as ProjectId,
    key: row.key,
    name: row.name,
    sourceType: row.source_type,
    content: row.content,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createKnowledgeSourceRepository(db: QueryExecutor): KnowledgeSourceRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('knowledge_sources')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('knowledge_sources')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('knowledge_sources')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(source) {
      await db
        .insertInto('knowledge_sources')
        .values({
          id: source.id,
          project_id: source.projectId,
          key: source.key,
          name: source.name,
          source_type: source.sourceType,
          content: source.content,
          status: source.status,
          created_by: source.createdBy,
          created_at: source.createdAt,
          updated_at: source.updatedAt,
        })
        .execute();
    },
  };
}
