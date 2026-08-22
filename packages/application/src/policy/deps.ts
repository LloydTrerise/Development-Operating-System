import type { MembershipRepository, PolicyRepository, ProjectRepository } from '@devos/domain';

export interface PolicyUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
}
