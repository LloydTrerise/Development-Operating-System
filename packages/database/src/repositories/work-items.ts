import type { ProjectId, WorkItemId } from '@devos/contracts';
import type { WorkItem, WorkItemRepository } from '@devos/domain';
import type { WorkItemsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkItemsTable): WorkItem {
  return {
    id: row.id as WorkItemId,
    projectId: row.project_id as ProjectId,
    ...(row.external_key !== null ? { externalRef: row.external_key } : {}),
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    type: row.type,
    status: row.status,
    priority: row.priority,
    ...(row.source_system !== null ? { source: row.source_system } : {}),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkItemRepository(db: QueryExecutor): WorkItemRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('work_items')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('work_items')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(workItem) {
      await db
        .insertInto('work_items')
        .values({
          id: workItem.id,
          project_id: workItem.projectId,
          external_key: workItem.externalRef ?? null,
          title: workItem.title,
          description: workItem.description ?? '',
          type: workItem.type,
          status: workItem.status,
          priority: workItem.priority,
          source_system: workItem.source ?? null,
          source_url: null,
          metadata: JSON.stringify(workItem.metadata),
          created_by: workItem.createdBy,
          created_at: workItem.createdAt,
          updated_at: workItem.updatedAt,
        })
        .execute();
    },

    async update(id, changes, updatedAt) {
      await db
        .updateTable('work_items')
        .set({
          ...(changes.title !== undefined ? { title: changes.title } : {}),
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          ...(changes.status !== undefined ? { status: changes.status } : {}),
          ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
          ...(changes.metadata !== undefined ? { metadata: JSON.stringify(changes.metadata) } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
