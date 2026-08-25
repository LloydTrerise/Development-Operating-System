import type { ProjectId, WorkItemId } from '@devos/contracts';
import type {
  AgentExecutionRepository,
  AgentVersionRepository,
  ApprovalRepository,
  ArtifactRepository,
  ArtifactVersionRepository,
  ContextManifestRepository,
  MembershipRepository,
  ProjectRepository,
  ToolCapabilityRepository,
  ToolInvocationRepository,
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
  WorkflowTask,
  WorkflowTaskRepository,
  WorkflowVersion,
  WorkflowVersionRepository,
  WorkItemRepository,
} from '@devos/domain';

export type CreateWorkflowDraft = (
  definition: WorkflowDefinition,
  version: WorkflowVersion,
) => Promise<void>;

export type StartWorkflowRun = (
  run: WorkflowRun,
  tasks: WorkflowTask[],
  actorId: string,
) => Promise<void>;

export interface WorkflowUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
  workflowDefinitions: WorkflowDefinitionRepository;
  workflowVersions: WorkflowVersionRepository;
  workflowRuns: WorkflowRunRepository;
  workflowTasks: WorkflowTaskRepository;
  createDraft: CreateWorkflowDraft;
  startRun: StartWorkflowRun;
}

/**
 * DEVOS-036: a separate flat interface (mirroring ArtifactUseCaseDeps'/
 * AuditUseCaseDeps'/AgentUseCaseDeps' precedent of not extending
 * WorkflowUseCaseDeps despite overlapping fields) rather than growing
 * WorkflowUseCaseDeps itself — keeps every existing workflow use case's
 * dependency list unchanged.
 */
export interface AgentExecutionSummaryUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workflowRuns: WorkflowRunRepository;
  workflowTasks: WorkflowTaskRepository;
  agentExecutions: AgentExecutionRepository;
  agentVersions: AgentVersionRepository;
  contextManifests: ContextManifestRepository;
}

/**
 * DEVOS-060: the Development UI's read side — mirrors
 * `AgentExecutionSummaryUseCaseDeps`'s own precedent of a separate flat
 * interface rather than growing an existing one.
 */
export interface ToolInvocationSummaryUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workflowRuns: WorkflowRunRepository;
  workflowTasks: WorkflowTaskRepository;
  toolInvocations: ToolInvocationRepository;
  toolCapabilities: ToolCapabilityRepository;
}

/**
 * DEVOS-069: the release-readiness evaluator's read side — same separate
 * flat interface precedent as `AgentExecutionSummaryUseCaseDeps`/
 * `ToolInvocationSummaryUseCaseDeps`.
 */
export interface ReleaseReadinessUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
}

/**
 * DEVOS-078: writes the work item's closed status and its own linked audit
 * record in one transaction — implemented in `packages/database`
 * (`createWorkItemCloser`), matching the shape here structurally rather
 * than importing it, mirroring `RecordContextManifest`'s established
 * pattern (`tasks/deps.ts`).
 */
export type CloseWorkItem = (
  workItemId: WorkItemId,
  projectId: ProjectId,
  metadata: Record<string, unknown>,
  closedAt: string,
) => Promise<void>;

/**
 * DEVOS-078: the closure use case's own dependencies — same separate flat
 * interface precedent as `ReleaseReadinessUseCaseDeps`. `approvals` is new
 * here (closure is the first use case in `packages/application/src/workflows/`
 * to need it directly rather than through `packages/application/src/approval/`).
 */
export interface ClosureUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
  artifacts: ArtifactRepository;
  artifactVersions: ArtifactVersionRepository;
  approvals: ApprovalRepository;
  closeWorkItem: CloseWorkItem;
  /** DEVOS-079: `runClosureTask` needs this to resolve `task.workflowRunId`
   * -> `workItemId`, the same lookup every other task handler already
   * performs first. */
  workflowRuns: WorkflowRunRepository;
}
