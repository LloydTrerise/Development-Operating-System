import type {
  KnowledgeSourceRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';

export interface KnowledgeUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  knowledgeSources: KnowledgeSourceRepository;
}
