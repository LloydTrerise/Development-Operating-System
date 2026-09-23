import type {
  WorkflowDefinition as WorkflowGraph,
  WorkflowId,
  WorkflowVersionId,
  WorkflowVersionStatus,
} from '@devos/contracts';

export interface WorkflowVersion {
  id: WorkflowVersionId;
  workflowDefinitionId: WorkflowId;
  version: number;
  status: WorkflowVersionStatus;
  definition: WorkflowGraph;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface WorkflowVersionRepository {
  getById: (id: WorkflowVersionId) => Promise<WorkflowVersion | null>;
  getByDefinitionAndVersion: (
    workflowDefinitionId: WorkflowId,
    version: number,
  ) => Promise<WorkflowVersion | null>;
  getLatestForDefinition: (workflowDefinitionId: WorkflowId) => Promise<WorkflowVersion | null>;
  listForDefinition: (workflowDefinitionId: WorkflowId) => Promise<WorkflowVersion[]>;
  create: (version: WorkflowVersion) => Promise<void>;
  updateDefinition: (id: WorkflowVersionId, definition: WorkflowGraph) => Promise<void>;
  publish: (id: WorkflowVersionId, publishedAt: string) => Promise<void>;
}

/**
 * Sprint 41 gap closure: `WorkflowDefinitionSummary`'s `latestVersionStatus`/
 * `versionCount` (DEVOS-135), computed for many definitions in one real
 * aggregate query (a Postgres `DISTINCT ON` + window `COUNT(...) OVER
 * (PARTITION BY ...)`) instead of one `getLatestForDefinition` +
 * `listForDefinition` round-trip per definition. Deliberately a standalone
 * function type, not a new `WorkflowVersionRepository` method — mirrors
 * `ListWorkflowRunsForDefinition`'s own established precedent (a separate
 * flat port for a narrowly-scoped, cross-definition read) so every existing
 * `WorkflowVersionRepository` fake stays valid unchanged.
 */
export interface WorkflowVersionSummary {
  workflowDefinitionId: WorkflowId;
  latestStatus: WorkflowVersionStatus;
  versionCount: number;
}

export type SummarizeWorkflowVersionsForDefinitions = (
  workflowDefinitionIds: WorkflowId[],
) => Promise<WorkflowVersionSummary[]>;
