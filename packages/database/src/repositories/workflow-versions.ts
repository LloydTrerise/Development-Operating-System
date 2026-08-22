import type { WorkflowId, WorkflowVersionId, WorkflowVersionStatus } from '@devos/contracts';
import type { WorkflowVersion, WorkflowVersionRepository } from '@devos/domain';
import type { WorkflowVersionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkflowVersionsTable): WorkflowVersion {
  return {
    id: row.id as WorkflowVersionId,
    workflowDefinitionId: row.workflow_definition_id as WorkflowId,
    version: row.version,
    status: row.status as WorkflowVersionStatus,
    definition: row.definition as WorkflowVersion['definition'],
    ...(row.published_at !== null ? { publishedAt: row.published_at } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createWorkflowVersionRepository(db: QueryExecutor): WorkflowVersionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('workflow_versions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByDefinitionAndVersion(workflowDefinitionId, version) {
      const row = await db
        .selectFrom('workflow_versions')
        .selectAll()
        .where('workflow_definition_id', '=', workflowDefinitionId)
        .where('version', '=', version)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getLatestForDefinition(workflowDefinitionId) {
      const row = await db
        .selectFrom('workflow_versions')
        .selectAll()
        .where('workflow_definition_id', '=', workflowDefinitionId)
        .orderBy('version', 'desc')
        .limit(1)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForDefinition(workflowDefinitionId) {
      const rows = await db
        .selectFrom('workflow_versions')
        .selectAll()
        .where('workflow_definition_id', '=', workflowDefinitionId)
        .orderBy('version', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(version) {
      await db
        .insertInto('workflow_versions')
        .values({
          id: version.id,
          workflow_definition_id: version.workflowDefinitionId,
          version: version.version,
          status: version.status,
          definition: JSON.stringify(version.definition),
          published_at: version.publishedAt ?? null,
          created_by: version.createdBy,
          created_at: version.createdAt,
        })
        .execute();
    },

    async updateDefinition(id, definition) {
      await db
        .updateTable('workflow_versions')
        .set({ definition: JSON.stringify(definition) })
        .where('id', '=', id)
        .execute();
    },

    async publish(id, publishedAt) {
      await db
        .updateTable('workflow_versions')
        .set({ status: 'PUBLISHED', published_at: publishedAt })
        .where('id', '=', id)
        .execute();
    },
  };
}
