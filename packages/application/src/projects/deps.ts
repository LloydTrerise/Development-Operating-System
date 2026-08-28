import type {
  Agent,
  AgentVersion,
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Project,
  ProjectRepository,
  ProjectTypeAgentRepository,
  ProjectTypeRepository,
  ProjectTypeWorkflowRepository,
  WorkflowDefinition,
  WorkflowVersion,
} from '@devos/domain';

export type CreateProjectWithClones = (
  project: Project,
  membership: Membership,
  workflows: { definition: WorkflowDefinition; version: WorkflowVersion }[],
  agents: { agent: Agent; version: AgentVersion }[],
) => Promise<void>;

export interface ProjectUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  /** DEVOS-086: membership add/remove/role-change are audited. */
  auditRecords: AuditRecordRepository;
  /**
   * specs/architecture/organisations-and-project-types.md §8: createProject
   * validates the target ProjectType is ACTIVE and clones its workflow/agent
   * templates into the new project.
   */
  projectTypes: ProjectTypeRepository;
  projectTypeWorkflows: ProjectTypeWorkflowRepository;
  projectTypeAgents: ProjectTypeAgentRepository;
  createProjectWithClones: CreateProjectWithClones;
}
