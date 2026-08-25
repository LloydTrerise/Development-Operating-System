import type {
  AgentExecutionId,
  AgentExecutionStatus,
  AgentUncertainty,
  AgentVersionId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';
import type { AgentExecution, AgentExecutionRepository, AgentExecutionUsage } from '@devos/domain';
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
    ...(row.usage_metadata !== null ? { usage: row.usage_metadata as AgentExecutionUsage } : {}),
    ...(row.estimated_cost_usd !== null
      ? { estimatedCostUsd: Number(row.estimated_cost_usd) }
      : {}),
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
          usage_metadata: execution.usage !== undefined ? JSON.stringify(execution.usage) : null,
          estimated_cost_usd: execution.estimatedCostUsd?.toString() ?? null,
          started_at: execution.startedAt ?? null,
          completed_at: execution.completedAt ?? null,
          error_code: execution.errorCode ?? null,
          error_message: execution.errorMessage ?? null,
          created_at: execution.createdAt,
        })
        .execute();
    },

    async complete(id, output, uncertainty, completedAt, usage, estimatedCostUsd) {
      await db
        .updateTable('agent_executions')
        .set({
          status: 'SUCCEEDED',
          output: JSON.stringify(output),
          uncertainty: uncertainty !== undefined ? JSON.stringify(uncertainty) : null,
          usage_metadata: usage !== undefined ? JSON.stringify(usage) : null,
          estimated_cost_usd: estimatedCostUsd?.toString() ?? null,
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

    // DEVOS-098: agent_executions carries no project_id of its own — joined
    // through the same real workflow_task_id/workflow_run_id chain every
    // other project-scoped query in this codebase uses.
    async sumEstimatedCostUsdForProject(projectId: ProjectId) {
      const result = await db
        .selectFrom('agent_executions')
        .innerJoin('workflow_tasks', 'workflow_tasks.id', 'agent_executions.workflow_task_id')
        .innerJoin('workflow_runs', 'workflow_runs.id', 'workflow_tasks.workflow_run_id')
        .where('workflow_runs.project_id', '=', projectId)
        .select((eb) =>
          eb.fn.coalesce(eb.fn.sum('agent_executions.estimated_cost_usd'), eb.val(0)).as('total'),
        )
        .executeTakeFirst();
      return Number(result?.total ?? 0);
    },
  };
}
