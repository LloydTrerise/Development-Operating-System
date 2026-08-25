import type {
  AuditRecordRepository,
  MembershipRepository,
  PolicyRepository,
  ProjectRepository,
} from '@devos/domain';

export interface PolicyUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
  /** DEVOS-086: policy publish is audited. */
  auditRecords: AuditRecordRepository;
}
