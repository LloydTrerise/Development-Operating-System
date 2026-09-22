import type {
  IntegrationRepository,
  MembershipRepository,
  ProjectRepository,
  ToolCapabilityRepository,
} from '@devos/domain';

export interface SystemHealthUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  integrations: IntegrationRepository;
  toolCapabilities: ToolCapabilityRepository;
}
