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
