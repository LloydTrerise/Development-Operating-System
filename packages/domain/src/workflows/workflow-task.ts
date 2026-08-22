import type { WorkflowRunId, WorkflowTaskId, WorkflowTaskStatus } from '@devos/contracts';

export interface WorkflowTask {
  id: WorkflowTaskId;
  workflowRunId: WorkflowRunId;
  taskKey: string;
  taskType: string;
  status: WorkflowTaskStatus;
  attempt: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTaskRepository {
  getById: (id: WorkflowTaskId) => Promise<WorkflowTask | null>;
  listForRun: (workflowRunId: WorkflowRunId) => Promise<WorkflowTask[]>;
  create: (task: WorkflowTask) => Promise<void>;
}
