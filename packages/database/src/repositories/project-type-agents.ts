import type { AgentConfiguration, ProjectTypeAgentId, ProjectTypeId } from '@devos/contracts';
import type { ProjectTypeAgent, ProjectTypeAgentRepository } from '@devos/domain';
import type { ProjectTypeAgentsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ProjectTypeAgentsTable): ProjectTypeAgent {
  return {
    id: row.id as ProjectTypeAgentId,
    projectTypeId: row.project_type_id as ProjectTypeId,
    key: row.key,
    name: row.name,
    configuration: row.configuration as AgentConfiguration,
    ...(row.prompt_reference !== null ? { promptReference: row.prompt_reference } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectTypeAgentRepository(db: QueryExecutor): ProjectTypeAgentRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('project_type_agents')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectTypeAndKey(projectTypeId, key) {
      const row = await db
        .selectFrom('project_type_agents')
        .selectAll()
        .where('project_type_id', '=', projectTypeId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProjectType(projectTypeId) {
      const rows = await db
        .selectFrom('project_type_agents')
        .selectAll()
        .where('project_type_id', '=', projectTypeId)
        .execute();
      return rows.map(toDomain);
    },

    async create(agent) {
      await db
        .insertInto('project_type_agents')
        .values({
          id: agent.id,
          project_type_id: agent.projectTypeId,
          key: agent.key,
          name: agent.name,
          configuration: JSON.stringify(agent.configuration),
          prompt_reference: agent.promptReference ?? null,
          created_at: agent.createdAt,
          updated_at: agent.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('project_type_agents')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.configuration !== undefined
            ? { configuration: JSON.stringify(changes.configuration) }
            : {}),
          ...(changes.promptReference !== undefined
            ? { prompt_reference: changes.promptReference }
            : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
