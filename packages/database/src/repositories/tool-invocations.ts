import type {
  ToolCapabilityId,
  ToolInvocationId,
  ToolInvocationStatus,
  WorkflowTaskId,
} from '@devos/contracts';
import type { ToolInvocation, ToolInvocationRepository } from '@devos/domain';
import type { ToolInvocationsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ToolInvocationsTable): ToolInvocation {
  return {
    id: row.id as ToolInvocationId,
    workflowTaskId: row.workflow_task_id as WorkflowTaskId,
    toolCapabilityId: row.tool_capability_id as ToolCapabilityId,
    status: row.status as ToolInvocationStatus,
    inputMetadata: row.input_metadata as Record<string, unknown>,
    ...(row.output_metadata !== null
      ? { outputMetadata: row.output_metadata as Record<string, unknown> }
      : {}),
    ...(row.provider_reference !== null ? { providerReference: row.provider_reference } : {}),
    ...(row.idempotency_key !== null ? { idempotencyKey: row.idempotency_key } : {}),
    ...(row.started_at !== null ? { startedAt: row.started_at } : {}),
    ...(row.completed_at !== null ? { completedAt: row.completed_at } : {}),
    ...(row.error_code !== null ? { errorCode: row.error_code } : {}),
    createdAt: row.created_at,
  };
}

export function createToolInvocationRepository(db: QueryExecutor): ToolInvocationRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('tool_invocations')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByCapabilityAndIdempotencyKey(toolCapabilityId, idempotencyKey) {
      const row = await db
        .selectFrom('tool_invocations')
        .selectAll()
        .where('tool_capability_id', '=', toolCapabilityId)
        .where('idempotency_key', '=', idempotencyKey)
        .orderBy('created_at', 'asc')
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForTask(workflowTaskId) {
      const rows = await db
        .selectFrom('tool_invocations')
        .selectAll()
        .where('workflow_task_id', '=', workflowTaskId)
        .orderBy('created_at', 'asc')
        .execute();
      return rows.map(toDomain);
    },

    async create(invocation) {
      await db
        .insertInto('tool_invocations')
        .values({
          id: invocation.id,
          workflow_task_id: invocation.workflowTaskId,
          tool_capability_id: invocation.toolCapabilityId,
          status: invocation.status,
          input_metadata: JSON.stringify(invocation.inputMetadata),
          output_metadata:
            invocation.outputMetadata !== undefined
              ? JSON.stringify(invocation.outputMetadata)
              : null,
          provider_reference: invocation.providerReference ?? null,
          idempotency_key: invocation.idempotencyKey ?? null,
          started_at: invocation.startedAt ?? null,
          completed_at: invocation.completedAt ?? null,
          error_code: invocation.errorCode ?? null,
          created_at: invocation.createdAt,
        })
        .execute();
    },
  };
}
