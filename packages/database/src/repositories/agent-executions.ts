import type {
  AgentExecutionId,
  AgentExecutionStatus,
  AgentUncertainty,
  AgentVersionId,
  WorkflowTaskId,
} from '@devos/contracts';
import type { AgentExecution, AgentExecutionRepository } from '@devos/domain';
import type { AgentExecutionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: AgentExecutionsTable): AgentExecution {
  return {
    id: row.id as AgentExecutionId,
    workflowTaskId: row.workflow_task_id as WorkflowTaskId,
    agentVersionId: row.agent_version_id as AgentVersionId,
    status: row.status as AgentExecutionStatus,
    input: row.input as Record<string, unknown>,
    ...(row.output !== null ? { output: row.output as Record<string, unknown> } : {}),
    ...(row.uncertainty !== null ? { uncertainty: row.uncertainty as AgentUncertainty[] } : {}),
    ...(row.model_reference !== null ? { modelReference: row.model_reference } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.error_code !== null ? { errorCode: row.error_code } : {}),
    ...(row.error_message !== null ? { errorMessage: row.error_message } : {}),
    createdAt: row.created_at,
  };
}

export function createAgentExecutionRepository(db: QueryExecutor): AgentExecutionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('agent_executions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForTask(workflowTaskId) {
      const rows = await db
        .selectFrom('agent_executions')
        .selectAll()
        .where('workflow_task_id', '=', workflowTaskId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(execution) {
      await db
        .insertInto('agent_executions')
        .values({
          id: execution.id,
          workflow_task_id: execution.workflowTaskId,
          agent_version_id: execution.agentVersionId,
          status: execution.status,
          input: JSON.stringify(execution.input),
          output: execution.output !== undefined ? JSON.stringify(execution.output) : null,
          uncertainty:
            execution.uncertainty !== undefined ? JSON.stringify(execution.uncertainty) : null,
          model_reference: execution.modelReference ?? null,
          started_at: execution.startedAt ?? null,
          completed_at: execution.completedAt ?? null,
          error_code: execution.errorCode ?? null,
          error_message: execution.errorMessage ?? null,
          created_at: execution.createdAt,
        })
        .execute();
    },

    async complete(id, output, uncertainty, completedAt) {
      await db
        .updateTable('agent_executions')
        .set({
          status: 'SUCCEEDED',
          output: JSON.stringify(output),
          uncertainty: uncertainty !== undefined ? JSON.stringify(uncertainty) : null,
          completed_at: completedAt,
        })
        .where('id', '=', id)
        .execute();
    },

    async fail(id, errorCode, errorMessage, completedAt) {
      await db
        .updateTable('agent_executions')
        .set({
          status: 'FAILED',
          error_code: errorCode ?? null,
          error_message: errorMessage,
          completed_at: completedAt,
        })
        .where('id', '=', id)
        .execute();
    },
  };
}
