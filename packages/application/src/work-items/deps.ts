import type {
  AuditRecordRepository,
  MembershipRepository,
  ProjectRepository,
  WorkItemRepository,
} from '@devos/domain';

export interface WorkItemUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  workItems: WorkItemRepository;
  /** DEVOS-115: work-item creation/update are audited, extending DEVOS-086's
   * coverage. */
  auditRecords: AuditRecordRepository;
}
