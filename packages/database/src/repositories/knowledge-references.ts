import type {
  AgentExecutionId,
  KnowledgeReferenceId,
  KnowledgeSourceId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';
import type { KnowledgeReference, KnowledgeReferenceRepository } from '@devos/domain';
import type { KnowledgeReferencesTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: KnowledgeReferencesTable): KnowledgeReference {
  return {
    id: row.id as KnowledgeReferenceId,
    projectId: row.project_id as ProjectId,
    knowledgeSourceId: row.knowledge_source_id as KnowledgeSourceId,
    workflowTaskId: row.workflow_task_id as WorkflowTaskId,
    ...(row.agent_execution_id !== null
      ? { agentExecutionId: row.agent_execution_id as AgentExecutionId }
      : {}),
    createdAt: row.created_at,
  };
}

export function createKnowledgeReferenceRepository(
  db: QueryExecutor,
): KnowledgeReferenceRepository {
  return {
    async listForTask(workflowTaskId) {
      const rows = await db
        .selectFrom('knowledge_references')
        .selectAll()
        .where('workflow_task_id', '=', workflowTaskId)
        .execute();
      return rows.map(toDomain);
    },

    async create(reference) {
      await db
        .insertInto('knowledge_references')
        .values({
          id: reference.id,
          project_id: reference.projectId,
          knowledge_source_id: reference.knowledgeSourceId,
          workflow_task_id: reference.workflowTaskId,
          agent_execution_id: reference.agentExecutionId ?? null,
          created_at: reference.createdAt,
        })
        .execute();
    },
  };
}
