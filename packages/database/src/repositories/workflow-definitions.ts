import type { ProjectId, WorkflowId } from '@devos/contracts';
import type { WorkflowDefinition, WorkflowDefinitionRepository } from '@devos/domain';
import type { WorkflowDefinitionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkflowDefinitionsTable): WorkflowDefinition {
  return {
    id: row.id as WorkflowId,
    projectId: row.project_id as ProjectId,
    key: row.key,
    name: row.name,
    ...(row.description !== null ? { description: row.description } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowDefinitionRepository(
  db: QueryExecutor,
): WorkflowDefinitionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectAndKey(projectId, key) {
      const row = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('workflow_definitions')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(definition) {
      await db
        .insertInto('workflow_definitions')
        .values({
          id: definition.id,
          project_id: definition.projectId,
          key: definition.key,
          name: definition.name,
          description: definition.description ?? null,
          created_at: definition.createdAt,
          updated_at: definition.updatedAt,
        })
        .execute();
    },
  };
}
