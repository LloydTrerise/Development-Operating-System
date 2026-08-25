import type {
  AuditRecordRepository,
  IntegrationRepository,
  MembershipRepository,
  ProjectRepository,
} from '@devos/domain';

export interface IntegrationUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  integrations: IntegrationRepository;
  /** DEVOS-086: integration creation (credential registration) is audited. */
  auditRecords: AuditRecordRepository;
}
