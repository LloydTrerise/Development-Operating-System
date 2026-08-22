import type {
  ArtifactId,
  ArtifactStatus,
  ProjectId,
  WorkflowRunId,
  WorkflowTaskId,
} from '@devos/contracts';
import type { Artifact, ArtifactRepository } from '@devos/domain';
import type { ArtifactsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ArtifactsTable): Artifact {
  return {
    id: row.id as ArtifactId,
    projectId: row.project_id as ProjectId,
    artifactType: row.artifact_type,
    name: row.name,
    status: row.status as ArtifactStatus,
    ...(row.workflow_run_id !== null
      ? { workflowRunId: row.workflow_run_id as WorkflowRunId }
      : {}),
    ...(row.workflow_task_id !== null
      ? { workflowTaskId: row.workflow_task_id as WorkflowTaskId }
      : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createArtifactRepository(db: QueryExecutor): ArtifactRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('artifacts')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForProject(projectId) {
      const rows = await db
        .selectFrom('artifacts')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();
      return rows.map(toDomain);
    },

    async create(artifact) {
      await db
        .insertInto('artifacts')
        .values({
          id: artifact.id,
          project_id: artifact.projectId,
          artifact_type: artifact.artifactType,
          name: artifact.name,
          status: artifact.status,
          workflow_run_id: artifact.workflowRunId ?? null,
          workflow_task_id: artifact.workflowTaskId ?? null,
          created_by: artifact.createdBy,
          created_at: artifact.createdAt,
          updated_at: artifact.updatedAt,
        })
        .execute();
    },
  };
}
