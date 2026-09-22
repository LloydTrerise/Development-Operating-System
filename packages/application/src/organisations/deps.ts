import type {
  AuditRecordRepository,
  MembershipRepository,
  OrganisationRepository,
} from '@devos/domain';

export interface OrganisationUseCaseDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  /** DEVOS-254: org-level membership add/remove/role-change are audited,
   * mirroring `ProjectUseCaseDeps`'s identical field. */
  auditRecords: AuditRecordRepository;
}
