import type {
  AuditRecordRepository,
  MembershipRepository,
  OrganisationRepository,
  ProjectRepository,
} from '@devos/domain';

export interface AuditUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  auditRecords: AuditRecordRepository;
  /**
   * DEVOS-147: needed to resolve organisation membership for
   * `listAuditRecordsForOrganisation`, mirroring `PolicyUseCaseDeps.organisations`
   * (DEVOS-139) exactly.
   */
  organisations: OrganisationRepository;
}
