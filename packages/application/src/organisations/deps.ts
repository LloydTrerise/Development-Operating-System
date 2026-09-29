import type { OrganisationId, OrganisationLlmProviderId } from '@devos/contracts';
import type {
  AuditRecordRepository,
  Membership,
  MembershipRepository,
  Organisation,
  OrganisationLlmProviderRepository,
  OrganisationRepository,
  PolicyRepository,
  ProjectRepository,
  RegistrationTokenRepository,
} from '@devos/domain';

/**
 * DEVOS-346 (Sprint 61, Epic E31 gap closure): the create→membership→owner→
 * redeem sequence `createOrganisation` (`create-organisation.ts`) runs, as
 * one atomic transaction — a port declared here, implemented in
 * `@devos/database` (`createOrganisationTransactionCreator`), mirroring
 * `ReorderOrganisationLlmProviders`'s own identical "declared port, real
 * `withTransaction` adapter" precedent immediately below.
 */
export type CreateOrganisationTransactionally = (
  organisation: Organisation,
  membership: Membership,
  tokenId: string,
  now: string,
) => Promise<void>;

export interface OrganisationUseCaseDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  /** DEVOS-254: org-level membership add/remove/role-change are audited,
   * mirroring `ProjectUseCaseDeps`'s identical field. */
  auditRecords: AuditRecordRepository;
  /** DEVOS-330 (Sprint 57): only `createOrganisation` actually reads/writes
   * this — bundled onto the shared deps rather than a narrower dedicated
   * type, since `createOrganisationRoutes` (unlike `organisation-llm-
   * providers.ts`'s own split-by-resource routing) wires every organisation
   * use case through this one deps object already, mirroring `auditRecords`
   * itself (only touched by the membership use cases, not `getOrganisation`). */
  registrationTokens: RegistrationTokenRepository;
  /** DEVOS-346: only `createOrganisation` uses this — bundled onto the
   * shared deps for the same reason `registrationTokens` is. */
  createOrganisationTransactionally: CreateOrganisationTransactionally;
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

/**
 * DEVOS-333 (Sprint 58, candidate epic E31 part 3): narrower than widening
 * `OrganisationUseCaseDeps` itself, mirroring `OrganisationLlmProviderUseCaseDeps`'s
 * own established narrowing precedent immediately above — only
 * `getOrganisationInitialisationStatus` needs `projects`/`organisationLlmProviders`/
 * `policies` together. Per this sprint's own disclosed persistence-shape
 * decision (`specs/sprints/sprint-58/README.md`), there is no new table or
 * column behind this — all three fields are the same, already-real
 * repositories `ProjectUseCaseDeps`/`OrganisationLlmProviderUseCaseDeps`/
 * `PolicyUseCaseDeps` already construct against real Postgres; this
 * interface only composes read access to them for one new query.
 */
export interface OrganisationInitialisationStatusDeps {
  organisations: OrganisationRepository;
  memberships: MembershipRepository;
  projects: ProjectRepository;
  organisationLlmProviders: OrganisationLlmProviderRepository;
  policies: PolicyRepository;
}
