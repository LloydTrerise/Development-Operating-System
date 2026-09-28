import type { OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import type {
  AuditRecordRepository,
  MembershipRepository,
  OrganisationLlmProviderRepository,
  OrganisationRepository,
} from '@devos/domain';

export interface OrganisationUseCaseDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  /** DEVOS-254: org-level membership add/remove/role-change are audited,
   * mirroring `ProjectUseCaseDeps`'s identical field. */
  auditRecords: AuditRecordRepository;
}

/**
 * DEVOS-321 (Sprint 54): its own real, transactional, multi-statement
 * reordering primitive — declared here, not imported from `@devos/database`,
 * mirroring `tasks/deps.ts`'s own established `RecordContextManifest`/
 * `PublishArtifact` boundary precedent (this package has no `@devos/database`
 * dependency). The real implementation
 * (`createOrganisationLlmProviderReorderer`, `@devos/database`) is wired in
 * at `apps/api/src/app.ts`'s own composition, the same "port declared in
 * application, adapter built in database" split `CloseWorkItem`/
 * `DecideApprovalAndTransition` already established.
 */
export type ReorderOrganisationLlmProviders = (
  organisationId: OrganisationId,
  orderedIds: OrganisationLlmProviderId[],
  updatedAt: string,
) => Promise<void>;

/**
 * DEVOS-321: narrower than widening `OrganisationUseCaseDeps` itself — only
 * the five new LLM-provider use cases need this repository/primitive,
 * mirroring `JobRoleUseCaseDeps`'s own established narrowing precedent (not
 * every `OrganisationUseCaseDeps` test fake needs a new field it never
 * uses).
 */
export interface OrganisationLlmProviderUseCaseDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  organisationLlmProviders: OrganisationLlmProviderRepository;
  reorderOrganisationLlmProviders: ReorderOrganisationLlmProviders;
  auditRecords: AuditRecordRepository;
}
