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
  /** DEVOS-080: the read-side lookup DEVOS-071 flagged as missing — "no
   * API exposes a work item's runs." Needed once one work item's change
   * genuinely spans multiple runs (planning, development, release), so a
   * single run's own timeline is no longer the complete picture. */
  listForWorkItem: (workItemId: WorkItemId) => Promise<WorkflowRun[]>;
  create: (run: WorkflowRun) => Promise<void>;
}
