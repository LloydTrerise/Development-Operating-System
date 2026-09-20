import { sql } from 'kysely';
import type { KnowledgeSourceId, ProjectId } from '@devos/contracts';
import type {
  KnowledgeSource,
  KnowledgeSourceRepository,
  SharedKnowledgeSource,
} from '@devos/domain';
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
    sharedAcrossOrganisation: row.shared_across_organisation,
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
          shared_across_organisation: source.sharedAcrossOrganisation ?? false,
        })
        .execute();
    },

    // DEVOS-182: mirrors `createProjectRepository`'s own `update` exactly —
    // only fields the caller actually supplies change.
    async update(id, changes, updatedAt) {
      await db
        .updateTable('knowledge_sources')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.content !== undefined ? { content: changes.content } : {}),
          ...(changes.sourceType !== undefined ? { source_type: changes.sourceType } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    // DEVOS-187: real Postgres full-text search — never embeddings/semantic
    // search (specs/DEVOS-KNOWLEDGE-PLATFORM-BACKLOG.md §10). A functional
    // expression over `name`/`content`, not a stored/indexed column — an
    // acceptable, disclosed sequential scan at this table's real POC scale.
    async searchForProject(projectId, query) {
      const rows = await db
        .selectFrom('knowledge_sources')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('status', '=', 'ACTIVE')
        .where(
          sql<boolean>`to_tsvector('english', name || ' ' || content) @@ plainto_tsquery('english', ${query})`,
        )
        .orderBy(
          sql`ts_rank(to_tsvector('english', name || ' ' || content), plainto_tsquery('english', ${query}))`,
          'desc',
        )
        .limit(50)
        .execute();
      return rows.map(toDomain);
    },

    async setSharedAcrossOrganisation(id, shared) {
      await db
        .updateTable('knowledge_sources')
        .set({ shared_across_organisation: shared })
        .where('id', '=', id)
        .execute();
    },

    // DEVOS-189: a real `knowledge_sources` ⋈ `projects` join — mirrors
    // `AgentVersionRepository.listSharedForOrganisation`'s real-join,
    // never-a-client-loop precedent (a fourth instance).
    async listSharedForOrganisation(organisationId): Promise<SharedKnowledgeSource[]> {
      const rows = await db
        .selectFrom('knowledge_sources')
        .innerJoin('projects', 'projects.id', 'knowledge_sources.project_id')
        .where('knowledge_sources.shared_across_organisation', '=', true)
        .where('projects.organisation_id', '=', organisationId)
        .select([
          'knowledge_sources.id as id',
          'knowledge_sources.project_id as project_id',
          'knowledge_sources.key as key',
          'knowledge_sources.name as name',
          'knowledge_sources.source_type as source_type',
          'knowledge_sources.content as content',
          'knowledge_sources.status as status',
          'knowledge_sources.created_by as created_by',
          'knowledge_sources.created_at as created_at',
          'knowledge_sources.updated_at as updated_at',
          'knowledge_sources.shared_across_organisation as shared_across_organisation',
          'projects.name as source_project_name',
        ])
        .execute();

      return rows.map((row) => ({
        ...toDomain(row),
        sourceProjectId: row.project_id as ProjectId,
        sourceProjectName: row.source_project_name,
      }));
    },
  };
}
