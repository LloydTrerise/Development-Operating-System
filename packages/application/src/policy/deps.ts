import type {
  AgentVersionRepository,
  AuditRecordRepository,
  MembershipRepository,
  OrganisationRepository,
  PolicyRepository,
  ProjectRepository,
} from '@devos/domain';

export interface PolicyUseCaseDeps {
  projects: ProjectRepository;
  /**
   * DEVOS-139: needed to resolve an organisation-scoped policy's own
   * organisation (`createOrganisationPolicy`/`publishPolicy` on an
   * organisation-scoped `Policy`), mirroring `projects` exactly.
   */
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  policies: PolicyRepository;
  /** DEVOS-086: policy publish is audited. */
  auditRecords: AuditRecordRepository;
  /**
   * DEVOS-141: only required by `simulatePolicy`, to resolve a real
   * `agentId`/`agentVersion` from a historical `AuditRecord`'s own
   * `metadata.agentVersionId`, if present — optional so every other policy
   * use case (which never needs it) is unaffected, mirroring the same
   * optional-dependency pattern `ToolGatewayDeps.agentVersions` already
   * established.
   */
  agentVersions?: AgentVersionRepository;
}
