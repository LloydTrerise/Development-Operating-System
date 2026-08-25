import type {
  AgentExecutionId,
  AgentExecutionStatus,
  AgentUncertainty,
  AgentVersionId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';

/** DEVOS-089: real token counts as the provider reported them for this execution. */
export interface AgentExecutionUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AgentExecution {
  id: AgentExecutionId;
  workflowTaskId: WorkflowTaskId;
  agentVersionId: AgentVersionId;
  status: AgentExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  uncertainty?: AgentUncertainty[];
  modelReference?: string;
  usage?: AgentExecutionUsage;
  /** An approximate estimate derived from `usage`, not an authoritative billing figure. */
  estimatedCostUsd?: number;
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
    usage?: AgentExecutionUsage,
    estimatedCostUsd?: number,
  ) => Promise<void>;
  fail: (
    id: AgentExecutionId,
    errorCode: string | undefined,
    errorMessage: string,
    completedAt: string,
  ) => Promise<void>;
  /**
   * DEVOS-098: real accumulated `estimatedCostUsd` across every completed
   * execution in a project, for budget-threshold checking. Optional — only
   * the real Postgres repository implements it; every existing in-memory
   * test fake is unaffected, the same optional-and-additive pattern
   * DEVOS-087's `MetricsRegistry` already established for a cross-cutting
   * capability most callers don't need to fake.
   */
  sumEstimatedCostUsdForProject?: (projectId: ProjectId) => Promise<number>;
}
