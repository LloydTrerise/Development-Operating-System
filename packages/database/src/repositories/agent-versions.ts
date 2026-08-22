import type {
  AgentConfiguration,
  AgentId,
  AgentVersionId,
  AgentVersionStatus,
} from '@devos/contracts';
import type { AgentVersion, AgentVersionRepository } from '@devos/domain';
import type { AgentVersionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: AgentVersionsTable): AgentVersion {
  return {
    id: row.id as AgentVersionId,
    agentId: row.agent_id as AgentId,
    version: row.version,
    status: row.status as AgentVersionStatus,
    configuration: row.configuration as AgentConfiguration,
    ...(row.prompt_reference !== null ? { promptReference: row.prompt_reference } : {}),
    createdBy: row.created_by,
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    createdAt: row.created_at,
  };
}

export function createAgentVersionRepository(db: QueryExecutor): AgentVersionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByAgentAndVersion(agentId, version) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .where('version', '=', version)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getLatestForAgent(agentId) {
      const row = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .orderBy('version', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForAgent(agentId) {
      const rows = await db
        .selectFrom('agent_versions')
        .selectAll()
        .where('agent_id', '=', agentId)
        .orderBy('version', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(version) {
      await db
        .insertInto('agent_versions')
        .values({
          id: version.id,
          agent_id: version.agentId,
          version: version.version,
          status: version.status,
          configuration: JSON.stringify(version.configuration),
          prompt_reference: version.promptReference ?? null,
          created_by: version.createdBy,
          published_at: version.publishedAt ?? null,
          created_at: version.createdAt,
        })
        .execute();
    },

    async publish(id, publishedAt) {
      await db
        .updateTable('agent_versions')
        .set({ status: 'PUBLISHED', published_at: publishedAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
