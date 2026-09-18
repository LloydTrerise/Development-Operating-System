import type {
  AuditRecordRepository,
  KnowledgeSourceRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';

export interface KnowledgeUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  knowledgeSources: KnowledgeSourceRepository;
  /** DEVOS-115: knowledge-source creation is audited, extending DEVOS-086's
   * coverage. */
  auditRecords: AuditRecordRepository;
}
