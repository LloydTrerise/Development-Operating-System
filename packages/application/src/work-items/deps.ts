import type { MembershipRepository, ProjectRepository, WorkItemRepository } from '@devos/domain';

export interface WorkItemUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
}
