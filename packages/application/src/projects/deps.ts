import type { MembershipRepository, ProjectRepository } from '@devos/domain';

export interface ProjectUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
}
