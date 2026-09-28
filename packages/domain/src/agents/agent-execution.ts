import type {
  AgentExecutionId,
  AgentExecutionStatus,
  AgentUncertainty,
  AgentVersionId,
  OrganisationId,
  ProjectId,
  WorkflowTaskId,
} from '@devos/contracts';

/** A single grouping row from a cost-breakdown query (DEVOS-150). */
export interface CostBreakdownRow {
  /** The group key — an agent role, a workflow definition id, or a work item id, depending on the query. */
  key: string;
  totalUsd: number;
}

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
    /**
     * DEVOS-323 (Sprint 55): the real model/provider identifier the
     * invocation actually succeeded against (`AgentInvocationResult
     * .modelReference` — already computed and used to select this
     * execution's own `estimatedCostUsd` rate, per `pricing.ts`'s own
     * per-model table, but never previously persisted anywhere). A real,
     * disclosed gap found during this epic's own closing pilot: the
     * `model_reference` column and this same domain field have existed
     * since DEVOS-089, but no caller of `complete()` ever supplied a
     * value — the fallback chain's own actual provider choice (DEVOS-319)
     * was therefore genuinely unrecorded on the one entity built to record
     * it. Optional and additive: omitting it leaves the column `null`,
     * exactly as it already was for every execution completed before this
     * fix.
     */
    modelReference?: string,
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
  /**
   * DEVOS-150: the organisation-spanning equivalent of
   * `sumEstimatedCostUsdForProject`, joined one step further to
   * `projects.organisation_id` — a real join (mirroring
   * `AuditRecordRepository.listForOrganisation`'s own established
   * precedent), not a client-side loop over every project in the
   * organisation. Optional for the same reason: only the real Postgres
   * repository implements it.
   */
  sumEstimatedCostUsdForOrganisation?: (organisationId: OrganisationId) => Promise<number>;
  /** DEVOS-150: real accumulated cost grouped by agent role, scoped to one project. */
  costBreakdownByRoleForProject?: (projectId: ProjectId) => Promise<CostBreakdownRow[]>;
  /** DEVOS-150: real accumulated cost grouped by agent role, across an organisation's projects. */
  costBreakdownByRoleForOrganisation?: (
    organisationId: OrganisationId,
  ) => Promise<CostBreakdownRow[]>;
  /** DEVOS-156: real accumulated cost grouped by workflow definition name, scoped to one project. */
  costBreakdownByWorkflowForProject?: (projectId: ProjectId) => Promise<CostBreakdownRow[]>;
  /** DEVOS-156: real accumulated cost grouped by workflow definition name, across an organisation's projects. */
  costBreakdownByWorkflowForOrganisation?: (
    organisationId: OrganisationId,
  ) => Promise<CostBreakdownRow[]>;
  /** DEVOS-156: real accumulated cost grouped by work-item title, scoped to one project. */
  costBreakdownByWorkItemForProject?: (projectId: ProjectId) => Promise<CostBreakdownRow[]>;
  /** DEVOS-156: real accumulated cost grouped by work-item title, across an organisation's projects. */
  costBreakdownByWorkItemForOrganisation?: (
    organisationId: OrganisationId,
  ) => Promise<CostBreakdownRow[]>;
}
