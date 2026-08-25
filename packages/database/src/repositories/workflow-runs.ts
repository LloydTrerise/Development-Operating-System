import type {
  ProjectId,
  WorkflowRunId,
  WorkflowRunStatus,
  WorkflowVersionId,
  WorkItemId,
} from '@devos/contracts';
import type { WorkflowRun, WorkflowRunRepository } from '@devos/domain';
import type { WorkflowRunsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: WorkflowRunsTable): WorkflowRun {
  return {
    id: row.id as WorkflowRunId,
    projectId: row.project_id as ProjectId,
    workflowVersionId: row.workflow_version_id as WorkflowVersionId,
    workItemId: row.work_item_id as WorkItemId,
    status: row.status as WorkflowRunStatus,
    input: (row.input as Record<string, unknown> | null) ?? {},
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.error_code !== null ? { errorCode: row.error_code } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    ...(row.idempotency_key !== null ? { idempotencyKey: row.idempotency_key } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowRunRepository(db: QueryExecutor): WorkflowRunRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByVersionAndIdempotencyKey(workflowVersionId, idempotencyKey) {
      const row = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('workflow_version_id', '=', workflowVersionId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForWorkItem(workItemId) {
      const rows = await db
        .selectFrom('workflow_runs')
        .selectAll()
        .where('work_item_id', '=', workItemId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(run) {
      await db
        .insertInto('workflow_runs')
        .values({
          id: run.id,
          project_id: run.projectId,
          workflow_version_id: run.workflowVersionId,
          work_item_id: run.workItemId,
          status: run.status,
          input: JSON.stringify(run.input),
          started_at: run.startedAt ?? null,
          completed_at: run.completedAt ?? null,
          error_code: run.errorCode ?? null,
          error_message: run.errorMessage ?? null,
          idempotency_key: run.idempotencyKey ?? null,
          created_at: run.createdAt,
          updated_at: run.updatedAt,
        })
        .execute();
    },
  };
}
