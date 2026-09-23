import type {
  OrganisationId,
  ProjectId,
  WorkflowId,
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

/**
 * DEVOS-135: a workflow definition's own real run-health summary needs
 * every run across every one of its versions — `WorkflowRun` only stores
 * `workflowVersionId`, so listing by definition is a real join against
 * `workflow_versions`, not a fabricated metric. Deliberately a standalone
 * function type, not a new `WorkflowRunRepository` method — this codebase's
 * own established precedent (`AgentExecutionSummaryUseCaseDeps`,
 * `ToolInvocationSummaryUseCaseDeps`) is a separate flat port for a
 * narrowly-scoped read side, so every one of `WorkflowRunRepository`'s many
 * existing test fakes stays valid unchanged.
 */
export type ListWorkflowRunsForDefinition = (
  workflowDefinitionId: WorkflowId,
) => Promise<WorkflowRun[]>;

/**
 * Sprint 41 gap closure: `WorkflowLibraryPage.tsx`'s own run-health summary
 * (`summarizeRunHealth`), computed for every definition across an entire
 * organisation in one real grouped-aggregate query instead of one
 * `ListWorkflowRunsForDefinition` round-trip per definition (which, like the
 * page's own project fan-out, does not scale to thousands of real
 * definitions). Deliberately a standalone function type, same precedent as
 * `ListWorkflowRunsForDefinition` itself.
 */
export interface WorkflowRunStatusCount {
  workflowDefinitionId: WorkflowId;
  status: WorkflowRunStatus;
  count: number;
}

export type SummarizeWorkflowRunStatusCountsForOrganisation = (
  organisationId: OrganisationId,
) => Promise<WorkflowRunStatusCount[]>;
