import type {
  AgentExecutionRepository,
  AgentVersionRepository,
  ContextManifestRepository,
  MembershipRepository,
  ProjectRepository,
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
