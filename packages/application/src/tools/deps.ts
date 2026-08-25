import type {
  MembershipRepository,
  ProjectRepository,
  ToolCapabilityRepository,
} from '@devos/domain';

export interface ToolUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  toolCapabilities: ToolCapabilityRepository;
}
