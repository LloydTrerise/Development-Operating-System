import type {
  AgentExecutionId,
  ContextManifestId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';
import type { ContextManifest, ContextManifestRepository } from '@devos/domain';
import type { ContextManifestsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ContextManifestsTable): ContextManifest {
  return {
    id: row.id as ContextManifestId,
    projectId: row.project_id as ProjectId,
    workflowTaskId: row.workflow_task_id as WorkflowTaskId,
    agentExecutionId: row.agent_execution_id as AgentExecutionId,
    version: row.version,
    sources: (row.manifest as { sources: ContextManifest['sources'] }).sources,
    policySnapshot: (row.manifest as { policySnapshot: ContextManifest['policySnapshot'] })
      .policySnapshot,
    createdAt: row.created_at,
  };
}

export function createContextManifestRepository(db: QueryExecutor): ContextManifestRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('context_manifests')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getForExecution(agentExecutionId) {
      const row = await db
        .selectFrom('context_manifests')
        .selectAll()
        .where('agent_execution_id', '=', agentExecutionId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async create(manifest) {
      await db
        .insertInto('context_manifests')
        .values({
          id: manifest.id,
          project_id: manifest.projectId,
          workflow_task_id: manifest.workflowTaskId,
          agent_execution_id: manifest.agentExecutionId,
          version: manifest.version,
          manifest: JSON.stringify({
            sources: manifest.sources,
            policySnapshot: manifest.policySnapshot,
          }),
          created_at: manifest.createdAt,
        })
        .execute();
    },
  };
}
