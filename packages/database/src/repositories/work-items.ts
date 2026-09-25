import type { ProjectId, WorkItemId } from '@devos/contracts';
import type { WorkItem, WorkItemRepository } from '@devos/domain';
import { sql } from 'kysely';
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
    ...(row.parent_id !== null ? { parentId: row.parent_id as WorkItemId } : {}),
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
          parent_id: workItem.parentId ?? null,
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
          ...(changes.parentId !== undefined ? { parent_id: changes.parentId } : {}),
          updated_at: updatedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    // DEVOS-163: `metadata->>'reworkCount'` mirrors
    // `costBreakdownByRoleForOrganisation`'s own `agent_versions.configuration->>'role'`
    // jsonb-text-extraction pattern. Cast to numeric for the `> 0` filter
    // and for a correct (not lexicographic-string) ordering.
    // DEVOS-261: real Postgres full-text search, mirroring
    // `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187) exact
    // pattern. `description` is `NOT NULL` (migrations/0004_work_items.ts),
    // so no `coalesce()` is needed.
    async searchForProject(projectId, query) {
      const rows = await db
        .selectFrom('work_items')
        .selectAll()
        .where('project_id', '=', projectId)
        .where(
          sql<boolean>`to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', ${query})`,
        )
        .orderBy(
          sql`ts_rank(to_tsvector('english', title || ' ' || description), plainto_tsquery('english', ${query}))`,
          'desc',
        )
        .limit(50)
        .execute();
      return rows.map(toDomain);
    },

    async countReworkCyclesForProject(projectId) {
      const rows = await db
        .selectFrom('work_items')
        .where('project_id', '=', projectId)
        .where(sql<boolean>`coalesce((metadata->>'reworkCount')::numeric, 0) > 0`)
        .select((eb) => [
          eb.ref('id').as('work_item_id'),
          sql<string>`(metadata->>'reworkCount')::numeric`.as('rework_count'),
        ])
        .execute();
      return rows.map((row) => ({
        workItemId: row.work_item_id as WorkItemId,
        reworkCount: Number(row.rework_count),
      }));
    },
  };
}
