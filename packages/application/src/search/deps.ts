import type {
  AgentRepository,
  ArtifactRepository,
  MembershipRepository,
  ProjectRepository,
  WorkItemRepository,
  WorkflowDefinitionRepository,
} from '@devos/domain';

export interface SearchUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
  artifacts: ArtifactRepository;
  workflowDefinitions: WorkflowDefinitionRepository;
  agents: AgentRepository;
}
