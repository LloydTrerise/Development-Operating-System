import type { ArtifactId, ArtifactVersionId } from '@devos/contracts';

export interface ArtifactVersion {
  id: ArtifactVersionId;
  artifactId: ArtifactId;
  version: number;
  contentType: string;
  contentUri: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface ArtifactVersionRepository {
  getById: (id: ArtifactVersionId) => Promise<ArtifactVersion | null>;
  listForArtifact: (artifactId: ArtifactId) => Promise<ArtifactVersion[]>;
  create: (version: ArtifactVersion) => Promise<void>;
}
