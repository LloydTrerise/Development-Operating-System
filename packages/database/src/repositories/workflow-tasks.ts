import type { WorkflowRunId, WorkflowTaskId, WorkflowTaskStatus } from '@devos/contracts';
import type { WorkflowTask, WorkflowTaskRepository } from '@devos/domain';
import type { WorkflowTasksTable } from '../database.js';
import type { QueryExecutor } from './base.js';

export function toWorkflowTaskDomain(row: WorkflowTasksTable): WorkflowTask {
  return {
    id: row.id as WorkflowTaskId,
    workflowRunId: row.workflow_run_id as WorkflowRunId,
    taskKey: row.task_key,
    taskType: row.task_type,
    status: row.status as WorkflowTaskStatus,
    attempt: row.attempt,
    input: (row.input as Record<string, unknown> | null) ?? {},
    ...(row.output !== null ? { output: row.output as Record<string, unknown> } : {}),
    ...(row.error_code !== null ? { errorCode: row.error_code } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkflowTaskRepository(db: QueryExecutor): WorkflowTaskRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toWorkflowTaskDomain(row) : null;
    },

    async listForRun(workflowRunId) {
      // DEVOS-036: found via the Agent Execution UI's own browser
      // verification — with no ORDER BY, the timeline rendered tasks in an
      // arbitrary order unrelated to execution sequence. Matches the
      // DEVOS-035 per-node createdAt offset (run-creation.ts), so this now
      // reflects genuine claim/execution order, not just insertion order.
      const rows = await db
        .selectFrom('workflow_tasks')
        .selectAll()
        .where('workflow_run_id', '=', workflowRunId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toWorkflowTaskDomain);
    },

    async create(task) {
      await db
        .insertInto('workflow_tasks')
        .values({
          id: task.id,
          workflow_run_id: task.workflowRunId,
          task_key: task.taskKey,
          task_type: task.taskType,
          status: task.status,
          attempt: task.attempt,
          input: JSON.stringify(task.input),
          output: task.output !== undefined ? JSON.stringify(task.output) : null,
          error_code: task.errorCode ?? null,
          error_message: task.errorMessage ?? null,
          started_at: task.startedAt ?? null,
          completed_at: task.completedAt ?? null,
          created_at: task.createdAt,
          updated_at: task.updatedAt,
        })
        .execute();
    },
  };
}
