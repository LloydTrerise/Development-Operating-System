import type { AuditRecordRepository, MembershipRepository, ProjectRepository } from '@devos/domain';

export interface ProjectUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  /** DEVOS-086: membership add/remove/role-change are audited. */
  auditRecords: AuditRecordRepository;
}
