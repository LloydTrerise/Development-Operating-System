import type {
  ProjectId,
  WorkflowRunId,
  WorkflowRunStatus,
  WorkflowVersionId,
  WorkItemId,
} from '@devos/contracts';

export interface WorkflowRun {
  id: WorkflowRunId;
  projectId: ProjectId;
  workflowVersionId: WorkflowVersionId;
  workItemId: WorkItemId;
  status: WorkflowRunStatus;
  input: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRunRepository {
  getById: (id: WorkflowRunId) => Promise<WorkflowRun | null>;
  getByVersionAndIdempotencyKey: (
    workflowVersionId: WorkflowVersionId,
    idempotencyKey: string,
  ) => Promise<WorkflowRun | null>;
  create: (run: WorkflowRun) => Promise<void>;
}
