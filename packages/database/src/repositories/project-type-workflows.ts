import type { ProjectTypeId, ProjectTypeWorkflowId } from '@devos/contracts';
import type { ProjectTypeWorkflow, ProjectTypeWorkflowRepository } from '@devos/domain';
import type { ProjectTypeWorkflowsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ProjectTypeWorkflowsTable): ProjectTypeWorkflow {
  return {
    id: row.id as ProjectTypeWorkflowId,
    projectTypeId: row.project_type_id as ProjectTypeId,
    key: row.key,
    name: row.name,
    definition: row.definition as ProjectTypeWorkflow['definition'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProjectTypeWorkflowRepository(
  db: QueryExecutor,
): ProjectTypeWorkflowRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('project_type_workflows')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByProjectTypeAndKey(projectTypeId, key) {
      const row = await db
        .selectFrom('project_type_workflows')
        .selectAll()
        .where('project_type_id', '=', projectTypeId)
        .where('key', '=', key)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProjectType(projectTypeId) {
      const rows = await db
        .selectFrom('project_type_workflows')
        .selectAll()
        .where('project_type_id', '=', projectTypeId)
        .execute();
      return rows.map(toDomain);
    },

    async create(workflow) {
      await db
        .insertInto('project_type_workflows')
        .values({
          id: workflow.id,
          project_type_id: workflow.projectTypeId,
          key: workflow.key,
          name: workflow.name,
          definition: JSON.stringify(workflow.definition),
          created_at: workflow.createdAt,
          updated_at: workflow.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('project_type_workflows')
        .set({
          ...(changes.name !== undefined ? { name: changes.name } : {}),
          ...(changes.definition !== undefined
            ? { definition: JSON.stringify(changes.definition) }
            : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
