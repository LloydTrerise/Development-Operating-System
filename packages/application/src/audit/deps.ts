import type { AuditRecordRepository, MembershipRepository, ProjectRepository } from '@devos/domain';

export interface AuditUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  auditRecords: AuditRecordRepository;
}
