import type { WorkItemCommentId, WorkItemId } from '@devos/contracts';
import type { WorkItemComment, WorkItemCommentRepository } from '@devos/domain';
import type { WorkItemCommentsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkItemCommentsTable): WorkItemComment {
  return {
    id: row.id as WorkItemCommentId,
    workItemId: row.work_item_id as WorkItemId,
    principalId: row.principal_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function createWorkItemCommentRepository(db: QueryExecutor): WorkItemCommentRepository {
  return {
    async listForWorkItem(workItemId) {
      const rows = await db
        .selectFrom('work_item_comments')
        .selectAll()
        .where('work_item_id', '=', workItemId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(comment) {
      await db
        .insertInto('work_item_comments')
        .values({
          id: comment.id,
          work_item_id: comment.workItemId,
          principal_id: comment.principalId,
          body: comment.body,
          created_at: comment.createdAt,
        })
        .execute();
    },
  };
}
