import type {
  AuditRecordRepository,
  MembershipRepository,
  ProjectRepository,
  ToolCapabilityRepository,
} from '@devos/domain';

export interface ToolUseCaseDeps {
  projects: ProjectRepository;
  memberships: MembershipRepository;
  toolCapabilities: ToolCapabilityRepository;
  /** DEVOS-256: capability status changes are audited. Optional — narrower
   * callers (`listCapabilitiesForProject`, a pure read) don't need it. */
  auditRecords?: AuditRecordRepository;
}
