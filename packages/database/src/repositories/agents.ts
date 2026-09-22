import type { AgentId, ProjectId } from '@devos/contracts';
import type { Agent, AgentRepository } from '@devos/domain';
import { sql } from 'kysely';
import type { AgentsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: AgentsTable): Agent {
  return {
    id: row.id as AgentId,
    projectId: row.project_id as ProjectId,
    key: row.key,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAgentRepository(db: QueryExecutor): AgentRepository {
  return {
    async getById(id) {
      const row = await db.selectFrom('agents').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('agents')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('agents')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(agent) {
      await db
        .insertInto('agents')
        .values({
          id: agent.id,
          project_id: agent.projectId,
          key: agent.key,
          name: agent.name,
          description: agent.description ?? null,
          status: agent.status,
          created_at: agent.createdAt,
          updated_at: agent.updatedAt,
        })
        .execute();
    },

    // DEVOS-261: real Postgres full-text search over `name`/`description`,
    // mirroring `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187)
    // exact pattern. `description` is nullable, so `coalesce()` is needed.
    async searchForProject(projectId, query) {
      const rows = await db
        .selectFrom('agents')
        .selectAll()
        .where('project_id', '=', projectId)
        .where(
          sql<boolean>`to_tsvector('english', name || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', ${query})`,
        )
        .orderBy(
          sql`ts_rank(to_tsvector('english', name || ' ' || coalesce(description, '')), plainto_tsquery('english', ${query}))`,
          'desc',
        )
        .limit(50)
        .execute();
      return rows.map(toDomain);
    },
  };
}
