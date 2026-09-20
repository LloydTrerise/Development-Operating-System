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

    // DEVOS-163: real evidence rows — a real `artifacts` ⋈
    // `artifact_versions` join (on `version = 1`, true for every real
    // evidence-writing call site today) inlining each artifact's own real
    // metadata, so no further per-artifact lookup is needed by a caller.
    async listEvidenceForProject(projectId, artifactType) {
      const rows = await db
        .selectFrom('artifacts')
        .innerJoin('artifact_versions', (join) =>
          join
            .onRef('artifact_versions.artifact_id', '=', 'artifacts.id')
            .on('artifact_versions.version', '=', 1),
        )
        .where('artifacts.project_id', '=', projectId)
        .where('artifacts.artifact_type', '=', artifactType)
        .select([
          'artifacts.id as artifact_id',
          'artifacts.created_at as created_at',
          'artifact_versions.metadata as metadata',
        ])
        .execute();
      return rows.map((row) => ({
        artifactId: row.artifact_id as ArtifactId,
        createdAt: row.created_at,
        metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      }));
    },

    // DEVOS-163: the organisation-scoped mirror, a real `artifacts` ⋈
    // `projects` ⋈ `artifact_versions` join — mirrors
    // `sumEstimatedCostUsdForOrganisation`'s real-join, never-a-client-loop
    // precedent (DEVOS-150).
    async listEvidenceForOrganisation(organisationId, artifactType) {
      const rows = await db
        .selectFrom('artifacts')
        .innerJoin('projects', 'projects.id', 'artifacts.project_id')
        .innerJoin('artifact_versions', (join) =>
          join
            .onRef('artifact_versions.artifact_id', '=', 'artifacts.id')
            .on('artifact_versions.version', '=', 1),
        )
        .where('projects.organisation_id', '=', organisationId)
        .where('artifacts.artifact_type', '=', artifactType)
        .select([
          'artifacts.id as artifact_id',
          'artifacts.created_at as created_at',
          'artifact_versions.metadata as metadata',
        ])
        .execute();
      return rows.map((row) => ({
        artifactId: row.artifact_id as ArtifactId,
        createdAt: row.created_at,
        metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      }));
    },
  };
}
