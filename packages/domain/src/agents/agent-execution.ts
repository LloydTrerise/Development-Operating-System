import type {
  AgentExecutionId,
  AgentExecutionStatus,
  AgentUncertainty,
  AgentVersionId,
  WorkflowTaskId,
} from '@devos/contracts';

export interface AgentExecution {
  id: AgentExecutionId;
  workflowTaskId: WorkflowTaskId;
  agentVersionId: AgentVersionId;
  status: AgentExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  uncertainty?: AgentUncertainty[];
  modelReference?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface AgentExecutionRepository {
  getById: (id: AgentExecutionId) => Promise<AgentExecution | null>;
  listForTask: (workflowTaskId: WorkflowTaskId) => Promise<AgentExecution[]>;
  create: (execution: AgentExecution) => Promise<void>;
  complete: (
    id: AgentExecutionId,
    output: Record<string, unknown>,
    uncertainty: AgentUncertainty[] | undefined,
    completedAt: string,
  ) => Promise<void>;
  fail: (
    id: AgentExecutionId,
    errorCode: string | undefined,
    errorMessage: string,
    completedAt: string,
  ) => Promise<void>;
}
