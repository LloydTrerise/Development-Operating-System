import type {
  ArtifactId,
  ArtifactStatus,
  OrganisationId,
  ProjectId,
  WorkflowRunId,
  WorkflowTaskId,
} from '@devos/contracts';

export interface Artifact {
  id: ArtifactId;
  projectId: ProjectId;
  artifactType: string;
  name: string;
  status: ArtifactStatus;
  workflowRunId?: WorkflowRunId;
  workflowTaskId?: WorkflowTaskId;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DEVOS-163: an evidence artifact's own decision/pass-fail data
 * (`decision`/`passed`/`action`/etc.) lives in its `ArtifactVersion.metadata`,
 * not on `Artifact` itself. Every real evidence-writing call site in this
 * codebase (`run-review-agent-task.ts`/`run-validation-task.ts`/
 * `run-security-scan-task.ts`/`run-release-task.ts`) creates a fresh
 * `Artifact` with exactly one `ArtifactVersion` (`version: 1`) — confirmed
 * by direct inspection before this query was written, not assumed — so a
 * report over evidence data can read `version 1`'s metadata directly via a
 * single join, without walking a real multi-version history the way
 * `getArtifactProvenance` does for provenance chains.
 */
export interface ArtifactEvidenceRow {
  artifactId: ArtifactId;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactRepository {
  getById: (id: ArtifactId) => Promise<Artifact | null>;
  listForProject: (projectId: ProjectId) => Promise<Artifact[]>;
  create: (artifact: Artifact) => Promise<void>;
  /**
   * DEVOS-163: real evidence rows (one per matching artifact, its own
   * `version 1` metadata inlined) for one `artifactType` in one project —
   * the data source DEVOS-164's report aggregation reads directly, no
   * further per-artifact lookup needed.
   */
  listEvidenceForProject?: (
    projectId: ProjectId,
    artifactType: string,
  ) => Promise<ArtifactEvidenceRow[]>;
  /**
   * DEVOS-163: the organisation-scoped mirror, a real
   * `artifacts` ⋈ `projects` ⋈ `artifact_versions` join — mirrors
   * `sumEstimatedCostUsdForOrganisation`'s real-join, never-a-client-loop
   * precedent (DEVOS-150). Optional, matching every other
   * organisation-scoped repository extension this codebase has added since
   * DEVOS-147.
   */
  listEvidenceForOrganisation?: (
    organisationId: OrganisationId,
    artifactType: string,
  ) => Promise<ArtifactEvidenceRow[]>;
  /**
   * DEVOS-261: real Postgres full-text search over `name` (the only real
   * searchable text column on this table — per-version content lives in
   * `ArtifactVersion.metadata`, out of this method's scope), mirroring
   * `KnowledgeSourceRepository.searchForProject`'s (DEVOS-187) exact
   * pattern. Optional, matching this repository's own established
   * additive-method convention (`listEvidenceForProject`).
   */
  searchForProject?: (projectId: ProjectId, query: string) => Promise<Artifact[]>;
}
