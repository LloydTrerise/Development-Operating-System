import type { ArtifactId, ArtifactVersionId } from '@devos/contracts';
import type { ArtifactVersion, ArtifactVersionRepository } from '@devos/domain';
import type { ArtifactVersionsTable } from '../database.js';
import type { QueryExecutor } from './base.js';

function toDomain(row: ArtifactVersionsTable): ArtifactVersion {
  return {
    id: row.id as ArtifactVersionId,
    artifactId: row.artifact_id as ArtifactId,
    version: row.version,
    contentType: row.content_type,
    contentUri: row.content_uri,
    contentHash: row.content_hash,
    ...(row.metadata !== null ? { metadata: row.metadata as Record<string, unknown> } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createArtifactVersionRepository(db: QueryExecutor): ArtifactVersionRepository {
  return {
    async getById(id) {
      const row = await db
        .selectFrom('artifact_versions')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listForArtifact(artifactId) {
      const rows = await db
        .selectFrom('artifact_versions')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .execute();
      return rows.map(toDomain);
    },

    async create(version) {
      await db
        .insertInto('artifact_versions')
        .values({
          id: version.id,
          artifact_id: version.artifactId,
          version: version.version,
          content_type: version.contentType,
          content_uri: version.contentUri,
          content_hash: version.contentHash,
          metadata: version.metadata !== undefined ? JSON.stringify(version.metadata) : null,
          created_by: version.createdBy,
          created_at: version.createdAt,
        })
        .execute();
    },
  };
}
